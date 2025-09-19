import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
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

  return json({ stats });
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

export default function TryLabDashboard() {
  const { stats } = useLoaderData();
  const { user } = useOutletContext();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex'
    }}>
      {/* Left Sidebar */}
      <div style={{
        width: '280px',
        background: '#FFFFFF',
        borderRight: '1px solid #E5E5E5',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 10
      }}>
        {/* Logo Section */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#1E40AF',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>🧪</span>
          </div>
          <span style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1F2937'
          }}>TryLab</span>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: '24px 0'
        }}>
          <div style={{
            padding: '12px 24px',
            background: '#3B82F6',
            color: '#FFFFFF',
            margin: '0 16px 8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            <span style={{ marginRight: '12px' }}>🏠</span>
            Home
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>📊</span>
            Experiments Hub
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>📈</span>
            Insights & Reports
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>🧩</span>
            Widget Library
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>⚙️</span>
            Settings
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>❓</span>
            Help/Onboarding
          </div>
        </nav>

        {/* Trial Information Box */}
        <div style={{
          margin: '16px',
          padding: '20px',
          background: '#F97316',
          borderRadius: '12px',
          color: '#FFFFFF'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            marginBottom: '8px'
          }}>
            You have 9 days on the Pro free trial
          </div>
          <div style={{
            fontSize: '12px',
            marginBottom: '16px',
            opacity: 0.9
          }}>
            Usage is unlimited while on trial and will reset when the trial ends.
          </div>
          <button style={{
            width: '100%',
            padding: '10px',
            background: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            Upgrade your free trial →
          </button>
        </div>

        {/* Logout */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center',
          color: '#6B7280',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          <span style={{ marginRight: '12px' }}>🚪</span>
          Log out
        </div>
      </div>

      {/* Main Content Area - Full Width */}
      <div style={{
        marginLeft: '280px',
        width: 'calc(100vw - 280px)',
        minHeight: '100vh',
        background: '#F5F5F5',
        padding: '0'
      }}>
        {/* Header Section */}
        <div style={{
          padding: '32px 40px 24px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1F2937',
              margin: '0 0 8px 0'
            }}>
              Welcome Back, {user?.firstName || 'Zac'} 👋
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#6B7280',
              margin: '0'
            }}>
              Ready to test and grow your store today?
            </p>
          </div>
          
          <button style={{
            padding: '12px 24px',
            background: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}>
            + New Experiment
          </button>
        </div>

        {/* Top Row: Three Blue Cards + What's New */}
        <div style={{
          padding: '0 40px 32px 40px',
          display: 'flex',
          gap: '20px'
        }}>
          {/* Active Experiments Card */}
          <div style={{
            flex: 1,
            background: '#DBEAFE',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '8px'
            }}>
              3
            </div>
            <div style={{
              fontSize: '14px',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
              Active Experiments
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#059669',
                fontWeight: '600'
              }}>
                + 30%
              </span>
              <span style={{
                fontSize: '12px',
                color: '#1F2937'
              }}>
                This month
              </span>
            </div>
            <div style={{
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <div style={{
                width: '24px',
                height: '16px',
                background: '#3B82F6',
                borderRadius: '2px',
                opacity: 0.3
              }}></div>
            </div>
          </div>

          {/* Winning Variants Found Card */}
          <div style={{
            flex: 1,
            background: '#DBEAFE',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '8px'
            }}>
              34
            </div>
            <div style={{
              fontSize: '14px',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
              Winning Variants Found
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#059669',
                fontWeight: '600'
              }}>
                + 15%
              </span>
              <span style={{
                fontSize: '12px',
                color: '#1F2937'
              }}>
                This month
              </span>
            </div>
            <div style={{
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <div style={{
                width: '24px',
                height: '16px',
                background: '#3B82F6',
                borderRadius: '2px',
                opacity: 0.3
              }}></div>
            </div>
          </div>

          {/* Revenue Impact Card */}
          <div style={{
            flex: 1,
            background: '#DBEAFE',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '8px'
            }}>
              +12%
            </div>
            <div style={{
              fontSize: '14px',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
              Revenue Impact
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#059669',
                fontWeight: '600'
              }}>
                + 23%
              </span>
              <span style={{
                fontSize: '12px',
                color: '#1F2937'
              }}>
                This month
              </span>
            </div>
            <div style={{
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <div style={{
                width: '24px',
                height: '16px',
                background: '#3B82F6',
                borderRadius: '2px',
                opacity: 0.3
              }}></div>
            </div>
          </div>

          {/* What's New Section - Part of Background */}
          <div style={{
            flex: 1,
            padding: '24px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1F2937',
              margin: '0 0 20px 0'
            }}>
              Whats New
            </h2>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    List of New features added recently
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{
          padding: '0 40px 40px 40px',
          display: 'flex',
          gap: '24px'
        }}>
          {/* Left Column */}
          <div style={{
            flex: 2
          }}>
            {/* Experiment Overview Graph - Part of Background */}
            <div style={{
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1F2937',
                  margin: '0'
                }}>
                  Experiment Overview
                </h2>
                <div style={{
                  display: 'flex',
                  background: '#F3F4F6',
                  borderRadius: '6px',
                  padding: '2px'
                }}>
                  <div style={{
                    padding: '6px 12px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    All experiments
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    color: '#6B7280',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    Selected experiment
                  </div>
                </div>
              </div>
              
              {/* Graph Area */}
              <div style={{
                height: '200px',
                background: '#F9FAFB',
                borderRadius: '8px',
                padding: '16px',
                position: 'relative'
              }}>
                {/* Y-axis labels */}
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: '16px',
                  bottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#6B7280'
                }}>
                  <span>4%</span>
                  <span>3%</span>
                  <span>2%</span>
                  <span>1%</span>
                  <span>0%</span>
                </div>
                
                {/* Graph lines */}
                <div style={{
                  position: 'absolute',
                  left: '60px',
                  right: '16px',
                  top: '16px',
                  bottom: '16px'
                }}>
                  {/* Variant A line (blue dotted) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,80 50,60 100,70 150,50 200,40 250,30 300,20 350,25 400,15 450,10"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  </svg>
                  
                  {/* Variant B line (yellow dotted) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,90 50,75 100,85 150,65 200,55 250,45 300,35 350,40 400,30 450,25"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  </svg>
                </div>
                
                {/* X-axis labels */}
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '60px',
                  right: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#6B7280'
                }}>
                  <span>JAN</span>
                  <span>FEB</span>
                  <span>MAR</span>
                  <span>APR</span>
                  <span>MAY</span>
                  <span>JUN</span>
                  <span>JUL</span>
                  <span>AUG</span>
                  <span>SEP</span>
                  <span>OCT</span>
                  <span>NOV</span>
                  <span>DEC</span>
                </div>
              </div>
              
              {/* Legend */}
              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '12px',
                    color: '#1F2937'
                  }}>Variant A</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#F59E0B',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '12px',
                    color: '#1F2937'
                  }}>Variant B</span>
                </div>
              </div>
            </div>

            {/* Recent Activity - Part of Background */}
            <div style={{
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                margin: '0 0 20px 0'
              }}>
                Recent Activity
              </h2>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Variant B beat Variant A by 9% yesterday
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Experiment 'Cart Upsell' reached 95% confidence
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    New experiment added to queue
                  </span>
                </div>
              </div>
            </div>

            {/* Badge Cards */}
            <div style={{
              display: 'flex',
              gap: '16px'
            }}>
              {/* Legend Scientist Card */}
              <div style={{
                flex: 1,
                background: '#22C55E',
                padding: '24px',
                borderRadius: '12px',
                color: '#FFFFFF',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  width: '32px',
                  height: '32px',
                  background: '#FFFFFF',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  🏆
                </div>
                
                <div style={{
                  marginTop: '40px',
                  marginBottom: '16px'
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    margin: '0 0 8px 0'
                  }}>
                    Legend Scientist
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    margin: '0',
                    opacity: 0.9
                  }}>
                    You've run a test for 60 days straight!
                  </p>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '20px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700'
                    }}>23</div>
                    <div style={{
                      fontSize: '10px',
                      opacity: 0.8
                    }}>Tests this week</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700'
                    }}>156</div>
                    <div style={{
                      fontSize: '10px',
                      opacity: 0.8
                    }}>Total variants</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700'
                    }}>2,840</div>
                    <div style={{
                      fontSize: '10px',
                      opacity: 0.8
                    }}>Points earned</div>
                  </div>
                </div>
              </div>

              {/* Next Goal Card */}
              <div style={{
                flex: 1,
                background: '#16A34A',
                padding: '24px',
                borderRadius: '12px',
                color: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '24px',
                  marginBottom: '12px'
                }}>
                  🎯
                </div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  margin: '0 0 8px 0'
                }}>
                  Next Goal
                </h3>
                <p style={{
                  fontSize: '14px',
                  margin: '0',
                  opacity: 0.9
                }}>
                  Run 5 more tests
                </p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{
            flex: 1
          }}>
            {/* New Test Ideas - Part of Background */}
            <div style={{
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                margin: '0 0 20px 0'
              }}>
                New Test Ideas
              </h2>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      background: '#10B981',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: '#FFFFFF',
                      flexShrink: 0
                    }}>
                      🚚
                    </div>
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '4px'
                      }}>
                        Shipping Badge Widget Times indicated in Shipping Badge
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6B7280'
                      }}>
                        Adding our Shipping Badge bellow A2C can increase CVR by +5%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Features - Part of Background */}
            <div style={{
              padding: '24px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                margin: '0 0 20px 0'
              }}>
                Upcoming Features
              </h2>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  background: '#3B82F6',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#FFFFFF'
                }}>
                  🚀
                </div>
                <span style={{
                  fontSize: '14px',
                  color: '#1F2937'
                }}>
                  List of New features added recently
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
