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
    
    return json({
      shopDomain,
      themeId,
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
      widgets: [],
      error: error.message
    });
  }
};

export default function RecipeLibrary() {
  const { shopDomain, themeId, widgets, error } = useLoaderData();
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const openThemeEditor = (widgetId) => {
    const themeEditorUrl = `https://admin.shopify.com/store/${shopDomain.replace('.myshopify.com', '')}/themes/${themeId}/editor?context=apps&template=product&activateAppId=ab-optimizer-app/${widgetId}`;
    window.open(themeEditorUrl, '_blank');
  };

  const renderPreview = (widget) => {
    const { preview } = widget;
    
    return (
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginTop: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ marginBottom: '16px', color: '#000000' }}>Widget Preview</h3>
        
        {/* Sample Product Page */}
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '20px',
          position: 'relative',
          minHeight: '300px'
        }}>
          {/* Product Image Placeholder */}
          <div style={{
            width: '200px',
            height: '200px',
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Product Image
          </div>
          
          {/* Product Title */}
          <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
            Sample Product
          </h2>
          
          {/* Product Price */}
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#32cd32', marginBottom: '16px' }}>
            $99.99
          </div>
          
          {/* Widget Preview */}
          <div style={{ marginTop: '16px' }}>
            {preview.type === 'badge' && (
              <div style={{
                display: 'inline-block',
                padding: '8px 12px',
                background: preview.color,
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                position: 'absolute',
                top: '20px',
                right: '20px'
              }}>
                {preview.text}
              </div>
            )}
            
            {preview.type === 'social' && (
              <div style={{
                padding: '12px',
                background: '#f8f9fa',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#000000'
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
                textAlign: 'center'
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
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{preview.label}</span>
                  <span style={{ fontSize: '12px' }}>75%</span>
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
                borderRadius: '8px'
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
                onClick={() => openThemeEditor(selectedWidget.id)}
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