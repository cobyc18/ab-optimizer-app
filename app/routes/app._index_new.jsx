import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import ThemeEditorEmbed from "../components/ThemeEditorEmbed.jsx";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Fetch Shopify products
  const productsResponse = await admin.rest.get({
    path: '/products.json',
    query: { limit: 50 }
  });
  
  const products = productsResponse.body.products || [];
  
  // Fetch theme information
  const themesResponse = await admin.rest.get({
    path: '/themes.json'
  });
  
  const themes = themesResponse.body.themes || [];
  const currentTheme = themes.find(theme => theme.role === 'main') || themes[0];
  
  return json({
    products,
    themeInfo: currentTheme ? {
      themeId: currentTheme.id,
      themeName: currentTheme.name,
      themeRole: currentTheme.role
    } : null
  });
};

export default function Index() {
  const { products, themeInfo } = useLoaderData();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [placementGuideOpen, setPlacementGuideOpen] = useState(false);
  const [themePreviewMode, setThemePreviewMode] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({ x: 100, y: 100 });
  const [draggedElement, setDraggedElement] = useState(null);
  const [themePreviewData, setThemePreviewData] = useState(null);

  // A/B Test Ideas
  const abTestIdeas = [
    {
      id: 1,
      utility: 'Social Proof',
      rationale: 'Shows recent purchases, increases trust by 12-15%',
      style: 'Elegant',
      preview: '👥 127 people bought this in the last 24 hours'
    },
    {
      id: 2,
      utility: 'Urgency Scarcity',
      rationale: 'Creates FOMO, boosts conversion by 8-10%',
      style: 'Bold',
      preview: '⚡ Only 3 left in stock!'
    },
    {
      id: 3,
      utility: 'Countdown Timer',
      rationale: 'Creates urgency, boosts checkout by 5-7%',
      style: 'Energetic',
      preview: '⏰ Limited time offer!'
    },
    {
      id: 4,
      utility: 'Product Reviews',
      rationale: 'Builds credibility, increases sales by 18-22%',
      style: 'Trustworthy',
      preview: '⭐ 4.8/5 from 1,247 reviews'
    }
  ];

  // Theme Preview Functions
  const generateThemePreview = async (product, widget) => {
    if (!product || !widget) {
      console.log('❌ Missing product or widget:', { product, widget });
      return;
    }

    try {
      setThemePreviewMode(true);
      
      // Generate widget code based on the selected widget type
      let widgetCode = '';
      let snippetName = '';
      
      switch (widget) {
        case 'Social Proof':
          snippetName = 'social_proof_widget';
          widgetCode = `
<!-- Social Proof Widget -->
<div class="social-proof-widget" style="
  background: #F0F9FF;
  border: 1px solid #3B82F6;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  text-align: center;
">
  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
    <span style="font-size: 18px;">👥</span>
    <span style="font-weight: 600; color: #1E40AF;">
      127 people bought this in the last 24 hours
    </span>
  </div>
</div>`;
          break;
        case 'Urgency Scarcity':
          snippetName = 'urgency_scarcity_widget';
          widgetCode = `
<!-- Urgency Scarcity Widget -->
<div class="urgency-scarcity-widget" style="
  background: #FEF2F2;
  border: 1px solid #EF4444;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  text-align: center;
">
  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
    <span style="font-size: 18px;">⚡</span>
    <span style="font-weight: 600; color: #DC2626;">
      Only 3 left in stock!
    </span>
  </div>
</div>`;
          break;
        case 'Countdown Timer':
          snippetName = 'countdown_timer_widget';
          widgetCode = `
<!-- Countdown Timer Widget -->
<div class="countdown-timer-widget" style="
  background: #FFFBEB;
  border: 1px solid #F59E0B;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  text-align: center;
">
  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
    <span style="font-size: 18px;">⏰</span>
    <span style="font-weight: 600; color: #D97706;">
      Limited time offer!
    </span>
  </div>
</div>`;
          break;
        case 'Product Reviews':
          snippetName = 'product_reviews_widget';
          widgetCode = `
<!-- Product Reviews Widget -->
<div class="product-reviews-widget" style="
  background: #F0FDF4;
  border: 1px solid #10B981;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  text-align: center;
">
  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
    <span style="font-size: 18px;">⭐</span>
    <span style="font-weight: 600; color: #059669;">
      4.8/5 from 1,247 reviews
    </span>
  </div>
</div>`;
          break;
        default:
          snippetName = 'custom_widget';
          widgetCode = `<!-- Custom Widget -->`;
      }
      
      const response = await fetch('/api/theme-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeId: themeInfo?.themeId || 'default-theme',
          snippetName,
          snippetContent: widgetCode,
          widget,
          productId: product.id,
          position: widgetPosition
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setThemePreviewData({
          widget: { name: widget },
          widgetCode: data.widgetCode,
          themeEditorUrl: data.themeEditorUrl,
          installationInstructions: data.installationInstructions
        });
      } else {
        console.error('Failed to generate preview:', data.error);
      }
    } catch (error) {
      console.error('Error generating theme preview:', error);
    } finally {
      setThemePreviewMode(false);
    }
  };

  // Widget Drag Functions
  const handleWidgetDragStart = (e) => {
    setDraggedElement(e.target);
    e.target.style.opacity = '0.5';
  };

  const handleWidgetDrag = (e) => {
    if (!draggedElement) return;
    
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setWidgetPosition({ x, y });
  };

  const handleWidgetDragEnd = (e) => {
    if (draggedElement) {
      draggedElement.style.opacity = '1';
      setDraggedElement(null);
    }
  };

  const updateWidgetPosition = (position) => {
    setWidgetPosition(position);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          color: '#FFFFFF',
          padding: '32px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #E0E7FF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🚀 A/B Test Optimizer
          </h1>
          <p style={{
            fontSize: '16px',
            margin: 0,
            opacity: 0.9
          }}>
            Boost your conversion rates with data-driven widget experiments
          </p>
        </div>

        {/* Progress Bar */}
        <div style={{
          background: '#F8FAFC',
          padding: '24px 32px',
          borderBottom: '1px solid #E5E5E5'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: currentStep >= step ? '#4F46E5' : '#E5E5E5',
                  color: currentStep >= step ? '#FFFFFF' : '#9CA3AF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {step}
                </div>
                {step < 5 && (
                  <div style={{
                    width: '60px',
                    height: '2px',
                    background: currentStep > step ? '#4F46E5' : '#E5E5E5',
                    margin: '0 8px'
                  }} />
                )}
              </div>
            ))}
          </div>
          <div style={{
            fontSize: '14px',
            color: '#6B7280',
            textAlign: 'center'
          }}>
            Step {currentStep} of 5
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          padding: '32px'
        }}>
          {/* Step 1: Choose A/B Test Idea */}
          {currentStep === 1 && (
            <div style={{
              animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'translateX(0)',
              opacity: 1
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                Choose Your A/B Test Idea
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '24px'
              }}>
                Select a widget type that will help boost your conversion rates
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {abTestIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    onClick={() => setSelectedIdea(idea)}
                    style={{
                      background: selectedIdea?.id === idea.id ? '#F0F9FF' : '#FFFFFF',
                      border: selectedIdea?.id === idea.id ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                      borderRadius: '12px',
                      padding: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: selectedIdea?.id === idea.id ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '24px'
                      }}>
                        {idea.utility === 'Social Proof' && '👥'}
                        {idea.utility === 'Urgency Scarcity' && '⚡'}
                        {idea.utility === 'Countdown Timer' && '⏰'}
                        {idea.utility === 'Product Reviews' && '⭐'}
                      </div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0
                      }}>
                        {idea.utility}
                      </h4>
                    </div>
                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '12px',
                      lineHeight: '1.5'
                    }}>
                      {idea.rationale}
                    </p>
                    <div style={{
                      background: '#F9FAFB',
                      border: '1px solid #E5E5E5',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '13px',
                      color: '#374151',
                      fontStyle: 'italic'
                    }}>
                      Preview: {idea.preview}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Product */}
          {currentStep === 2 && (
            <div style={{
              animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'translateX(0)',
              opacity: 1
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                Select Product to Test
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '24px'
              }}>
                Choose which product page will display your {selectedIdea?.utility} widget
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px'
              }}>
                {products.slice(0, 12).map((product) => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    style={{
                      background: selectedProduct?.id === product.id ? '#F0F9FF' : '#FFFFFF',
                      border: selectedProduct?.id === product.id ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '8px'
                    }}>
                      {product.title}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '8px'
                    }}>
                      {product.vendor}
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#059669'
                    }}>
                      ${product.variants?.[0]?.price || '0.00'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Placement Guide */}
          {currentStep === 3 && (
            <div style={{
              animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'translateX(0)',
              opacity: 1
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                Widget Placement Guide
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '24px'
              }}>
                Learn where to place your {selectedIdea?.utility} widget for maximum impact
              </p>

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E5E5E5',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1F2937',
                  marginBottom: '16px'
                }}>
                  📍 Optimal Placement Locations
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {[
                    { position: 'Above Title', impact: 'High', reason: 'First impression' },
                    { position: 'After Price', impact: 'Very High', reason: 'Price justification' },
                    { position: 'Before Cart', impact: 'Very High', reason: 'Last chance' },
                    { position: 'After Description', impact: 'Medium', reason: 'Reinforcement' }
                  ].map((item, index) => (
                    <div key={index} style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E5E5',
                      borderRadius: '6px',
                      padding: '16px'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '4px'
                      }}>
                        {item.position}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        marginBottom: '8px'
                      }}>
                        {item.reason}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        color: item.impact === 'Very High' ? '#DC2626' : item.impact === 'High' ? '#D97706' : '#059669',
                        background: item.impact === 'Very High' ? '#FEF2F2' : item.impact === 'High' ? '#FFFBEB' : '#F0FDF4',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        {item.impact} Impact
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setPlacementGuideOpen(true)}
                style={{
                  padding: '12px 24px',
                  background: '#3B82F6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✅ I understand the placement strategy
              </button>
            </div>
          )}

          {/* Step 4: Professional Theme Editor */}
          {currentStep === 4 && (
            <div style={{
              animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'translateX(0)',
              opacity: 1
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                Professional Theme Editor
              </h3>
              
              {!selectedProduct && (
                <div style={{
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      fontSize: '20px'
                    }}>
                      ⚠️
                    </div>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#92400E',
                      margin: 0
                    }}>
                      Product Selection Required
                    </h4>
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: '#92400E',
                    marginBottom: '16px',
                    lineHeight: '1.5'
                  }}>
                    You need to select a product before you can use the theme editor. Please go back and select a product first.
                  </p>
                  <button
                    onClick={() => setCurrentStep(2)}
                    style={{
                      padding: '8px 16px',
                      background: '#F59E0B',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Product Selection
                  </button>
                </div>
              )}
              
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '24px'
              }}>
                Experience the full Shopify theme editor within your app. Position your widget exactly where you want it.
              </p>

              {/* Professional Theme Editor */}
              {selectedProduct && selectedIdea && (
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E5E5',
                  borderRadius: '8px',
                  padding: '24px',
                  marginBottom: '24px',
                  position: 'relative'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #E5E5E5'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0
                      }}>
                        🎨 Professional Theme Editor
                      </h4>
                      <span style={{
                        background: '#10B981',
                        color: '#FFFFFF',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {selectedIdea.utility}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <button
                        onClick={() => generateThemePreview(selectedProduct, selectedIdea?.utility)}
                        style={{
                          padding: '8px 16px',
                          background: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        🚀 Launch Theme Editor
                      </button>
                    </div>
                  </div>

                  {/* Theme Editor Embed */}
                  {themePreviewData && (
                    <ThemeEditorEmbed
                      themeEditorUrl={themePreviewData.themeEditorUrl}
                      product={selectedProduct}
                      widget={selectedIdea.utility}
                      onWidgetPositionChange={updateWidgetPosition}
                      onThemeEditorReady={() => {
                        console.log('Theme editor is ready!');
                      }}
                    />
                  )}

                  {/* Widget Code Display */}
                  {themePreviewData && (
                    <div style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '20px',
                      marginTop: '20px'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '12px'
                      }}>
                        📋 Generated Widget Code
                      </h4>
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E5E5E5',
                        borderRadius: '6px',
                        padding: '16px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#374151',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {themePreviewData.widgetCode}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review & Launch */}
          {currentStep === 5 && (
            <div style={{
              animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'translateX(0)',
              opacity: 1
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                Review & Launch
              </h3>
              
              {/* Summary Card */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E5E5E5',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1F2937',
                  marginBottom: '16px'
                }}>
                  📊 A/B Test Summary
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '4px'
                    }}>
                      Widget Type
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937'
                    }}>
                      {selectedIdea?.utility}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '4px'
                    }}>
                      Product
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937'
                    }}>
                      {selectedProduct?.title}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '4px'
                    }}>
                      Expected Impact
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#059669'
                    }}>
                      {selectedIdea?.rationale}
                    </div>
                  </div>
                </div>
              </div>

              <button
                style={{
                  padding: '16px 32px',
                  background: '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                🚀 Launch A/B Test
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          background: '#F8FAFC',
          padding: '24px 32px',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            style={{
              padding: '8px 16px',
              background: currentStep === 1 ? '#F3F4F6' : '#FFFFFF',
              color: currentStep === 1 ? '#9CA3AF' : '#374151',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Previous
          </button>

          <div style={{
            fontSize: '14px',
            color: '#6B7280'
          }}>
            Step {currentStep} of 5
          </div>

          {currentStep < 5 ? (
            <button 
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!selectedIdea || (currentStep === 2 && !selectedProduct) || (currentStep === 3 && !placementGuideOpen) || (currentStep === 4 && !themePreviewData)}
              style={{
                padding: '8px 16px',
                background: '#3B82F6',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                color: '#FFFFFF'
              }}
            >
              Next →
            </button>
          ) : (
            <button
              style={{
                padding: '8px 16px',
                background: '#10B981',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                color: '#FFFFFF'
              }}
            >
              🚀 Launch Test
            </button>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes slideInFromRight {
            0% {
              transform: translateX(100%);
              opacity: 0;
            }
            100% {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `
      }} />
    </div>
  );
}
