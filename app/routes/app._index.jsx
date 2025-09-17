import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, useFetcher, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Check webhook status using GraphQL
  let webhookStatus = { registered: false, webhooks: [] };
  try {
    const webhooksResponse = await admin.graphql(
      `query {
        webhookSubscriptions(first: 50) {
          nodes {
            id
            topic
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }`
    );
    
    const responseJson = await webhooksResponse.json();
    console.log("🔍 Webhook GraphQL Response:", JSON.stringify(responseJson, null, 2));
    
    const webhooks = responseJson.data?.webhookSubscriptions?.nodes || [];
    const requiredWebhooks = [
      "ORDERS_CREATE",
      "ORDERS_UPDATED", 
      "ORDERS_FULFILLED",
      "ORDER_TRANSACTIONS_CREATE"
    ];
    
    const registeredWebhooks = webhooks.filter(webhook => 
      requiredWebhooks.includes(webhook.topic)
    );
    
    webhookStatus = {
      registered: registeredWebhooks.length === requiredWebhooks.length,
      webhooks: registeredWebhooks,
      required: requiredWebhooks,
      missing: requiredWebhooks.filter(topic => 
        !registeredWebhooks.find(w => w.topic === topic)
      )
    };
    
    console.log("🔍 Webhook Status Check:", {
      total: webhooks.length,
      registered: registeredWebhooks.length,
      required: requiredWebhooks.length,
      missing: webhookStatus.missing
    });
  } catch (error) {
    console.error("❌ Error checking webhook status:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
    webhookStatus.error = error.message;
  }

  // Fetch real data from database
  let stats = {
    totalTests: 0,
    activeTests: 0,
    totalConversions: 0,
    conversionRate: 0,
    totalRevenue: 0,
    totalImpressions: 0,
    recentActivity: []
  };

  try {
    const shop = session.shop;
    
    // Get all tests for this shop
    const tests = await prisma.aBTest.findMany({
      where: { shop },
      include: {
        events: true
      },
      orderBy: { startDate: 'desc' }
    });

    // Get all events for this shop
    const events = await prisma.aBEvent.findMany({
      where: {
        test: {
          shop: shop
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // Calculate statistics
    stats.totalTests = tests.length;
    stats.activeTests = tests.filter(test => test.status === 'running').length;
    
    // Calculate conversions and revenue
    const purchaseEvents = events.filter(event => event.eventType === 'purchase');
    stats.totalConversions = purchaseEvents.length;
    stats.totalRevenue = purchaseEvents.reduce((sum, event) => sum + (event.value || 0), 0);
    
    // Calculate impressions
    const impressionEvents = events.filter(event => event.eventType === 'impression');
    stats.totalImpressions = impressionEvents.length;
    
    // Calculate conversion rate
    stats.conversionRate = stats.totalImpressions > 0 
      ? (stats.totalConversions / stats.totalImpressions * 100).toFixed(1)
      : 0;

    // Generate recent activity from events
    const recentEvents = events.slice(0, 5).map(event => {
      const test = tests.find(t => t.id === event.testId);
      let message = '';
      let iconType = 'beaker';
      let color = 'blue';

      switch (event.eventType) {
        case 'purchase':
          message = `Purchase from ${test?.name || 'A/B Test'} - $${event.value?.toFixed(2) || '0.00'}`;
          iconType = 'fire';
          color = 'orange';
          break;
        case 'impression':
          message = `Impression recorded for ${test?.name || 'A/B Test'} (Variant ${event.variant})`;
          iconType = 'eye';
          color = 'blue';
          break;
        case 'add_to_cart':
          message = `Add to cart from ${test?.name || 'A/B Test'} (Variant ${event.variant})`;
          iconType = 'cart';
          color = 'green';
          break;
        default:
          message = `${event.eventType} event from ${test?.name || 'A/B Test'}`;
          iconType = 'chart';
          color = 'purple';
      }

      return {
        id: event.id,
        type: event.eventType,
        message,
        time: getTimeAgo(event.timestamp),
        iconType,
        color
      };
    });

    stats.recentActivity = recentEvents;

  } catch (error) {
    console.error("❌ Error fetching test data:", error);
    // Keep default stats if database query fails
  }

  return json({ stats, webhookStatus });
};

// Helper function to format time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return `${Math.floor(diffInSeconds / 2592000)} months ago`;
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "register_webhooks") {
    try {
      console.log("=== REGISTERING WEBHOOKS FROM MAIN APP ===");
      
      const webhooksToRegister = [
        {
          topic: "ORDERS_CREATE",
          address: `${process.env.SHOPIFY_APP_URL || "https://ab-optimizer-app.onrender.com"}/webhooks/orders/create`,
          format: "JSON"
        },
        {
          topic: "ORDERS_UPDATED",
          address: `${process.env.SHOPIFY_APP_URL || "https://ab-optimizer-app.onrender.com"}/webhooks/orders/updated`,
          format: "JSON"
        },
        {
          topic: "ORDERS_FULFILLED",
          address: `${process.env.SHOPIFY_APP_URL || "https://ab-optimizer-app.onrender.com"}/webhooks/orders/fulfilled`,
          format: "JSON"
        },
        {
          topic: "ORDER_TRANSACTIONS_CREATE",
          address: `${process.env.SHOPIFY_APP_URL || "https://ab-optimizer-app.onrender.com"}/webhooks/order_transactions/create`,
          format: "JSON"
        }
      ];

      const results = [];

      for (const webhook of webhooksToRegister) {
        try {
          console.log(`Registering webhook for ${webhook.topic}...`);
          
          const response = await admin.graphql(
            `mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
              webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                webhookSubscription {
                  id
                }
                userErrors {
                  field
                  message
        }
      }
    }`,
    {
      variables: {
                topic: webhook.topic,
                webhookSubscription: {
                  callbackUrl: webhook.address,
                  format: webhook.format
                }
              }
            }
          );

          const responseJson = await response.json();
          console.log(`Response for ${webhook.topic}:`, responseJson);

          if (responseJson.data?.webhookSubscriptionCreate?.webhookSubscription?.id) {
            results.push({
              topic: webhook.topic,
              status: "success",
              id: responseJson.data.webhookSubscriptionCreate.webhookSubscription.id
            });
            console.log(`✅ Webhook registered successfully: ${responseJson.data.webhookSubscriptionCreate.webhookSubscription.id}`);
          } else if (responseJson.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
            results.push({
              topic: webhook.topic,
              status: "error",
              errors: responseJson.data.webhookSubscriptionCreate.userErrors
            });
            console.log(`❌ Webhook registration failed:`, responseJson.data.webhookSubscriptionCreate.userErrors);
          }
        } catch (error) {
          results.push({
            topic: webhook.topic,
            status: "error",
            error: error.message
          });
          console.log(`❌ Error registering webhook for ${webhook.topic}:`, error);
        }
      }

      return json({
        webhookResults: {
          message: "Webhook registration completed",
          results: results,
          timestamp: new Date().toISOString(),
          appUrl: process.env.SHOPIFY_APP_URL || "https://ab-optimizer-app.onrender.com"
        }
      });

    } catch (error) {
      console.error("Error in webhook registration:", error);
      return json({
        webhookResults: {
          message: "Error registering webhooks",
          error: error.message,
          timestamp: new Date().toISOString(),
          appUrl: process.env.SHOPIFY_APP_URL || "https://ab-optimizer-app.onrender.com"
        }
      });
    }
  }

  return json({ success: false, error: "Invalid action" });
};

const QuickActionCard = ({ title, description, color = "green", to, icon }) => {
  const colorStyles = {
    green: { 
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      border: '1px solid #bbf7d0',
      textColor: '#166534',
      descriptionColor: '#15803d',
      arrowColor: '#22c55e'
    },
    blue: { 
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      border: '1px solid #bfdbfe',
      textColor: '#1e40af',
      descriptionColor: '#1d4ed8',
      arrowColor: '#3b82f6'
    },
    lightBlue: { 
      background: 'rgba(147, 197, 253, 0.2)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      border: '1px solid rgba(147, 197, 253, 0.3)',
      textColor: '#1e40af',
      descriptionColor: '#1d4ed8',
      arrowColor: '#3b82f6'
    },
    subtle: { 
      background: 'linear-gradient(135deg, #fafbff 0%, #f1f5f9 100%)',
      border: '1px solid #e2e8f0',
      textColor: '#374151',
      descriptionColor: '#6b7280',
      arrowColor: '#8b5cf6'
    },
    purple: { 
      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
      border: '1px solid #e9d5ff',
      textColor: '#5b21b6',
      descriptionColor: '#6d28d9',
      arrowColor: '#8b5cf6'
    },
    purple: { 
      background: 'rgba(251, 146, 199, 0.2)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      border: '1px solid rgba(251, 146, 199, 0.3)',
      textColor: '#5b21b6',
      descriptionColor: '#6d28d9',
      arrowColor: '#8b5cf6'
    },
    orange: { 
      background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
      border: '1px solid #fed7aa',
      textColor: '#c2410c',
      descriptionColor: '#dc2626',
      arrowColor: '#f97316'
    }
  };

  const styles = colorStyles[color];

  const CardContent = () => (
      <div 
        className="rounded-2xl shadow-sm cursor-pointer transition-all duration-300 relative overflow-hidden"
        style={{ 
          background: styles.background,
          backdropFilter: styles.backdropFilter || 'blur(15px)',
          WebkitBackdropFilter: styles.WebkitBackdropFilter || 'blur(15px)',
          border: styles.border,
          transform: 'translateY(0)',
          minHeight: '120px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
        }}
      onMouseEnter={(e) => {
        // Only apply hover effects to the outer container
        const container = e.currentTarget;
        container.style.transform = 'translateY(-4px)';
        container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
      }}
      onMouseLeave={(e) => {
        // Reset hover effects on the outer container
        const container = e.currentTarget;
        container.style.transform = 'translateY(0)';
        container.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
      }}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3 
            className="text-lg font-semibold mb-2"
            style={{ color: styles.textColor }}
          >
            {title}
          </h3>
          <p 
            className="text-sm leading-relaxed"
            style={{ color: styles.descriptionColor }}
          >
            {description}
          </p>
        </div>
        
        <div 
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: styles.arrowColor,
            transition: 'all 0.3s ease'
          }}
        >
          →
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} style={{ textDecoration: 'none' }}>
        <CardContent />
      </Link>
    );
  }

  return <CardContent />;
};

const getActivityIcon = (iconType) => {
  switch (iconType) {
    case 'beaker':
      return '🧪';
    case 'chart':
      return '📊';
    case 'fire':
      return '🔥';
    case 'eye':
      return '👁️';
    case 'cart':
      return '🛒';
    default:
      return '🧪';
  }
};

export default function Dashboard() {
  const { stats, webhookStatus } = useLoaderData();
  const { user } = useOutletContext();
  const fetcher = useFetcher();
  const webhookResults = fetcher.data?.webhookResults;
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  // Mock experiments data
  const experiments = [
    {
      id: 1,
      name: "Product Page Headline",
      description: "Testing different headline variations",
      status: "running",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lift: 15.2,
      revenueLift: 2500
    },
    {
      id: 2,
      name: "Checkout Button Color",
      description: "Blue vs Green button test",
      status: "completed",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lift: 8.7,
      revenueLift: 1800
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Glassmorphism Elements */}
      <div style={{
        position: 'absolute',
        top: '-100px',
        right: '-200px',
        width: '600px',
        height: '400px',
        background: 'linear-gradient(135deg, rgba(251, 146, 199, 0.15) 0%, rgba(251, 191, 36, 0.1) 50%, rgba(196, 181, 253, 0.12) 100%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-150px',
        left: '-300px',
        width: '500px',
        height: '350px',
        background: 'linear-gradient(135deg, rgba(196, 181, 253, 0.12) 0%, rgba(147, 197, 253, 0.08) 50%, rgba(251, 146, 199, 0.1) 100%)',
        borderRadius: '40%',
        filter: 'blur(50px)',
        zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '200px',
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(251, 146, 199, 0.1) 50%, rgba(196, 181, 253, 0.08) 100%)',
        borderRadius: '60%',
        filter: 'blur(60px)',
        zIndex: 0
      }}></div>
      {/* Dashboard Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
        gap: '24px',
        height: 'calc(100vh - 48px)',
        zIndex: 1
      }}>
        
        {/* TryLabs Dashboard - Large Tile */}
        <div style={{
          gridColumn: '1 / 8',
          gridRow: '1 / 4',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '24px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Background decorative elements */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
            borderRadius: '24px',
            transform: 'rotate(15deg)'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: '-30px',
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(124, 58, 237, 0.03) 100%)',
            borderRadius: '20px',
            transform: 'rotate(-10deg)'
          }}></div>

          {/* Header Section */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: '#3B82F6',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
            }}>
              <span style={{ fontSize: '20px' }}>🚀</span>
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                TryLabs Dashboard
              </h1>
              <p style={{ color: '#6b7280', margin: '0', fontSize: '14px', fontWeight: '500' }}>
                Welcome back, <span style={{ color: '#8b5cf6', fontWeight: '600' }}>{user?.firstName || 'User'}</span>!
              </p>
            </div>
          </div>

          {/* Progress Card */}
          <div style={{
            background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 6px -1px rgba(196, 181, 253, 0.2), 0 2px 4px -1px rgba(196, 181, 253, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            flex: 1
          }}>
            {/* Progress card background decoration */}
            <div style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              width: '60px',
              height: '60px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%'
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  background: '#ffffff',
                  borderRadius: '50%',
                  marginRight: '10px',
                  boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)'
                }}></div>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Your Progress
                </span>
              </div>
              
              <div style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: '#ffffff', 
                marginBottom: '16px',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                🏆 Data Scientist
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '12px', 
                  color: '#ffffff', 
                  marginBottom: '6px',
                  fontWeight: '500'
                }}>
                  <span>Level Progress</span>
                  <span>{stats.totalTests} / {Math.max(stats.totalTests + 5, 10)} Tests</span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: 'rgba(255, 255, 255, 0.2)', 
                  borderRadius: '4px', 
                  overflow: 'hidden',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ 
                    width: `${Math.min((stats.totalTests / Math.max(stats.totalTests + 5, 10)) * 100, 100)}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #ffffff 0%, #f0f0f0 100%)', 
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(255, 255, 255, 0.3)',
                    transition: 'width 0.8s ease-in-out'
                  }}></div>
                </div>
              </div>
              
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.8)',
                textAlign: 'center',
                fontStyle: 'italic'
              }}>
                {stats.totalTests > 0 
                  ? `${Math.max(stats.totalTests + 5, 10) - stats.totalTests} more tests to level up!`
                  : "Start your first test to begin your journey!"
                }
              </div>
            </div>
          </div>
        </div>

        {/* Gamified Hero Tile - Medium Tile */}
        <div style={{
          gridColumn: '8 / 13',
          gridRow: '1 / 5',
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: '#1f2937',
          padding: '24px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ position: 'absolute', top: '0', right: '0', width: '128px', height: '128px', background: 'linear-gradient(135deg, rgba(196, 181, 253, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%)', borderRadius: '24px', transform: 'translate(64px, -64px)' }}></div>
          <div style={{ position: 'absolute', bottom: '0', left: '0', width: '96px', height: '96px', background: 'linear-gradient(135deg, rgba(196, 181, 253, 0.08) 0%, rgba(167, 139, 250, 0.03) 100%)', borderRadius: '20px', transform: 'translate(-48px, 48px)' }}></div>
          
          {/* Achievement Section */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, rgba(196, 181, 253, 0.2) 0%, rgba(167, 139, 250, 0.1) 100%)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 2s infinite'
                }}>
                  <span style={{ fontSize: '20px' }}>🏆</span>
                </div>
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '20px',
                  height: '20px',
                  background: '#c4b5fd',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'white' }}>1</span>
                </div>
              </div>
              <div style={{ marginLeft: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>🏅 Data Scientist</h2>
                <p style={{ opacity: 0.9, fontSize: '12px' }}>
                  {stats.totalTests > 0 
                    ? `You've run ${stats.totalTests} test${stats.totalTests > 1 ? 's' : ''}!`
                    : "Ready to start your first A/B test!"
                  }
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center', flex: 1 }}>
              <div style={{ background: 'rgba(251, 146, 199, 0.15)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(251, 146, 199, 0.3)', boxShadow: '0 4px 16px rgba(251, 146, 199, 0.15)' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: '#1f2937' }}>{stats.activeTests}</div>
                <p style={{ fontSize: '10px', color: '#6b7280' }}>Active tests</p>
              </div>
              <div style={{ background: 'rgba(196, 181, 253, 0.15)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(196, 181, 253, 0.3)', boxShadow: '0 4px 16px rgba(196, 181, 253, 0.15)' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: '#1f2937' }}>{stats.totalConversions}</div>
                <p style={{ fontSize: '10px', color: '#6b7280' }}>Conversions</p>
              </div>
              <div style={{ background: 'rgba(251, 191, 36, 0.15)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(251, 191, 36, 0.3)', boxShadow: '0 4px 16px rgba(251, 191, 36, 0.15)' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: '#1f2937' }}>${stats.totalRevenue.toFixed(0)}</div>
                <p style={{ fontSize: '10px', color: '#6b7280' }}>Revenue</p>
              </div>
          </div>
        </div>

        {/* Quick Actions Tile - Wide Tile */}
        <div style={{
          gridColumn: '1 / 13',
          gridRow: '4 / 6',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '24px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#000000', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px' }}>⚡</span>
              Quick Actions
            </h2>
            <p style={{ color: '#374151', marginTop: '4px', fontSize: '14px' }}>Get started with common tasks</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', flex: 1 }}>
            <QuickActionCard
              title="Create New Test"
              description="Set up a new A/B test"
              color="purple"
              to="/app/ab-tests"
              icon="🧪"
            />
            <QuickActionCard
              title="View Analytics"
              description="Check performance metrics"
              color="lightBlue"
              to="/app/analytics"
              icon="📊"
            />
            <QuickActionCard
              title="Manage Tests"
              description="View and edit tests"
              color="purple"
              to="/app/manage-tests"
              icon="⚙️"
            />
          </div>
        </div>

      {/* Webhook Status Tile - Hidden from end users */}
      {/* 
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(50, 205, 50, 0.3)',
        marginBottom: '24px'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>🔗</span>
            A/B Testing Webhook Setup
          </h2>
          <p style={{ color: '#374151', marginTop: '4px' }}>
            Register webhooks to track purchase events for A/B testing. This will allow the app to automatically detect when customers complete purchases.
          </p>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          {webhookStatus.error ? (
            <div style={{
              padding: '12px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              color: 'white'
            }}>
              ❌ Error checking webhook status: {webhookStatus.error}
            </div>
          ) : webhookStatus.registered ? (
            <div style={{
              padding: '12px',
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              border: '1px solid #32cd32',
              borderRadius: '8px',
              color: 'white'
            }}>
              ✅ All required webhooks are registered and active
            </div>
          ) : (
            <div style={{
              padding: '12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              color: 'white'
            }}>
              ⚠️ Missing webhooks: {webhookStatus.missing.join(', ')}
            </div>
          )}
        </div>
        
        {!webhookStatus.registered && (
          <button
            onClick={() => {
              const formData = new FormData();
              formData.append('actionType', 'registerWebhooks');
              submit(formData, { method: 'post' });
            }}
            style={{
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #228b22 0%, #006400 100%)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)';
            }}
          >
            Register Webhooks
        </button>
        )}
      </div>
      */}

        {/* Recent Activity Tile - Large Tile */}
        <div style={{
          gridColumn: '1 / 9',
          gridRow: '6 / 9',
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '24px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px' }}>📝</span>
              Recent Activity
            </h2>
            <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Your latest testing activities</p>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {stats.recentActivity.map((activity, activityIdx) => {
              const activityIcon = getActivityIcon(activity.iconType);
              const colorStyles = {
                blue: { background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
                green: { background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' },
                orange: { background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)' },
                purple: { background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }
              };
              
              return (
                <li key={activity.id} style={{ marginBottom: '32px', position: 'relative' }}>
                  {activityIdx !== stats.recentActivity.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      left: '20px',
                      width: '2px',
                      height: 'calc(100% + 16px)',
                      background: 'linear-gradient(to bottom, #e9d5ff 0%, transparent 100%)'
                    }}></div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      border: '4px solid white',
                      ...colorStyles[activity.color]
                    }}>
                      <span style={{ color: 'white', fontSize: '14px' }}>{activityIcon}</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: '6px' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>
                          {activity.message}
                        </p>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                        {activity.time}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            </ul>
          </div>
        </div>
        
        {/* Stats Summary Tile - Small Tile */}
        <div style={{
          gridColumn: '9 / 13',
          gridRow: '6 / 9',
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '24px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>📊 Quick Stats</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <div style={{ background: 'rgba(251, 146, 199, 0.15)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(251, 146, 199, 0.3)', boxShadow: '0 4px 16px rgba(251, 146, 199, 0.15)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: '#1f2937' }}>{stats.activeTests}</div>
              <p style={{ fontSize: '10px', color: '#6b7280' }}>Active tests</p>
            </div>
            <div style={{ background: 'rgba(196, 181, 253, 0.15)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(196, 181, 253, 0.3)', boxShadow: '0 4px 16px rgba(196, 181, 253, 0.15)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: '#1f2937' }}>{stats.totalConversions}</div>
              <p style={{ fontSize: '10px', color: '#6b7280' }}>Conversions</p>
            </div>
            <div style={{ background: 'rgba(251, 191, 36, 0.15)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(251, 191, 36, 0.3)', boxShadow: '0 4px 16px rgba(251, 191, 36, 0.15)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: '#1f2937' }}>${stats.totalRevenue.toFixed(0)}</div>
              <p style={{ fontSize: '10px', color: '#6b7280' }}>Revenue</p>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
} 