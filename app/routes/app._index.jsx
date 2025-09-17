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
      background: '#E6E6E6',
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
      {/* Dashboard Responsive Layout */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(16px, 2vw, 24px)',
        padding: 'clamp(16px, 2vw, 24px)',
        height: 'calc(100vh - 48px)',
        zIndex: 1,
        overflow: 'auto'
      }}>
        
        {/* TryLabs Dashboard Tile */}
        <div style={{
          width: '100%',
          minHeight: 'clamp(120px, 15vh, 200px)',
          background: '#FFFFFF',
          padding: 'clamp(16px, 3vw, 32px)',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E6E6E6',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {/* Background decorative elements */}
          <div style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: 'clamp(120px, 15vw, 160px)',
            height: 'clamp(120px, 15vw, 160px)',
            background: '#97CDFF',
            borderRadius: '32px',
            transform: 'rotate(15deg)',
            opacity: 0.3
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-50px',
            left: '-50px',
            width: 'clamp(80px, 12vw, 120px)',
            height: 'clamp(80px, 12vw, 120px)',
            background: '#97CDFF',
            borderRadius: '28px',
            transform: 'rotate(-10deg)',
            opacity: 0.2
          }}></div>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'clamp(150px, 20vw, 200px)',
            height: 'clamp(150px, 20vw, 200px)',
            background: '#97CDFF',
            borderRadius: '50%',
            filter: 'blur(40px)',
            opacity: 0.1
          }}></div>

          {/* Header Section */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1, marginBottom: 'clamp(12px, 2vw, 20px)' }}>
            <div style={{
              width: 'clamp(40px, 6vw, 60px)',
              height: 'clamp(40px, 6vw, 60px)',
              background: '#0038FF',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 'clamp(12px, 2vw, 24px)',
              boxShadow: '0 4px 12px rgba(0, 56, 255, 0.3)'
            }}>
              <span style={{ fontSize: 'clamp(20px, 3vw, 28px)' }}>🚀</span>
            </div>
            <div>
              <h1 style={{ 
                fontSize: 'clamp(24px, 4vw, 36px)', 
                fontWeight: '800', 
                color: '#151515', 
                margin: '0 0 clamp(4px, 1vw, 8px) 0', 
                letterSpacing: '-0.8px',
                lineHeight: '1.2'
              }}>
                TryLabs Dashboard
              </h1>
              <p style={{ 
                color: '#151515', 
                margin: '0', 
                fontSize: 'clamp(14px, 2vw, 18px)', 
                fontWeight: '500',
                lineHeight: '1.3'
              }}>
                Welcome back, <span style={{ color: '#97CDFF', fontWeight: '600' }}>{user?.firstName || 'User'}</span>!
              </p>
            </div>
          </div>

          {/* Subtitle */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ 
              color: '#151515', 
              margin: '0', 
              fontSize: 'clamp(12px, 1.8vw, 16px)', 
              fontWeight: '400',
              lineHeight: '1.5'
            }}>
              Your comprehensive A/B testing platform for optimizing conversions and driving growth.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 'clamp(12px, 2vw, 20px)',
          flexWrap: 'wrap',
          width: '100%'
        }}>
          {/* Progress Card Tile */}
          <div style={{
            flex: '1 1 clamp(280px, 30vw, 400px)',
            minHeight: 'clamp(140px, 18vh, 200px)',
            background: '#ef9362',
            padding: 'clamp(16px, 2vw, 24px)',
            borderRadius: '20px',
            border: '1px solid #E6E6E6',
            boxShadow: '0 4px 6px -1px rgba(239, 147, 98, 0.2), 0 2px 4px -1px rgba(239, 147, 98, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
          {/* Progress card background decoration */}
          <div style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            width: 'clamp(40px, 6vw, 60px)',
            height: 'clamp(40px, 6vw, 60px)',
            background: '#97CDFF',
            borderRadius: '50%',
            opacity: 0.3
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'clamp(8px, 1vw, 12px)' }}>
              <div style={{
                width: 'clamp(8px, 1.2vw, 12px)',
                height: 'clamp(8px, 1.2vw, 12px)',
                background: '#151515',
                borderRadius: '50%',
                marginRight: 'clamp(6px, 1vw, 10px)',
                boxShadow: '0 0 8px rgba(21, 21, 21, 0.5)'
              }}></div>
              <span style={{ fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: '600', color: '#151515', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Your Progress
              </span>
            </div>
            
            <div style={{ 
              fontSize: 'clamp(16px, 2.5vw, 20px)', 
              fontWeight: '700', 
              color: '#151515', 
              marginBottom: 'clamp(12px, 1.5vw, 16px)',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              🏆 Data Scientist
            </div>
            
            <div style={{ marginBottom: 'clamp(8px, 1vw, 12px)' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 'clamp(10px, 1.2vw, 12px)', 
                color: '#151515', 
                marginBottom: 'clamp(4px, 0.8vw, 6px)',
                fontWeight: '500'
              }}>
                <span>Level Progress</span>
                <span>{stats.totalTests} / {Math.max(stats.totalTests + 5, 10)} Tests</span>
              </div>
              <div style={{ 
                height: 'clamp(6px, 1vw, 8px)', 
                background: 'rgba(21, 21, 21, 0.2)', 
                borderRadius: '4px', 
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ 
                  width: `${Math.min((stats.totalTests / Math.max(stats.totalTests + 5, 10)) * 100, 100)}%`, 
                  height: '100%', 
                  background: '#151515', 
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(21, 21, 21, 0.3)',
                  transition: 'width 0.8s ease-in-out'
                }}></div>
              </div>
            </div>
            
            <div style={{
              fontSize: 'clamp(9px, 1.1vw, 11px)',
              color: '#151515',
              textAlign: 'center',
              fontStyle: 'italic',
              opacity: 0.8
            }}>
              {stats.totalTests > 0 
                ? `${Math.max(stats.totalTests + 5, 10) - stats.totalTests} more tests to level up!`
                : "Start your first test to begin your journey!"
              }
            </div>
          </div>
        </div>


          {/* Total Tests Tile */}
          <div style={{
            flex: '1 1 clamp(120px, 15vw, 180px)',
            minHeight: 'clamp(100px, 12vh, 140px)',
            background: '#0038FF',
            padding: 'clamp(12px, 2vw, 24px)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 56, 255, 0.1), 0 4px 16px rgba(0, 56, 255, 0.05)',
            border: '1px solid #E6E6E6',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 'clamp(20px, 3vw, 32px)', marginBottom: 'clamp(4px, 1vw, 8px)' }}>🧪</div>
            <div style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', fontWeight: 'bold', color: '#FFFFFF', marginBottom: 'clamp(2px, 0.5vw, 4px)' }}>
              {stats.totalTests}
            </div>
            <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: '#FFFFFF' }}>Total Tests</div>
          </div>

          {/* Active Tests Tile */}
          <div style={{
            flex: '1 1 clamp(120px, 15vw, 180px)',
            minHeight: 'clamp(100px, 12vh, 140px)',
            background: '#ef9362',
            padding: 'clamp(12px, 2vw, 24px)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(239, 147, 98, 0.1), 0 4px 16px rgba(239, 147, 98, 0.05)',
            border: '1px solid #E6E6E6',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 'clamp(20px, 3vw, 32px)', marginBottom: 'clamp(4px, 1vw, 8px)' }}>⚡</div>
            <div style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', fontWeight: 'bold', color: '#151515', marginBottom: 'clamp(2px, 0.5vw, 4px)' }}>
              {stats.activeTests}
            </div>
            <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: '#151515' }}>Active Tests</div>
          </div>

          {/* Revenue Tile */}
          <div style={{
            flex: '1 1 clamp(120px, 15vw, 180px)',
            minHeight: 'clamp(100px, 12vh, 140px)',
            background: '#0038FF',
            padding: 'clamp(12px, 2vw, 24px)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 56, 255, 0.1), 0 4px 16px rgba(0, 56, 255, 0.05)',
            border: '1px solid #E6E6E6',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 'clamp(20px, 3vw, 32px)', marginBottom: 'clamp(4px, 1vw, 8px)' }}>💰</div>
            <div style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', fontWeight: 'bold', color: '#FFFFFF', marginBottom: 'clamp(2px, 0.5vw, 4px)' }}>
              ${stats.totalRevenue.toFixed(0)}
            </div>
            <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: '#FFFFFF' }}>Revenue</div>
          </div>

          {/* Conversion Rate Tile */}
          <div style={{
            flex: '1 1 clamp(120px, 15vw, 180px)',
            minHeight: 'clamp(100px, 12vh, 140px)',
            background: '#ef9362',
            padding: 'clamp(12px, 2vw, 24px)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(239, 147, 98, 0.1), 0 4px 16px rgba(239, 147, 98, 0.05)',
            border: '1px solid #E6E6E6',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 'clamp(20px, 3vw, 32px)', marginBottom: 'clamp(4px, 1vw, 8px)' }}>📈</div>
            <div style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', fontWeight: 'bold', color: '#151515', marginBottom: 'clamp(2px, 0.5vw, 4px)' }}>
              {stats.conversionRate}%
            </div>
            <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: '#151515' }}>Conversion Rate</div>
          </div>
        </div>

        {/* Actions Row */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 'clamp(12px, 2vw, 20px)',
          flexWrap: 'wrap',
          width: '100%'
        }}>
          {/* Create New Test Tile */}
          <Link to="/app/ab-tests" style={{ textDecoration: 'none', flex: '1 1 clamp(200px, 25vw, 300px)' }}>
            <div style={{
              background: '#ef9362',
              padding: 'clamp(12px, 2vw, 24px)',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(239, 147, 98, 0.1), 0 4px 16px rgba(239, 147, 98, 0.05)',
              border: '1px solid #E6E6E6',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minHeight: 'clamp(120px, 15vh, 160px)'
            }}>
              <div style={{ fontSize: 'clamp(20px, 3vw, 32px)', marginBottom: 'clamp(6px, 1vw, 12px)' }}>🧪</div>
              <div style={{ fontSize: 'clamp(14px, 2vw, 18px)', fontWeight: '600', color: '#151515', marginBottom: 'clamp(4px, 1vw, 8px)' }}>
                Create New Test
              </div>
              <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: '#151515' }}>
                Set up a new A/B test
              </div>
            </div>
          </Link>

          {/* View Analytics Tile */}
          <Link to="/app/analytics" style={{ textDecoration: 'none', flex: '1 1 clamp(200px, 25vw, 300px)' }}>
            <div style={{
              background: '#0038FF',
              padding: 'clamp(12px, 2vw, 24px)',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 56, 255, 0.1), 0 4px 16px rgba(0, 56, 255, 0.05)',
              border: '1px solid #E6E6E6',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minHeight: 'clamp(120px, 15vh, 160px)'
            }}>
              <div style={{ fontSize: 'clamp(20px, 3vw, 32px)', marginBottom: 'clamp(6px, 1vw, 12px)' }}>📊</div>
              <div style={{ fontSize: 'clamp(14px, 2vw, 18px)', fontWeight: '600', color: '#FFFFFF', marginBottom: 'clamp(4px, 1vw, 8px)' }}>
                View Analytics
              </div>
              <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: '#FFFFFF' }}>
                Check performance metrics
              </div>
            </div>
          </Link>

          {/* Manage Tests Tile */}
          <Link to="/app/manage-tests" style={{ textDecoration: 'none', flex: '1 1 clamp(200px, 25vw, 300px)' }}>
            <div style={{
              background: '#ef9362',
              padding: 'clamp(12px, 2vw, 24px)',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(239, 147, 98, 0.1), 0 4px 16px rgba(239, 147, 98, 0.05)',
              border: '1px solid #E6E6E6',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minHeight: 'clamp(120px, 15vh, 160px)'
            }}>
              <div style={{ fontSize: 'clamp(20px, 3vw, 32px)', marginBottom: 'clamp(6px, 1vw, 12px)' }}>⚙️</div>
              <div style={{ fontSize: 'clamp(14px, 2vw, 18px)', fontWeight: '600', color: '#151515', marginBottom: 'clamp(4px, 1vw, 8px)' }}>
                Manage Tests
              </div>
              <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: '#151515' }}>
                View and edit tests
              </div>
            </div>
          </Link>
        </div>


        {/* Recent Activity Tile */}
        <div style={{
          width: '100%',
          minHeight: 'clamp(200px, 25vh, 300px)',
          background: '#FFFFFF',
          padding: 'clamp(16px, 2vw, 24px)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E6E6E6',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: 'clamp(12px, 1.5vw, 16px)' }}>
            <h2 style={{ fontSize: 'clamp(16px, 2vw, 18px)', fontWeight: '600', color: '#151515', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: 'clamp(6px, 1vw, 8px)' }}>📝</span>
              Recent Activity
            </h2>
            <p style={{ color: '#151515', marginTop: 'clamp(2px, 0.5vw, 4px)', fontSize: 'clamp(12px, 1.5vw, 14px)' }}>Your latest testing activities</p>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {stats.recentActivity.map((activity, activityIdx) => {
              const activityIcon = getActivityIcon(activity.iconType);
              const colorStyles = {
                blue: { background: '#0038FF' },
                green: { background: '#ef9362' },
                orange: { background: '#97CDFF' },
                purple: { background: '#0038FF' }
              };
              
              return (
                <li key={activity.id} style={{ marginBottom: 'clamp(12px, 1.5vw, 16px)', position: 'relative' }}>
                  {activityIdx !== stats.recentActivity.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      top: 'clamp(8px, 1vw, 12px)',
                      left: 'clamp(12px, 1.5vw, 16px)',
                      width: '2px',
                      height: 'calc(100% + clamp(6px, 1vw, 8px))',
                      background: 'linear-gradient(to bottom, #97CDFF 0%, transparent 100%)'
                    }}></div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'clamp(8px, 1.5vw, 12px)' }}>
                    <div style={{
                      width: 'clamp(24px, 3vw, 32px)',
                      height: 'clamp(24px, 3vw, 32px)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      border: '3px solid white',
                      ...colorStyles[activity.color]
                    }}>
                      <span style={{ color: 'white', fontSize: 'clamp(10px, 1.2vw, 12px)' }}>{activityIcon}</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 'clamp(2px, 0.5vw, 4px)' }}>
                      <div>
                        <p style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', fontWeight: '600', color: '#151515', margin: 0 }}>
                          {activity.message}
                        </p>
                      </div>
                      <div style={{ fontSize: 'clamp(8px, 1vw, 10px)', color: '#151515', whiteSpace: 'nowrap', marginLeft: 'clamp(8px, 1.5vw, 12px)' }}>
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

        
      </div>
    </div>
  );
}