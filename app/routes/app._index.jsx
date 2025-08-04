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
      background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
      hoverBg: 'linear-gradient(135deg, #228b22 0%, #006400 100%)'
    },
    lime: { 
      background: 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)',
      hoverBg: 'linear-gradient(135deg, #6b8e23 0%, #556b2f 100%)'
    },
    dark: { 
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      hoverBg: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)'
    }
  };

  const styles = colorStyles[color];

  const CardContent = () => (
    <div 
      className="rounded-xl shadow-lg p-6 cursor-pointer transition-all duration-200 text-white hover:scale-105"
      style={{ 
        background: styles.background,
        transform: 'translateY(0)',
      }}
      onMouseEnter={(e) => {
        e.target.style.background = styles.hoverBg;
        e.target.style.transform = 'translateY(-4px) scale(1.02)';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = styles.background;
        e.target.style.transform = 'translateY(0) scale(1)';
      }}
    >
      <div className="flex items-center">
        <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
          <span className="text-white text-lg">{icon}</span>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-green-100">{description}</p>
        </div>
        <span className="text-white/70 text-lg">→</span>
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
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #32cd32 100%)',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(50, 205, 50, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#000000', margin: '0 0 8px 0' }}>
              A/B Testing Dashboard
            </h1>
            <p style={{ color: '#374151', margin: '0', fontSize: '16px' }}>
              Welcome back, {user?.firstName || 'User'}! Here's your testing overview.
            </p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #32cd32'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#ffffff', borderRadius: '50%', marginRight: '8px' }}></div>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff' }}>Your Progress</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
              Data Scientist
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ffffff', marginBottom: '4px' }}>
                <span>Level Progress</span>
                <span>{stats.totalTests} / {Math.max(stats.totalTests + 5, 10)} Tests</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min((stats.totalTests / Math.max(stats.totalTests + 5, 10)) * 100, 100)}%`, 
                  height: '100%', 
                  background: '#ffffff', 
                  borderRadius: '4px' 
                }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gamified Hero Tile */}
      <div style={{
        background: 'linear-gradient(135deg, #000000 0%, #32cd32 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '0', right: '0', width: '128px', height: '128px', background: 'rgba(50, 205, 50, 0.2)', borderRadius: '50%', transform: 'translate(64px, -64px)' }}></div>
        <div style={{ position: 'absolute', bottom: '0', left: '0', width: '96px', height: '96px', background: 'rgba(50, 205, 50, 0.1)', borderRadius: '50%', transform: 'translate(-48px, 48px)' }}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(50, 205, 50, 0.3)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 2s infinite'
              }}>
                <span style={{ fontSize: '24px' }}>🏆</span>
              </div>
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '24px',
                height: '24px',
                background: '#32cd32',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>3</span>
              </div>
            </div>
            <div style={{ marginLeft: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>🏅 Data Scientist</h2>
              <p style={{ opacity: 0.9 }}>You've run a test for 5 days straight!</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(50, 205, 50, 0.2)', borderRadius: '8px', padding: '16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.activeTests}</div>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>Active tests</p>
            </div>
            <div style={{ background: 'rgba(50, 205, 50, 0.2)', borderRadius: '8px', padding: '16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.totalConversions}</div>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>Conversions</p>
            </div>
            <div style={{ background: 'rgba(50, 205, 50, 0.2)', borderRadius: '8px', padding: '16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>${stats.totalRevenue.toFixed(0)}</div>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>Revenue generated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Tile */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(50, 205, 50, 0.2)'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>⚡</span>
            Quick Actions
          </h2>
          <p style={{ color: '#374151', marginTop: '4px' }}>Get started with common tasks</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <QuickActionCard
            title="Create New Test"
            description="Set up a new A/B test for your products"
            color="green"
            to="/app/ab-tests"
            icon="🧪"
          />
          <QuickActionCard
            title="View Analytics"
            description="Check detailed performance metrics"
            color="lime"
            to="/app/badges"
            icon="📊"
          />
          <QuickActionCard
            title="Manage Tests"
            description="View and edit existing A/B tests"
            color="dark"
            to="/app/ab-tests"
            icon="⚙️"
          />
        </div>
      </div>

      {/* Webhook Status Tile */}
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
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: 'white',
              fontSize: '14px'
            }}>
              ❌ Error checking webhook status: {webhookStatus.error}
            </div>
          ) : webhookStatus.registered ? (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              color: 'white',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '8px' }}>✅</span>
              All required webhooks are registered ({webhookStatus.webhooks.length}/{webhookStatus.required.length})
            </div>
          ) : (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)',
              color: 'white',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '8px' }}>⚠️</span>
              Missing webhooks: {webhookStatus.missing.join(', ')}
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => fetcher.submit({ action: "register_webhooks" }, { method: "POST" })}
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              opacity: isLoading ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.background = 'linear-gradient(135deg, #228b22 0%, #006400 100%)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.background = 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            {isLoading ? '🔄 Registering...' : '🔗 Register Webhooks'}
          </button>
        </div>

        {/* Webhook Results Display */}
        {webhookResults && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              Webhook Registration Results
            </h3>
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <strong>Message:</strong> {webhookResults.message}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>App URL:</strong> {webhookResults.appUrl}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>Timestamp:</strong> {webhookResults.timestamp}
              </div>

              {webhookResults.error && (
                <div style={{ marginBottom: '12px', color: '#dc2626' }}>
                  <strong>Error:</strong> {webhookResults.error}
                </div>
              )}

              {webhookResults.results && webhookResults.results.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Webhook Results:</h4>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {webhookResults.results.map((result, index) => (
                      <div key={index} style={{
                        padding: '12px',
                        borderRadius: '6px',
                        background: result.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: result.status === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                      }}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Topic:</strong> {result.topic}
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Status:</strong> {result.status}
                        </div>
                        {result.id && (
                          <div style={{ marginBottom: '4px' }}>
                            <strong>ID:</strong> {result.id}
                          </div>
                        )}
                        {result.errors && (
                          <div style={{ color: '#dc2626' }}>
                            <strong>Errors:</strong> {JSON.stringify(result.errors)}
                          </div>
                        )}
                        {result.error && (
                          <div style={{ color: '#dc2626' }}>
                            <strong>Error:</strong> {result.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Tile */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>📝</span>
            Recent Activity
          </h2>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>Your latest testing activities</p>
        </div>
        
        <div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {stats.recentActivity.map((activity, activityIdx) => {
              const activityIcon = getActivityIcon(activity.iconType);
              const colorStyles = {
                blue: { background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' },
                green: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
                orange: { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
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
                      background: 'linear-gradient(to bottom, #e5e7eb 0%, transparent 100%)'
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
    </div>
  );
} 