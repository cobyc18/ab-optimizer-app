import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
// Using App Bridge modal for theme editor instead of custom iframe component

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Fetch Shopify products using GraphQL
  let products = [];
  try {
    const productsResponse = await admin.graphql(`
      query GetProducts {
        products(first: 50) {
          nodes {
            id
            title
            handle
            description
            descriptionHtml
            vendor
            productType
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
            featuredImage {
              url
              altText
              width
              height
            }
            images(first: 10) {
              nodes {
                url
                altText
                width
                height
              }
            }
            variants(first: 20) {
              nodes {
                id
                title
                price
                compareAtPrice
                availableForSale
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
                inventoryQuantity
              }
            }
            totalInventory
            createdAt
            updatedAt
            status
            tags
            seo {
              title
              description
            }
            options {
              id
              name
              values
            }
            onlineStorePreviewUrl
          }
        }
      }
    `);
    
    const productsJson = await productsResponse.json();
    products = productsJson.data.products.nodes;
    console.log("✅ Products fetched:", products.length);
  } catch (error) {
    console.error("❌ Error fetching products:", error);
  }
  
  // Fetch theme information using GraphQL
  let themeInfo = {};
  try {
    const themesResponse = await admin.graphql(`
      query GetThemes {
        themes(first: 10) {
          nodes {
            id
            name
            role
          }
        }
      }
    `);
    
    const themesJson = await themesResponse.json();
    const themes = themesJson.data.themes.nodes;
    const mainTheme = themes.find(t => t.role === "MAIN");
    
    themeInfo = {
      themeId: mainTheme?.id,
      themeName: mainTheme?.name,
      themeRole: mainTheme?.role
    };
    console.log("✅ Theme info fetched:", themeInfo);
  } catch (error) {
    console.error("❌ Error fetching theme info:", error);
  }
  
  // Create or get Storefront API access token
  let storefrontAccessToken = null;
  try {
    // First, try to get existing tokens
    const existingTokensResponse = await admin.graphql(`
      query GetStorefrontTokens {
        shop {
          storefrontAccessTokens(first: 10) {
            nodes {
              id
              accessToken
              title
              accessScopes {
                handle
              }
            }
          }
        }
      }
    `);
    
    const tokensData = await existingTokensResponse.json();
    const existingTokens = tokensData.data?.shop?.storefrontAccessTokens?.nodes || [];
    
    // Look for a token with the right scopes or create a new one
    let token = existingTokens.find(t => 
      t.accessScopes.some(scope => scope.handle.includes('unauthenticated_read_product_listings'))
    );
    
    if (!token) {
      // Create a new storefront access token
      const createTokenResponse = await admin.graphql(`
        mutation CreateStorefrontToken($input: StorefrontAccessTokenInput!) {
          storefrontAccessTokenCreate(input: $input) {
            storefrontAccessToken {
              accessToken
              title
              accessScopes {
                handle
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          input: {
            title: "A/B Optimizer App Storefront Access"
          }
        }
      });
      
      const createTokenData = await createTokenResponse.json();
      if (createTokenData.data?.storefrontAccessTokenCreate?.storefrontAccessToken) {
        token = createTokenData.data.storefrontAccessTokenCreate.storefrontAccessToken;
        console.log('✅ Created new Storefront API access token');
      } else {
        console.error('❌ Error creating Storefront API token:', createTokenData.data?.storefrontAccessTokenCreate?.userErrors);
      }
    } else {
      console.log('✅ Using existing Storefront API access token');
    }
    
    if (token) {
      storefrontAccessToken = token.accessToken;
      console.log('✅ Storefront access token:', storefrontAccessToken ? 'Found' : 'Not found');
    } else {
      console.warn('⚠️ No storefront access token available');
    }
  } catch (error) {
    console.error('❌ Error managing Storefront API token:', error);
  }

  return json({
    products,
    themeInfo,
    shop: session.shop,
    storefrontAccessToken
  });
};

export default function Index() {
  const { products, themeInfo, shop, storefrontAccessToken } = useLoaderData();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [placementGuideOpen, setPlacementGuideOpen] = useState(false);
  const [themePreviewMode, setThemePreviewMode] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({ x: 100, y: 100 });
  const [draggedElement, setDraggedElement] = useState(null);
  const [themePreviewData, setThemePreviewData] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productPreviewOpen, setProductPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);

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

  // Product Preview Functions
  const openProductPreview = (product) => {
    console.log('🔍 Opening product preview:', product.title);
    console.log('🏪 Shop:', shop);
    console.log('🔑 Access token:', storefrontAccessToken ? 'Available' : 'Missing');
    setPreviewProduct(product);
    setProductPreviewOpen(true);
  };

  const closeProductPreview = () => {
    setProductPreviewOpen(false);
    setPreviewProduct(null);
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

              {/* Product Search */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E5E5E5',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '20px'
                  }}>
                    🔍
                  </div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1F2937',
                    margin: 0
                  }}>
                    Search Products
                  </h4>
                </div>
                
                <input
                  type="text"
                  placeholder="Search by product name, vendor, or tags..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: '#FFFFFF',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3B82F6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#D1D5DB';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                
                {productSearchTerm && (
                  <div style={{
                    marginTop: '12px',
                    fontSize: '14px',
                    color: '#6B7280'
                  }}>
                    Found {products.filter(product => 
                      product.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                      product.vendor?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                      product.tags?.some(tag => tag.toLowerCase().includes(productSearchTerm.toLowerCase()))
                    ).length} products matching "{productSearchTerm}"
                  </div>
                )}
              </div>

              {products.filter(product => 
                product.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                product.vendor?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                product.tags?.some(tag => tag.toLowerCase().includes(productSearchTerm.toLowerCase()))
              ).length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '300px',
                  background: '#F9FAFB',
                  borderRadius: '8px',
                  border: '2px dashed #E5E5E5',
                  padding: '32px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px'
                  }}>
                    🔍
                  </div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    No Products Found
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '16px',
                    maxWidth: '400px'
                  }}>
                    No products match your search criteria. Try adjusting your search terms or clearing the search to see all products.
                  </p>
                  <button
                    onClick={() => setProductSearchTerm('')}
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
                    Clear Search
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px'
                }}>
                  {products.filter(product => 
                    product.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                    product.tags?.some(tag => tag.toLowerCase().includes(productSearchTerm.toLowerCase()))
                  ).slice(0, 12).map((product) => {
                    const price = product.priceRangeV2?.minVariantPrice?.amount || '0';
                    const currency = product.priceRangeV2?.minVariantPrice?.currencyCode || 'USD';
                    const imageUrl = product.featuredImage?.url || product.images?.nodes?.[0]?.url;
                    const isBestseller = product.tags?.includes('bestseller') || product.tags?.includes('featured');
                    
                    return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    style={{
                      background: selectedProduct?.id === product.id ? '#F0F9FF' : '#FFFFFF',
                      border: selectedProduct?.id === product.id ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                      borderRadius: '12px',
                      padding: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      transform: selectedProduct?.id === product.id ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: selectedProduct?.id === product.id ? '0 8px 25px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Product Image */}
                    <div style={{
                      width: '100%',
                      height: '160px',
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.featuredImage?.altText || product.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '8px'
                          }}
                        />
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9CA3AF',
                          fontSize: '48px'
                        }}>
                          📦
                        </div>
                      )}
                      
                      {/* Selection Indicator */}
                      {selectedProduct?.id === product.id && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: '#3B82F6',
                          color: '#FFFFFF',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          ✓
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '8px',
                      lineHeight: '1.4'
                    }}>
                      {product.title}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#059669'
                      }}>
                        {currency} {parseFloat(price).toFixed(2)}
                      </div>
                      
                      {product.variants?.nodes?.[0]?.compareAtPrice && (
                        <div style={{
                          fontSize: '14px',
                          color: '#9CA3AF',
                          textDecoration: 'line-through'
                        }}>
                          {currency} {parseFloat(product.variants.nodes[0].compareAtPrice).toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* Product Status */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: product.status === 'active' ? '#10B981' : '#6B7280'
                      }} />
                      <span style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        textTransform: 'capitalize'
                      }}>
                        {product.status}
                      </span>
                    </div>

                    {/* Product Tags */}
                    {product.tags && product.tags.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginBottom: '12px'
                      }}>
                        {product.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            style={{
                              background: '#F3F4F6',
                              color: '#6B7280',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '500'
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {product.tags.length > 3 && (
                          <span style={{
                            background: '#F3F4F6',
                            color: '#6B7280',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '500'
                          }}>
                            +{product.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openProductPreview(product);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: '#F8FAFC',
                          color: '#374151',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        👁️ Preview
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(product);
                        }}
                        style={{
                          flex: 2,
                          padding: '8px 16px',
                          background: selectedProduct?.id === product.id ? '#3B82F6' : '#F3F4F6',
                          color: selectedProduct?.id === product.id ? '#FFFFFF' : '#6B7280',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '15px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {selectedProduct?.id === product.id ? '✓ Selected' : 'Select Product'}
                      </button>
                    </div>
                  </div>
                    );
                  })}
                </div>
              )}
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

                  {/* Theme Editor using App Bridge Modal */}
                  {themePreviewData && (
                    <div style={{
                      background: '#F9FAFB',
                      border: '2px dashed #D1D5DB',
                      borderRadius: '8px',
                      padding: '40px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '48px',
                        marginBottom: '16px'
                      }}>
                        🎨
                      </div>
                      <h4 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '8px'
                      }}>
                        Theme Editor Ready
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        marginBottom: '24px',
                        lineHeight: '1.5'
                      }}>
                        Click "Open Theme Editor" to launch the full Shopify theme editor in a modal where you can position your widget and see real-time changes.
                      </p>
                      
                      <button
                        onClick={() => {
                          // Use App Bridge modal to open theme editor
                          if (window.shopify && window.shopify.modal) {
                            window.shopify.modal.open({
                              variant: 'max',
                              src: themePreviewData.themeEditorUrl,
                              title: `Theme Editor - ${selectedProduct.title}`
                            });
                          } else {
                            // Fallback: open in new window
                            window.open(themePreviewData.themeEditorUrl, '_blank');
                          }
                        }}
                        style={{
                          padding: '12px 24px',
                          background: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.2s ease-in-out'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#059669';
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = '#10B981';
                          e.target.style.transform = 'translateY(0)';
                        }}
                      >
                        🚀 Open Theme Editor
                      </button>
                    </div>
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

      {/* Storefront Web Components Product Preview Modal */}
      {productPreviewOpen && previewProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '95vw',
            height: '90vh',
            maxWidth: '1400px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              color: '#FFFFFF',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🛍️ Live Product Preview
                </h2>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {previewProduct.title}
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <a
                  href={previewProduct.onlineStorePreviewUrl || `https://${shop}/products/${previewProduct.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🔗 Open in New Tab
                </a>
                <button
                  onClick={closeProductPreview}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Storefront Web Components Product Display */}
            <div style={{
              flex: 1,
              position: 'relative',
              background: '#F8FAFC',
              overflow: 'auto'
            }}>
              {storefrontAccessToken ? (
                <shopify-store 
                  store-domain={`https://${shop}`}
                  public-access-token={storefrontAccessToken}
                >
                <shopify-context type="product" handle={previewProduct.handle}>
                  <template>
                    <div style={{
                      padding: '24px',
                      maxWidth: '1200px',
                      margin: '0 auto'
                    }}>
                      {/* Product Images */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '24px',
                        marginBottom: '32px'
                      }}>
                        <div>
                          <shopify-media 
                            query="product.featuredImage" 
                            width="500" 
                            height="500"
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: '12px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                            }}
                          ></shopify-media>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center'
                        }}>
                          <h1 style={{
                            fontSize: '32px',
                            fontWeight: '700',
                            color: '#1F2937',
                            marginBottom: '16px',
                            lineHeight: '1.2'
                          }}>
                            <shopify-data query="product.title"></shopify-data>
                          </h1>
                          
                          <div style={{
                            fontSize: '24px',
                            fontWeight: '600',
                            color: '#059669',
                            marginBottom: '16px'
                          }}>
                            <shopify-money query="product.selectedOrFirstAvailableVariant.price"></shopify-money>
                          </div>

                          <div style={{
                            marginBottom: '24px'
                          }}>
                            <shopify-variant-selector></shopify-variant-selector>
                          </div>

                          <button
                            onclick="this.closest('shopify-store').buyNow(event);"
                            style={{
                              background: '#3B82F6',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '12px 24px',
                              fontSize: '16px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              marginBottom: '16px'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = '#2563EB';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = '#3B82F6';
                            }}
                          >
                            Buy Now
                          </button>
                        </div>
                      </div>

                      {/* Product Description */}
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        padding: '24px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        marginBottom: '24px'
                      }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1F2937',
                          marginBottom: '16px'
                        }}>
                          Product Description
                        </h3>
                        <div style={{
                          fontSize: '16px',
                          lineHeight: '1.6',
                          color: '#4B5563'
                        }}>
                          <shopify-data query="product.descriptionHtml"></shopify-data>
                        </div>
                      </div>

                      {/* Product Details */}
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        padding: '24px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1F2937',
                          marginBottom: '16px'
                        }}>
                          Product Details
                        </h3>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '16px'
                        }}>
                          <div>
                            <strong>Vendor:</strong> <shopify-data query="product.vendor"></shopify-data>
                          </div>
                          <div>
                            <strong>Product Type:</strong> <shopify-data query="product.productType"></shopify-data>
                          </div>
                          <div>
                            <strong>SKU:</strong> <shopify-data query="product.selectedOrFirstAvailableVariant.sku"></shopify-data>
                          </div>
                          <div>
                            <strong>Available:</strong> <shopify-data query="product.selectedOrFirstAvailableVariant.availableForSale"></shopify-data>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </shopify-context>
                </shopify-store>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  padding: '40px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '18px',
                    color: '#6B7280',
                    marginBottom: '16px'
                  }}>
                    🔑 Setting up store access...
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#9CA3AF'
                  }}>
                    Please wait while we connect to your store
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              background: '#F8FAFC',
              padding: '16px 24px',
              borderTop: '1px solid #E5E5E5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div style={{
                fontSize: '12px',
                color: '#6B7280'
              }}>
                💡 This is exactly how customers see this product on your live store
              </div>
              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <button
                  onClick={closeProductPreview}
                  style={{
                    padding: '8px 16px',
                    background: '#F3F4F6',
                    color: '#6B7280',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    setSelectedProduct(previewProduct);
                    closeProductPreview();
                  }}
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
                  ✓ Select This Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
