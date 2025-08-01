import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Check webhook status
  let webhookStatus = { registered: false, webhooks: [] };
  try {
    const webhooksResponse = await admin.rest.get({
      path: "webhooks.json",
    });
    
    const webhooks = webhooksResponse.data.webhooks || [];
    const requiredWebhooks = [
      "orders/create",
      "orders/updated", 
      "orders/fulfilled",
      "order_transactions/create"
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
    webhookStatus.error = error.message;
  }

  // Mock data - in a real app, you'd fetch this from your database
  const stats = {
    totalTests: 12,
    activeTests: 5,
    totalConversions: 1247,
    conversionRate: 3.2,
    recentActivity: [
      { id: 1, type: 'test_created', message: 'New A/B test created for Product Page', time: '2 hours ago', iconType: 'beaker', color: 'blue' },
      { id: 2, type: 'test_completed', message: 'Product Title test completed - Variant B won', time: '1 day ago', iconType: 'chart', color: 'green' },
      { id: 3, type: 'conversion', message: 'Checkout button test showing 15% improvement', time: '2 days ago', iconType: 'fire', color: 'orange' },
    ]
  };

  return json({ stats, webhookStatus });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "register_webhooks") {
    console.log("🚀 Registering webhooks...");
    
    const webhooksToRegister = [
      {
        topic: "ORDERS_CREATE",
        address: `${process.env.SHOPIFY_APP_URL}/webhooks/orders/create`,
        format: "JSON"
      },
      {
        topic: "ORDERS_UPDATED",
        address: `${process.env.SHOPIFY_APP_URL}/webhooks/orders/updated`,
        format: "JSON"
      },
      {
        topic: "ORDERS_FULFILLED",
        address: `${process.env.SHOPIFY_APP_URL}/webhooks/orders/fulfilled`,
        format: "JSON"
      },
      {
        topic: "ORDER_TRANSACTIONS_CREATE",
        address: `${process.env.SHOPIFY_APP_URL}/webhooks/order_transactions/create`,
        format: "JSON"
      }
    ];

    const results = [];
    
    for (const webhook of webhooksToRegister) {
      try {
        console.log(`📡 Registering webhook: ${webhook.topic}`);
        const response = await admin.rest.post({
          path: "webhooks.json",
          data: { webhook }
        });
        
        results.push({
          topic: webhook.topic,
          success: true,
          id: response.data.webhook.id
        });
        
        console.log(`✅ Successfully registered webhook: ${webhook.topic} (ID: ${response.data.webhook.id})`);
      } catch (error) {
        console.error(`❌ Failed to register webhook ${webhook.topic}:`, error);
        
        if (error.response?.status === 422) {
          results.push({
            topic: webhook.topic,
            success: true,
            message: "Already exists"
          });
          console.log(`ℹ️ Webhook ${webhook.topic} already exists`);
        } else {
          results.push({
            topic: webhook.topic,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    console.log("🎯 Webhook registration complete:", results);
    return json({ success: true, results });
  }

  return json({ success: false, error: "Invalid action" });
};

const QuickActionCard = ({ title, description, color = "blue" }) => {
  const colorStyles = {
    blue: { 
      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      hoverBg: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'
    },
    green: { 
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      hoverBg: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
    },
    purple: { 
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      hoverBg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
    }
  };

  const styles = colorStyles[color];

  return (
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
          <span className="text-white text-lg">+</span>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-blue-100">{description}</p>
        </div>
        <span className="text-white/70 text-lg">→</span>
      </div>
    </div>
  );
};

const getActivityIcon = (iconType) => {
  switch (iconType) {
    case 'beaker':
      return '🧪';
    case 'chart':
      return '📊';
    case 'fire':
      return '🔥';
    default:
      return '🧪';
  }
};

export default function Dashboard() {
  const { stats, webhookStatus } = useLoaderData();
  const { user } = useOutletContext();

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
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lift: 8.7,
      revenueLift: 1200
    }
  ];

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header Tile */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 0%, #ec4899 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>Welcome back! 👋</h1>
            <p style={{ fontSize: '18px', opacity: 0.9 }}>Here's what's happening with your experiments today.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s'
            }}>
              <span style={{ marginRight: '8px' }}>+</span>
              New Experiment
            </button>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <span style={{ color: 'white', fontWeight: '600' }}>
                {user?.firstName ? user.firstName.charAt(0) : 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Overview Tile */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>📊</span>
            Performance Overview
          </h2>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>Your key metrics at a glance</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          {/* Active Experiments */}
          <div style={{
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #bae6fd'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', marginRight: '8px' }}></div>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Active Experiments</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
              {experiments.filter(exp => exp.status === "running").length}
            </div>
            <div style={{ height: '20px', background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.4) 100%)', borderRadius: '4px' }}></div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Currently running</p>
          </div>

          {/* Wins This Month */}
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #fcd34d'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%', marginRight: '8px' }}></div>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Wins This Month</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
              {experiments.filter(exp => exp.status === "completed").length}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#10b981', marginRight: '4px' }}>↗</span>
              <p style={{ fontSize: '12px', color: '#10b981' }}>+25% from last month</p>
            </div>
          </div>

          {/* Revenue Lift */}
          <div style={{
            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #6ee7b7'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', marginRight: '8px' }}></div>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Revenue Lift</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
              ${experiments.reduce((sum, exp) => sum + (exp.revenueLift || 0), 0).toLocaleString()}
            </div>
            <p style={{ fontSize: '12px', color: '#10b981' }}>+15.2% total lift</p>
          </div>

          {/* Your Progress */}
          <div style={{
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #93c5fd'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', marginRight: '8px' }}></div>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Your Progress</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
              Data Scientist
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                <span>Level Progress</span>
                <span>1250 / 1750 XP</span>
              </div>
              <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '71%', height: '100%', background: '#3b82f6', borderRadius: '4px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gamified Hero Tile */}
      <div style={{
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '0', right: '0', width: '128px', height: '128px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '50%', transform: 'translate(64px, -64px)' }}></div>
        <div style={{ position: 'absolute', bottom: '0', left: '0', width: '96px', height: '96px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%', transform: 'translate(-48px, 48px)' }}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(255, 255, 255, 0.2)',
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
                background: '#f59e0b',
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
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>2</div>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>Tests this week</p>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>8</div>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>Variants created</p>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>450</div>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>Points earned</p>
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
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>⚡</span>
            Quick Actions
          </h2>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>Get started with common tasks</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <QuickActionCard
            title="Create New Test"
            description="Set up a new A/B test for your products"
            color="blue"
          />
          <QuickActionCard
            title="View Analytics"
            description="Check detailed performance metrics"
            color="green"
          />
          <QuickActionCard
            title="Manage Tests"
            description="View and edit existing A/B tests"
            color="purple"
          />
        </div>
      </div>

      {/* Webhook Status Tile */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        marginTop: '24px'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>🔗</span>
            Webhook Status
          </h2>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>
            Purchase tracking requires webhooks to be registered
          </p>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          {webhookStatus.error ? (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              fontSize: '14px'
            }}>
              ❌ Error checking webhook status: {webhookStatus.error}
            </div>
          ) : webhookStatus.registered ? (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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

        {!webhookStatus.registered && (
          <Form method="post" style={{ marginTop: '16px' }}>
            <input type="hidden" name="action" value="register_webhooks" />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              🔗 Register Webhooks
            </button>
          </Form>
        )}

        {webhookStatus.webhooks.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              Registered Webhooks:
            </h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {webhookStatus.webhooks.map((webhook, index) => (
                <div key={index} style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '13px',
                  color: '#065f46'
                }}>
                  ✅ {webhook.topic} (ID: {webhook.id})
                </div>
              ))}
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