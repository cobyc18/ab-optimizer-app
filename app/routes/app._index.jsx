import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import { useState } from "react";
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
  
  // Experiment creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [experimentData, setExperimentData] = useState({
    idea: null,
    product: null,
    variant: null,
    placement: null,
    name: '',
    description: ''
  });

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
          
          <button 
            onClick={() => setShowCreateModal(true)}
            style={{
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
          gap: '20px',
          alignItems: 'flex-start'
        }}>
          {/* Active Experiments Card */}
          <div style={{
            flex: 0.6,
            background: '#97CDFF',
            padding: '18px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
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
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
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
          </div>

          {/* Winning Variants Found Card */}
          <div style={{
            flex: 0.6,
            background: '#97CDFF',
            padding: '18px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
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
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
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
          </div>

          {/* Revenue Impact Card */}
          <div style={{
            flex: 0.6,
            background: '#97CDFF',
            padding: '18px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
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
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
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
          </div>

          {/* What's New Section - Part of Background */}
          <div style={{
            flex: 1.8,
            padding: '0 0 0 0'
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
                  You can now see which version is winning faster — no more guessing!
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
                  Cleaner graphs to understand your results at a glance
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
                  Easier setup flow — launch a new test in just 2 clicks
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
                  Shopify sync improved — your products and pages show up instantly
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
                  Added tooltips & guides so you always know what each number means
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{
          padding: '0 40px 40px 25px',
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-start'
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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
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
                    position: 'relative',
                    display: 'inline-block'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      background: '#6B7280',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '10px',
                      color: '#FFFFFF',
                      fontWeight: 'bold'
                    }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.nextElementSibling;
                      if (tooltip) tooltip.style.display = 'block';
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.nextElementSibling;
                      if (tooltip) tooltip.style.display = 'none';
                    }}>
                      i
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#1F2937',
                      color: '#FFFFFF',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '5px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      Conversion rate over time for all experiments. Hover over data points to see detailed metrics.
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '0',
                        height: '0',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid #1F2937'
                      }}></div>
                    </div>
                  </div>
                </div>
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
              
              {/* Graph Area - No Background */}
              <div style={{
                height: '200px',
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
                  <span>5%</span>
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
                  {/* Variant A line (yellow/gold - sine wave pattern) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,120 50,100 100,80 150,100 200,120 250,100 300,80 350,100 400,120 450,100"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2"
                    />
                    <circle cx="0" cy="120" r="3" fill="#F59E0B" />
                    <circle cx="50" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="100" cy="80" r="3" fill="#F59E0B" />
                    <circle cx="150" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="200" cy="120" r="3" fill="#F59E0B" />
                    <circle cx="250" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="300" cy="80" r="3" fill="#F59E0B" />
                    <circle cx="350" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="400" cy="120" r="3" fill="#F59E0B" />
                    <circle cx="450" cy="100" r="3" fill="#F59E0B" />
                  </svg>
                  
                  {/* Variant B line (blue - sine wave pattern) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,140 50,120 100,100 150,120 200,140 250,120 300,100 350,120 400,140 450,120"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                    <circle cx="0" cy="140" r="3" fill="#3B82F6" />
                    <circle cx="50" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="100" cy="100" r="3" fill="#3B82F6" />
                    <circle cx="150" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="200" cy="140" r="3" fill="#3B82F6" />
                    <circle cx="250" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="300" cy="100" r="3" fill="#3B82F6" />
                    <circle cx="350" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="400" cy="140" r="3" fill="#3B82F6" />
                    <circle cx="450" cy="120" r="3" fill="#3B82F6" />
                  </svg>
                  
                  {/* Control line (grey dotted) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,100 50,95 100,100 150,90 200,85 250,80 300,75 350,80 400,70 450,65"
                      fill="none"
                      stroke="#6B7280"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      opacity="0.4"
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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#6B7280',
                    borderRadius: '50%',
                    opacity: '0.4'
                  }}></div>
                  <span style={{
                    fontSize: '12px',
                    color: '#1F2937'
                  }}>Control</span>
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
                    Variant B beat Variant A by 11% in CTR (Product Page Banner Test)
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
                    Experiment "Cart Upsell Offer" reached 97% statistical significance
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
                    New experiment started: "Homepage Hero Image" (running 3 variants)
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
                    Test "Buy Now Button Color" completed — Winner: Variant A (+6% conversions)
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
                    User milestone unlocked: 🎉 10 successful experiments this month
                  </span>
                </div>
              </div>
            </div>

            {/* Legend Scientist Card */}
            <div style={{
              background: '#0038FF',
              padding: '24px',
              borderRadius: '12px',
              color: '#FFFFFF',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '180px'
            }}>
              {/* Top Row - Badge + Title + Mini Containers */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '16px'
              }}>
                {/* Left Section - Large Badge + Title */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '45px',
                    height: '45px',
                    background: '#FFFFFF',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    🏆
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      margin: '0 0 2px 0'
                    }}>
                      Legend Scientist
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      margin: '0',
                      opacity: 0.9
                    }}>
                      Current level/title
                    </p>
                  </div>
                </div>

                {/* Spacer to push mini containers to the right */}
                <div style={{ flex: 1 }}></div>

                {/* Right Section - Mini Containers */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    minWidth: '70px'
                  }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      marginBottom: '2px'
                    }}>
                      23
                    </div>
                    <div style={{
                      fontSize: '9px',
                      opacity: 0.8
                    }}>
                      Tests Run (lifetime)
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    minWidth: '70px'
                  }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      marginBottom: '2px'
                    }}>
                      8
                    </div>
                    <div style={{
                      fontSize: '9px',
                      opacity: 0.8
                    }}>
                      Winners Pushed (lifetime)
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Row - Progress Bar */}
              <div style={{
                marginBottom: '16px'
              }}>
                <div style={{
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    opacity: 0.9
                  }}>
                    150 pts to go
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '60%',
                    height: '100%',
                    background: '#FFFFFF',
                    borderRadius: '4px'
                  }}></div>
                </div>
              </div>

              {/* Bottom Row - Mini Badges */}
              <div style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🎉 First Winner Found
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🚀 5 Experiments Launched
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  👥 1000 Visitors Tested
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🔥 Streak: 4 Weeks Testing
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Aligned with What's New */}
          <div style={{
            flex: 1,
            paddingTop: '0',
            paddingLeft: '0'
          }}>
            {/* New Test Ideas - Part of Background */}
            <div style={{
              padding: '0 0 24px 0',
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
                <div style={{
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
                      Try a free shipping badge under product prices
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Often boosts conversion by 8–12%
                    </div>
                  </div>
                </div>
                
                <div style={{
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
                    ⏰
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Test a countdown timer on cart page
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Can increase checkout completion by 5–7%
                    </div>
                  </div>
                </div>
                
                <div style={{
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
                    🖼️
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Swap product images with lifestyle shots vs. plain backgrounds
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Great for A/B testing CTR
                    </div>
                  </div>
                </div>
                
                <div style={{
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
                    🛡️
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Add a trust badge near the "Buy Now" button
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Improves buyer confidence
                    </div>
                  </div>
                </div>
                
                <div style={{
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
                    📝
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Experiment with short vs. long product descriptions
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Test which drives more add-to-cart
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Features - Part of Background */}
            <div style={{
              padding: '0'
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
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Multi-variant testing (beyond A/B) → run A/B/C/D tests simultaneously
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
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    AI-powered test suggestions tailored to your store data
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
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Auto-rollout winners → automatically publish winning variant to your store
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
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Deeper analytics: segment results by device, country, or traffic source
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
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    One-click report export to PDF & Google Slides for sharing results
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Experiment Creation Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid #E5E5E5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1F2937',
                margin: 0
              }}>
                Create New Experiment
              </h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6B7280'
                }}>
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '32px'
            }}>
              {currentStep === 1 && (
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Pick an idea to test
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    Choose what you'd like to experiment with. We'll guide you through the rest.
                  </p>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px'
                  }}>
                    <div 
                      onClick={() => setExperimentData({...experimentData, idea: 'free-shipping'})}
                      style={{
                        padding: '20px',
                        border: experimentData.idea === 'free-shipping' ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: experimentData.idea === 'free-shipping' ? '#F0F9FF' : '#FFFFFF'
                      }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: '#10B981',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          🚚
                        </div>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          Free Shipping Badge
                        </h4>
                      </div>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0
                      }}>
                        Test adding a "Free shipping" badge under product prices. Often boosts conversion by 8-12%.
                      </p>
                    </div>

                    <div 
                      onClick={() => setExperimentData({...experimentData, idea: 'countdown-timer'})}
                      style={{
                        padding: '20px',
                        border: experimentData.idea === 'countdown-timer' ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: experimentData.idea === 'countdown-timer' ? '#F0F9FF' : '#FFFFFF'
                      }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: '#10B981',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          ⏰
                        </div>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          Countdown Timer
                        </h4>
                      </div>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0
                      }}>
                        Test a countdown timer on cart page. Can increase checkout completion by 5-7%.
                      </p>
                    </div>

                    <div 
                      onClick={() => setExperimentData({...experimentData, idea: 'trust-badge'})}
                      style={{
                        padding: '20px',
                        border: experimentData.idea === 'trust-badge' ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: experimentData.idea === 'trust-badge' ? '#F0F9FF' : '#FFFFFF'
                      }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: '#10B981',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          🛡️
                        </div>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          Trust Badge
                        </h4>
                      </div>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0
                      }}>
                        Add a trust badge near the "Buy Now" button to improve buyer confidence.
                      </p>
                    </div>

                    <div 
                      onClick={() => setExperimentData({...experimentData, idea: 'product-images'})}
                      style={{
                        padding: '20px',
                        border: experimentData.idea === 'product-images' ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: experimentData.idea === 'product-images' ? '#F0F9FF' : '#FFFFFF'
                      }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: '#10B981',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          🖼️
                        </div>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          Product Images
                        </h4>
                      </div>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0
                      }}>
                        Test lifestyle shots vs. plain backgrounds for better click-through rates.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Choose a product to test
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    Select which product you'd like to run this experiment on.
                  </p>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '16px'
                  }}>
                    {['Best Seller T-Shirt', 'Premium Coffee Mug', 'Wireless Headphones', 'Organic Soap Set'].map((product, index) => (
                      <div 
                        key={index}
                        onClick={() => setExperimentData({...experimentData, product: product})}
                        style={{
                          padding: '16px',
                          border: experimentData.product === product ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: experimentData.product === product ? '#F0F9FF' : '#FFFFFF'
                        }}>
                        <div style={{
                          width: '100%',
                          height: '120px',
                          background: '#F3F4F6',
                          borderRadius: '6px',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px'
                        }}>
                          📦
                        </div>
                        <h4 style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: '0 0 4px 0'
                        }}>
                          {product}
                        </h4>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: 0
                        }}>
                          $29.99
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Choose your variant
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    Pick what you want to test against the original.
                  </p>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px'
                  }}>
                    <div 
                      onClick={() => setExperimentData({...experimentData, variant: 'original'})}
                      style={{
                        padding: '20px',
                        border: experimentData.variant === 'original' ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: experimentData.variant === 'original' ? '#F0F9FF' : '#FFFFFF'
                      }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: '0 0 8px 0'
                      }}>
                        Original (Control)
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0
                      }}>
                        Keep the current version as your baseline for comparison.
                      </p>
                    </div>

                    <div 
                      onClick={() => setExperimentData({...experimentData, variant: 'new'})}
                      style={{
                        padding: '20px',
                        border: experimentData.variant === 'new' ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: experimentData.variant === 'new' ? '#F0F9FF' : '#FFFFFF'
                      }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: '0 0 8px 0'
                      }}>
                        New Variant
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0
                      }}>
                        Test your new idea against the original to see which performs better.
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '8px'
                    }}>
                      Where should this appear?
                    </label>
                    <select 
                      value={experimentData.placement || ''}
                      onChange={(e) => setExperimentData({...experimentData, placement: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}>
                      <option value="">Select placement...</option>
                      <option value="product-page">Product page</option>
                      <option value="cart-page">Cart page</option>
                      <option value="checkout-page">Checkout page</option>
                      <option value="homepage">Homepage</option>
                    </select>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Review & Launch
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    Review your experiment settings and launch when ready.
                  </p>
                  
                  <div style={{
                    background: '#F9FAFB',
                    padding: '20px',
                    borderRadius: '8px',
                    marginBottom: '24px'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937',
                      margin: '0 0 16px 0'
                    }}>
                      Experiment Summary
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', color: '#6B7280' }}>Test idea:</span>
                        <span style={{ fontSize: '14px', color: '#1F2937', fontWeight: '500' }}>
                          {experimentData.idea === 'free-shipping' ? 'Free Shipping Badge' :
                           experimentData.idea === 'countdown-timer' ? 'Countdown Timer' :
                           experimentData.idea === 'trust-badge' ? 'Trust Badge' :
                           experimentData.idea === 'product-images' ? 'Product Images' : 'Not selected'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', color: '#6B7280' }}>Product:</span>
                        <span style={{ fontSize: '14px', color: '#1F2937', fontWeight: '500' }}>
                          {experimentData.product || 'Not selected'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', color: '#6B7280' }}>Placement:</span>
                        <span style={{ fontSize: '14px', color: '#1F2937', fontWeight: '500' }}>
                          {experimentData.placement || 'Not selected'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isAdvanced && (
                    <div style={{
                      background: '#F0F9FF',
                      padding: '20px',
                      borderRadius: '8px',
                      marginBottom: '24px'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: '0 0 16px 0'
                      }}>
                        Advanced Settings
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1F2937',
                            marginBottom: '8px'
                          }}>
                            Traffic Split
                          </label>
                          <select style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}>
                            <option value="50-50">50% / 50% (Recommended)</option>
                            <option value="80-20">80% / 20%</option>
                            <option value="90-10">90% / 10%</option>
                          </select>
                        </div>
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1F2937',
                            marginBottom: '8px'
                          }}>
                            End Rules
                          </label>
                          <select style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}>
                            <option value="manual">End manually</option>
                            <option value="significance">End when statistically significant</option>
                            <option value="duration">End after 30 days</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Navigation Bar */}
            <div style={{
              padding: '20px 32px',
              borderTop: '1px solid #E5E5E5',
              background: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Step Progress */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: step <= currentStep ? '#3B82F6' : '#E5E5E5'
                    }}
                  />
                ))}
              </div>

              {/* Advanced Toggle */}
              <button 
                onClick={() => setIsAdvanced(!isAdvanced)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                Advanced {isAdvanced ? '▲' : '▼'}
              </button>

              {/* Navigation Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                {currentStep > 1 && (
                  <button 
                    onClick={() => setCurrentStep(currentStep - 1)}
                    style={{
                      padding: '8px 16px',
                      background: 'none',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#6B7280',
                      cursor: 'pointer'
                    }}>
                    Back
                  </button>
                )}
                
                {currentStep < 4 ? (
                  <button 
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={!experimentData.idea || (currentStep === 2 && !experimentData.product) || (currentStep === 3 && (!experimentData.variant || !experimentData.placement))}
                    style={{
                      padding: '8px 16px',
                      background: '#3B82F6',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      opacity: (!experimentData.idea || (currentStep === 2 && !experimentData.product) || (currentStep === 3 && (!experimentData.variant || !experimentData.placement))) ? 0.5 : 1
                    }}>
                    Next
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      // Launch experiment logic here
                      setShowCreateModal(false);
                      setCurrentStep(1);
                      setExperimentData({
                        idea: null,
                        product: null,
                        variant: null,
                        placement: null,
                        name: '',
                        description: ''
                      });
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#10B981',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#FFFFFF',
                      cursor: 'pointer'
                    }}>
                    Launch Experiment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
