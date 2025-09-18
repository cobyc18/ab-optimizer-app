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
    
    console.log("📊 Webhook Status:", webhookStatus);
  } catch (error) {
    console.error("❌ Error checking webhooks:", error);
  }

  // Get shop info
  const shopResponse = await admin.graphql(`
    query {
      shop {
        name
        email
        domain
        plan {
          displayName
        }
      }
    }
  `);
  
  const shopData = await shopResponse.json();
  const shop = shopData.data?.shop;

  // Get A/B test statistics
  const totalTests = await prisma.abTest.count();
  const activeTests = await prisma.abTest.count({
    where: { status: 'active' }
  });

  // Calculate revenue impact (mock data for now)
  const totalRevenue = 125000;
  const conversionRate = 3.2;

  return json({
    shop,
    webhookStatus,
    stats: {
      totalTests,
      activeTests,
      totalRevenue,
      conversionRate
    }
  });
};

export default function Dashboard() {
  const { shop, webhookStatus, stats } = useLoaderData();
  const { session } = useOutletContext();

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#F8F9FA'
    }}>
      {/* Main Content Area */}
      <div style={{
        flex: 1,
        padding: 'clamp(20px, 2.5vw, 32px)',
        background: '#F8F9FA',
        height: '100vh',
        overflow: 'auto'
      }}>
        
        {/* Welcome Header */}
        <div style={{
          width: '100%',
          marginBottom: 'clamp(24px, 3vw, 32px)'
        }}>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: '700',
            color: '#1F2937',
            margin: '0 0 clamp(8px, 1vw, 12px) 0',
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(8px, 1vw, 12px)'
          }}>
            Welcome Back, {session?.shop?.split('.')[0] || 'User'} 👋
          </h1>
          <p style={{
            fontSize: 'clamp(16px, 2vw, 18px)',
            color: '#6B7280',
            margin: '0',
            fontWeight: '400'
          }}>
            Ready to test and grow your store today?
          </p>
        </div>

        {/* Key Metrics Tiles */}
        <div style={{
          display: 'flex',
          gap: 'clamp(16px, 2vw, 24px)',
          flexWrap: 'wrap',
          marginBottom: 'clamp(32px, 4vw, 40px)'
        }}>
          {/* Active Experiments Tile */}
          <div style={{
            flex: '1 1 clamp(200px, 25vw, 300px)',
            background: '#E0F2FE',
            padding: 'clamp(20px, 2.5vw, 28px)',
            borderRadius: '16px',
            border: '1px solid #B3E5FC',
            position: 'relative',
            minHeight: 'clamp(140px, 18vh, 180px)'
          }}>
            <div style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: 'clamp(8px, 1vw, 12px)'
            }}>3</div>
            <div style={{
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: 'clamp(4px, 0.5vw, 8px)'
            }}>Active Experiments</div>
            <div style={{
              fontSize: 'clamp(12px, 1.4vw, 14px)',
              color: '#2563EB',
              fontWeight: '600',
              marginBottom: 'clamp(2px, 0.3vw, 4px)'
            }}>+30%</div>
            <div style={{
              fontSize: 'clamp(11px, 1.2vw, 12px)',
              color: '#6B7280'
            }}>This month</div>
            <div style={{
              position: 'absolute',
              bottom: 'clamp(12px, 1.5vw, 16px)',
              right: 'clamp(12px, 1.5vw, 16px)',
              width: 'clamp(24px, 3vw, 32px)',
              height: 'clamp(24px, 3vw, 32px)',
              background: '#B3E5FC',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(12px, 1.5vw, 16px)'
            }}>📈</div>
          </div>

          {/* Winning Variants Found Tile */}
          <div style={{
            flex: '1 1 clamp(200px, 25vw, 300px)',
            background: '#E0F2FE',
            padding: 'clamp(20px, 2.5vw, 28px)',
            borderRadius: '16px',
            border: '1px solid #B3E5FC',
            position: 'relative',
            minHeight: 'clamp(140px, 18vh, 180px)'
          }}>
            <div style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: 'clamp(8px, 1vw, 12px)'
            }}>34</div>
            <div style={{
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: 'clamp(4px, 0.5vw, 8px)'
            }}>Winning Variants Found</div>
            <div style={{
              fontSize: 'clamp(12px, 1.4vw, 14px)',
              color: '#2563EB',
              fontWeight: '600',
              marginBottom: 'clamp(2px, 0.3vw, 4px)'
            }}>+15%</div>
            <div style={{
              fontSize: 'clamp(11px, 1.2vw, 12px)',
              color: '#6B7280'
            }}>This month</div>
            <div style={{
              position: 'absolute',
              bottom: 'clamp(12px, 1.5vw, 16px)',
              right: 'clamp(12px, 1.5vw, 16px)',
              width: 'clamp(24px, 3vw, 32px)',
              height: 'clamp(24px, 3vw, 32px)',
              background: '#B3E5FC',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(12px, 1.5vw, 16px)'
            }}>📈</div>
          </div>

          {/* Revenue Impact Tile */}
          <div style={{
            flex: '1 1 clamp(200px, 25vw, 300px)',
            background: '#E0F2FE',
            padding: 'clamp(20px, 2.5vw, 28px)',
            borderRadius: '16px',
            border: '1px solid #B3E5FC',
            position: 'relative',
            minHeight: 'clamp(140px, 18vh, 180px)'
          }}>
            <div style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: 'clamp(8px, 1vw, 12px)'
            }}>+12%</div>
            <div style={{
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: 'clamp(4px, 0.5vw, 8px)'
            }}>Revenue Impact</div>
            <div style={{
              fontSize: 'clamp(12px, 1.4vw, 14px)',
              color: '#2563EB',
              fontWeight: '600',
              marginBottom: 'clamp(2px, 0.3vw, 4px)'
            }}>+23%</div>
            <div style={{
              fontSize: 'clamp(11px, 1.2vw, 12px)',
              color: '#6B7280'
            }}>This month</div>
            <div style={{
              position: 'absolute',
              bottom: 'clamp(12px, 1.5vw, 16px)',
              right: 'clamp(12px, 1.5vw, 16px)',
              width: 'clamp(24px, 3vw, 32px)',
              height: 'clamp(24px, 3vw, 32px)',
              background: '#B3E5FC',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(12px, 1.5vw, 16px)'
            }}>📈</div>
          </div>
        </div>

        {/* Experiment Overview Section */}
        <div style={{
          background: '#FFFFFF',
          padding: 'clamp(20px, 2.5vw, 28px)',
          borderRadius: '16px',
          border: '1px solid #E5E7EB',
          marginBottom: 'clamp(24px, 3vw, 32px)'
        }}>
          <h2 style={{
            fontSize: 'clamp(18px, 2.2vw, 20px)',
            fontWeight: '600',
            color: '#1F2937',
            margin: '0 0 clamp(16px, 2vw, 20px) 0'
          }}>Experiment Overview</h2>
          
          {/* Graph Placeholder */}
          <div style={{
            height: 'clamp(200px, 25vh, 300px)',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'clamp(12px, 1.5vw, 16px)'
          }}>
            <div style={{
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              color: '#6B7280',
              textAlign: 'center'
            }}>
              📊 Experiment Performance Graph<br/>
              <span style={{ fontSize: 'clamp(12px, 1.4vw, 14px)' }}>Variant A vs Variant B comparison</span>
            </div>
          </div>
          
          {/* Graph Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(8px, 1vw, 12px)',
            justifyContent: 'flex-end'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(4px, 0.5vw, 6px)',
              fontSize: 'clamp(12px, 1.4vw, 14px)',
              color: '#1F2937'
            }}>
              <div style={{
                width: 'clamp(8px, 1vw, 10px)',
                height: 'clamp(8px, 1vw, 10px)',
                background: '#10B981',
                borderRadius: '50%'
              }}></div>
              All experiments
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(4px, 0.5vw, 6px)',
              fontSize: 'clamp(12px, 1.4vw, 14px)',
              color: '#6B7280'
            }}>
              <div style={{
                width: 'clamp(8px, 1vw, 10px)',
                height: 'clamp(8px, 1vw, 10px)',
                background: '#6B7280',
                borderRadius: '50%'
              }}></div>
              Selected experiment
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div style={{
          background: '#FFFFFF',
          padding: 'clamp(20px, 2.5vw, 28px)',
          borderRadius: '16px',
          border: '1px solid #E5E7EB',
          marginBottom: 'clamp(24px, 3vw, 32px)'
        }}>
          <h2 style={{
            fontSize: 'clamp(18px, 2.2vw, 20px)',
            fontWeight: '600',
            color: '#1F2937',
            margin: '0 0 clamp(16px, 2vw, 20px) 0'
          }}>Recent Activity</h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(12px, 1.5vw, 16px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(12px, 1.5vw, 16px)'
            }}>
              <div style={{
                width: 'clamp(8px, 1vw, 10px)',
                height: 'clamp(8px, 1vw, 10px)',
                background: '#F97316',
                borderRadius: '50%',
                flexShrink: 0
              }}></div>
              <span style={{
                fontSize: 'clamp(14px, 1.8vw, 16px)',
                color: '#1F2937'
              }}>Variant B beat Variant A by 9% yesterday.</span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(12px, 1.5vw, 16px)'
            }}>
              <div style={{
                width: 'clamp(8px, 1vw, 10px)',
                height: 'clamp(8px, 1vw, 10px)',
                background: '#F97316',
                borderRadius: '50%',
                flexShrink: 0
              }}></div>
              <span style={{
                fontSize: 'clamp(14px, 1.8vw, 16px)',
                color: '#1F2937'
              }}>Experiment 'Cart Upsell' reached 95% confidence.</span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(12px, 1.5vw, 16px)'
            }}>
              <div style={{
                width: 'clamp(8px, 1vw, 10px)',
                height: 'clamp(8px, 1vw, 10px)',
                background: '#F97316',
                borderRadius: '50%',
                flexShrink: 0
              }}></div>
              <span style={{
                fontSize: 'clamp(14px, 1.8vw, 16px)',
                color: '#1F2937'
              }}>New experiment added to queue.</span>
            </div>
          </div>
        </div>

        {/* Legend Scientist Achievement Badge */}
        <div style={{
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
          padding: 'clamp(24px, 3vw, 32px)',
          borderRadius: '16px',
          border: '1px solid #059669',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'clamp(16px, 2vw, 24px)'
        }}>
          {/* Left Side - Achievement Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(12px, 1.5vw, 16px)',
            flex: '1 1 clamp(200px, 30vw, 300px)'
          }}>
            <div style={{
              width: 'clamp(48px, 6vw, 64px)',
              height: 'clamp(48px, 6vw, 64px)',
              background: '#2563EB',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(20px, 2.5vw, 24px)'
            }}>🏆</div>
            <div>
              <h3 style={{
                fontSize: 'clamp(18px, 2.2vw, 20px)',
                fontWeight: '700',
                color: '#FFFFFF',
                margin: '0 0 clamp(4px, 0.5vw, 6px) 0'
              }}>Legend Scientist</h3>
              <p style={{
                fontSize: 'clamp(12px, 1.4vw, 14px)',
                color: '#D1FAE5',
                margin: '0'
              }}>You've run a test for 60 days straight!</p>
            </div>
          </div>

          {/* Middle - Metrics */}
          <div style={{
            display: 'flex',
            gap: 'clamp(16px, 2vw, 24px)',
            flex: '1 1 clamp(200px, 30vw, 300px)',
            justifyContent: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(20px, 2.5vw, 24px)',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: 'clamp(2px, 0.3vw, 4px)'
              }}>23</div>
              <div style={{
                fontSize: 'clamp(10px, 1.2vw, 12px)',
                color: '#D1FAE5'
              }}>Tests this week</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(20px, 2.5vw, 24px)',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: 'clamp(2px, 0.3vw, 4px)'
              }}>156</div>
              <div style={{
                fontSize: 'clamp(10px, 1.2vw, 12px)',
                color: '#D1FAE5'
              }}>Total variants</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(20px, 2.5vw, 24px)',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: 'clamp(2px, 0.3vw, 4px)'
              }}>2,840</div>
              <div style={{
                fontSize: 'clamp(10px, 1.2vw, 12px)',
                color: '#D1FAE5'
              }}>Points earned</div>
            </div>
          </div>

          {/* Right Side - Next Goal */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'clamp(8px, 1vw, 12px)',
            flex: '1 1 clamp(150px, 20vw, 200px)'
          }}>
            <div style={{
              fontSize: 'clamp(12px, 1.4vw, 14px)',
              color: '#D1FAE5',
              textAlign: 'center'
            }}>Next Goal</div>
            <div style={{
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              fontWeight: '600',
              color: '#FFFFFF',
              textAlign: 'center'
            }}>Run 5 more tests</div>
            <div style={{
              width: 'clamp(32px, 4vw, 40px)',
              height: 'clamp(32px, 4vw, 40px)',
              background: '#F97316',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(16px, 2vw, 20px)'
            }}>🎯</div>
            <div style={{
              width: 'clamp(60px, 8vw, 80px)',
              height: 'clamp(4px, 0.5vw, 6px)',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '60%',
                height: '100%',
                background: '#FFFFFF',
                borderRadius: '3px'
              }}></div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
