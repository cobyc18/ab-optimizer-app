import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Link } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    // Get shop info for theme editor links
    const shopRes = await admin.graphql(`query { shop { myshopifyDomain } }`);
    const shopJson = await shopRes.json();
    const shopDomain = shopJson.data.shop.myshopifyDomain;
    
    // Get main theme for theme editor links
    const themeRes = await admin.graphql(`query { themes(first: 5) { nodes { id name role } } }`);
    const themeJson = await themeRes.json();
    const mainTheme = themeJson.data.themes.nodes.find(t => t.role === "MAIN");
    const themeId = mainTheme?.id.replace("gid://shopify/OnlineStoreTheme/", "") || "";
    
    // Get a sample product for realistic preview with correct field names
    const productRes = await admin.graphql(`
      query {
        products(first: 1) {
          nodes {
            id
            title
            handle
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            featuredImage {
              url
              altText
            }
            images(first: 1) {
              nodes {
                url
                altText
              }
            }
            variants(first: 1) {
              nodes {
                compareAtPrice
                price
              }
            }
            totalInventory
            createdAt
          }
        }
      }
    `);
    const productJson = await productRes.json();
    const sampleProduct = productJson.data.products.nodes[0];
    
    return json({
      shopDomain,
      themeId,
      sampleProduct,
      widgets: [
        {
          id: "product-badge",
          name: "Product Badge",
          description: "Display customizable badges like SALE, NEW, LIMITED on product pages",
          category: "Product Enhancement",
          icon: "🏷️",
          preview: {
            type: "badge",
            text: "SALE",
            color: "#32cd32",
            position: "top-right"
          }
        },
        {
          id: "social-proof",
          name: "Social Proof",
          description: "Show recent purchases, review counts, and trust badges to build confidence",
          category: "Trust & Social",
          icon: "⭐",
          preview: {
            type: "social",
            text: "Someone in your area just purchased this 2 minutes ago",
            icon: "🛒"
          }
        },
        {
          id: "countdown-timer",
          name: "Countdown Timer",
          description: "Create urgency with time-limited offers and countdown displays",
          category: "Conversion",
          icon: "⏰",
          preview: {
            type: "timer",
            text: "Limited Time Offer!",
            timeLeft: "2 days, 14 hours, 32 minutes"
          }
        },
        {
          id: "progress-bar",
          name: "Progress Bar",
          description: "Show stock levels, goal progress, or custom progress indicators",
          category: "Product Enhancement",
          icon: "📊",
          preview: {
            type: "progress",
            label: "Stock Level",
            percentage: 75,
            text: "Only 5 left in stock!"
          }
        },
        {
          id: "star-rating",
          name: "Star Rating",
          description: "Display customizable star ratings with review counts",
          category: "Trust & Social",
          icon: "⭐",
          preview: {
            type: "rating",
            stars: 4.5,
            reviews: 128,
            label: "Excellent"
          }
        }
      ]
    });
  } catch (error) {
    console.error("Error in Recipe Library loader:", error);
    return json({
      shopDomain: "",
      themeId: "",
      sampleProduct: null,
      widgets: [],
      error: error.message
    });
  }
};

export default function RecipeLibrary() {
  const { shopDomain, themeId, sampleProduct, widgets, error } = useLoaderData();
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const openThemeEditor = (widgetId) => {
    // Open theme editor directly to the Apps section
    const themeEditorUrl = `https://admin.shopify.com/store/${shopDomain.replace('.myshopify.com', '')}/themes/${themeId}/editor?context=apps&template=product`;
    window.open(themeEditorUrl, '_blank');
  };

  const openThemeEditorWithInstructions = (widgetId) => {
    const widget = widgets.find(w => w.id === widgetId);
    
    // Get product handle for preview path
    const productHandle = sampleProduct?.handle || 'sample-product';
    const encodedProductPath = encodeURIComponent(`/products/${productHandle}`);
    
    // Generate unique block ID (similar to Shopify's format)
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const blockId = `template--${timestamp}__main__ab_optimizer_app_${widgetId}_${randomId}`;
    const sectionId = `template--${timestamp}__main`;
    
    // Construct the theme editor URL with proper parameters
    const themeEditorUrl = `https://admin.shopify.com/store/${shopDomain.replace('.myshopify.com', '')}/themes/${themeId}/editor?previewPath=${encodedProductPath}&block=${blockId}&section=${sectionId}`;
    
    // Show instructions modal
    const instructions = `
🎯 How to Add ${widget.name} to Your Product Page:

1. The theme editor will open in a new tab
2. You'll be taken directly to the product page with the widget ready to add
3. The widget will be highlighted in the theme editor
4. Click "Add block" or drag it to your desired position
5. Customize the widget settings in the right sidebar
6. Click "Save" to apply changes to your theme

💡 Tip: You can drag and drop the widget to reposition it anywhere on the page!
    `;
    
    if (confirm(instructions)) {
      window.open(themeEditorUrl, '_blank');
    }
  };

  const renderPreview = (widget) => {
    const { preview } = widget;
    
    // Use real product data or fallback to sample data
    const product = sampleProduct || {
      title: "Sample Product",
      priceRangeV2: { minVariantPrice: { amount: "99.99", currencyCode: "USD" } },
      variants: { nodes: [{ compareAtPrice: "129.99", price: "99.99" }] },
      featuredImage: { url: null, altText: "Sample Product" },
      totalInventory: 5,
      createdAt: new Date().toISOString()
    };
    
    const price = product.priceRangeV2?.minVariantPrice?.amount || "99.99";
    const variant = product.variants?.nodes?.[0];
    const comparePrice = variant?.compareAtPrice;
    const isOnSale = comparePrice && parseFloat(comparePrice) > parseFloat(price);
    const productAge = Math.floor((Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const isNew = productAge <= 30;
    const isLowStock = (product.totalInventory || 0) <= 10;
    
    return (
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginTop: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ marginBottom: '16px', color: '#000000' }}>Widget Preview on Real Product</h3>
        
        {/* Product Page Preview */}
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '20px',
          position: 'relative',
          minHeight: '400px'
        }}>
          {/* Product Image */}
          <div style={{
            width: '300px',
            height: '300px',
            background: product.featuredImage?.url 
              ? `url(${product.featuredImage.url}) center/cover`
              : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: product.featuredImage?.url ? 'transparent' : '#6b7280',
            fontSize: '14px',
            position: 'relative'
          }}>
            {!product.featuredImage?.url && 'Product Image'}
            
            {/* Widget Overlays */}
            {preview.type === 'badge' && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '6px 10px',
                background: preview.color,
                color: 'white',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                zIndex: 10
              }}>
                {isOnSale ? 'SALE' : isNew ? 'NEW' : isLowStock ? 'LIMITED' : preview.text}
              </div>
            )}
          </div>
          
          {/* Product Info */}
          <div style={{ maxWidth: '400px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
              {product.title}
            </h2>
            
            {/* Price */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '20px', fontWeight: '600', color: '#32cd32' }}>
                ${price}
              </span>
              {isOnSale && (
                <span style={{ 
                  fontSize: '16px', 
                  color: '#6b7280', 
                  textDecoration: 'line-through',
                  marginLeft: '8px'
                }}>
                  ${comparePrice}
                </span>
              )}
            </div>
            
            {/* Widget Previews */}
            <div style={{ marginTop: '16px' }}>
              {preview.type === 'social' && (
                <div style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#000000',
                  marginBottom: '12px'
                }}>
                  <span style={{ marginRight: '8px' }}>{preview.icon}</span>
                  {preview.text}
                </div>
              )}
              
              {preview.type === 'timer' && (
                <div style={{
                  padding: '16px',
                  background: '#000000',
                  color: 'white',
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                    {preview.text}
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    {preview.timeLeft}
                  </div>
                </div>
              )}
              
              {preview.type === 'progress' && (
                <div style={{
                  padding: '12px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{preview.label}</span>
                    <span style={{ fontSize: '12px' }}>{preview.percentage}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${preview.percentage}%`,
                      height: '100%',
                      background: '#32cd32',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    {preview.text}
                  </div>
                </div>
              )}
              
              {preview.type === 'rating' && (
                <div style={{
                  padding: '12px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} style={{
                          fontSize: '16px',
                          color: star <= Math.floor(preview.stars) ? '#ffd700' : '#d1d5db'
                        }}>
                          ★
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{preview.stars}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>({preview.reviews} reviews)</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {preview.label}
                  </div>
                </div>
              )}
            </div>
            
            {/* Add to Cart Button */}
            <button style={{
              width: '100%',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '16px'
            }}>
              Add to Cart
            </button>
          </div>
        </div>
        
        {/* Preview Info */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#0c4a6e'
        }}>
          <strong>Preview Info:</strong> This shows how the "{widget.name}" widget will appear on your actual product page. 
          The preview uses real product data from your store for the most accurate representation.
        </div>
      </div>
    );
  };

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
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#000000', margin: '0 0 8px 0' }}>
          🎨 Recipe Library
        </h1>
        <p style={{ color: '#374151', margin: '0', fontSize: '16px' }}>
          Browse, preview, and add widgets to enhance your product pages
        </p>
        {sampleProduct && (
          <p style={{ color: '#32cd32', margin: '8px 0 0 0', fontSize: '14px' }}>
            ✅ Using real product data: "{sampleProduct.title}"
          </p>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        border: '1px solid #0ea5e9',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0c4a6e', margin: '0 0 12px 0' }}>
          🚀 How to Add Widgets to Your Product Pages
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '14px', color: '#0c4a6e' }}>
          <div>
            <strong>1. Select a Widget</strong><br/>
            Choose from the dropdown or browse categories below
          </div>
          <div>
            <strong>2. Preview & Test</strong><br/>
            See how it looks on your actual product page
          </div>
          <div>
            <strong>3. Add to Theme</strong><br/>
            Click "Add to Theme Editor" to open directly to the product page
          </div>
          <div>
            <strong>4. Customize & Save</strong><br/>
            Position, customize settings, and save your changes
          </div>
        </div>
        <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '6px', fontSize: '13px' }}>
          💡 <strong>Pro Tip:</strong> The theme editor will open directly to your product page with the widget ready to add - no need to navigate through menus!
        </div>
      </div>

      {/* Widget Selection */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(50, 205, 50, 0.2)'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', marginBottom: '16px' }}>
          Select a Widget
        </h2>
        
        <select
          value={selectedWidget?.id || ""}
          onChange={(e) => {
            const widget = widgets.find(w => w.id === e.target.value);
            setSelectedWidget(widget || null);
            setPreviewMode(false);
          }}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            background: 'white',
            marginBottom: '16px'
          }}
        >
          <option value="">Choose a widget to preview...</option>
          {widgets.map((widget) => (
            <option key={widget.id} value={widget.id}>
              {widget.icon} {widget.name} - {widget.category}
            </option>
          ))}
        </select>

        {selectedWidget && (
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#000000', marginBottom: '8px' }}>
              {selectedWidget.icon} {selectedWidget.name}
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              {selectedWidget.description}
            </p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
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
                {previewMode ? 'Hide Preview' : 'Preview Widget'}
              </button>
              
              <button
                onClick={() => openThemeEditorWithInstructions(selectedWidget.id)}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)';
                }}
              >
                🎨 Add to Theme Editor
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Section */}
      {previewMode && selectedWidget && renderPreview(selectedWidget)}

      {/* Widget Categories */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(50, 205, 50, 0.2)'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', marginBottom: '24px' }}>
          Available Widgets by Category
        </h2>
        
        {['Product Enhancement', 'Trust & Social', 'Conversion'].map(category => (
          <div key={category} style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              {category}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {widgets.filter(w => w.category === category).map(widget => (
                <div key={widget.id} style={{
                  padding: '16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#32cd32';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.transform = 'translateY(0)';
                }}
                onClick={() => {
                  setSelectedWidget(widget);
                  setPreviewMode(false);
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px', marginRight: '8px' }}>{widget.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#000000' }}>
                      {widget.name}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                    {widget.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          color: 'white',
          fontSize: '14px',
          marginBottom: '32px'
        }}>
          ❌ Error Loading Recipe Library: {error}
        </div>
      )}
    </div>
  );
} 