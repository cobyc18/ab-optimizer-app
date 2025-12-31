import SimpleTextBadgePreview from './SimpleTextBadgePreview';

export default function ProductPagePreview({ 
  widgetSettings, 
  conversionPlayType = '',
  countMin = 40,
  countMax = 60,
  previewMode = 'mobile'
}) {
  if (previewMode === 'desktop') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        overflowY: 'auto',
        overflowX: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        boxSizing: 'border-box'
      }}>
        {/* Desktop Layout - Horizontal */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '20px',
          display: 'flex',
          gap: '40px',
          alignItems: 'flex-start'
        }}>
          {/* Left Side - Product Image */}
          <div style={{
            flex: '0 0 500px',
            maxWidth: '500px'
          }}>
            <div style={{
              width: '100%',
              aspectRatio: '1',
              background: '#F3F4F6',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9CA3AF',
              fontSize: '14px'
            }}>
              Product Image
            </div>
          </div>

          {/* Right Side - Product Info */}
          <div style={{
            flex: 1,
            minWidth: 0
          }}>
            {/* Promotional Badge */}
            <div style={{
              display: 'inline-block',
              background: '#22C55E',
              color: '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '16px'
            }}>
              15% off with code SAVE15
            </div>

            {/* Product Title */}
            <h1 style={{
              fontSize: '32px',
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: '12px',
              marginTop: 0
            }}>
              Premium Linen Shirt
            </h1>

            {/* Product Price */}
            <div style={{
              fontSize: '28px',
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
              $49.90
            </div>

            {/* Star Rating */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                gap: '2px'
              }}>
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                  </svg>
                ))}
              </div>
              <span style={{
                fontSize: '14px',
                color: '#6B7280'
              }}>
                (125 reviews)
              </span>
            </div>

            {/* Widget Preview */}
            <div style={{
              marginBottom: '24px'
            }}>
              <SimpleTextBadgePreview
                widgetSettings={widgetSettings}
                conversionPlayType={conversionPlayType}
                countMin={countMin}
                countMax={countMax}
              />
            </div>

            {/* Color Selection */}
            <div style={{
              marginBottom: '24px'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Color: Beige
              </label>
              <div style={{
                display: 'flex',
                gap: '8px'
              }}>
                {['#F5F5DC', '#FFFFFF', '#3B82F6', '#FEF3C7'].map((color, i) => (
                  <div
                    key={i}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: color,
                      border: i === 0 ? '2px solid #FBBF24' : '2px solid #E5E7EB',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div style={{
              marginBottom: '24px'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Size
              </label>
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                {['XS', 'S', 'M', 'L', 'XL'].map((size, i) => (
                  <button
                    key={size}
                    style={{
                      padding: '10px 20px',
                      background: i === 2 ? '#FFFFFF' : '#F3F4F6',
                      color: i === 2 ? '#1F2937' : '#6B7280',
                      border: i === 2 ? '2px solid #FBBF24' : '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <div style={{
              marginBottom: '24px'
            }}>
              <button style={{
                width: '100%',
                padding: '16px 32px',
                background: '#1F2937',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Layout (existing code)
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#FFFFFF',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      overflowY: 'auto',
      overflowX: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      boxSizing: 'border-box'
    }}>
      {/* Mock Product Page Structure */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px'
      }}>
        {/* Product Image Placeholder */}
        <div style={{
          width: '100%',
          maxWidth: '300px',
          margin: '0 auto',
          aspectRatio: '0.75',
          background: '#F3F4F6',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9CA3AF',
          fontSize: '14px'
        }}>
          Product Image
        </div>

        {/* Product Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: '600',
          color: '#1F2937',
          marginBottom: '12px',
          marginTop: 0
        }}>
          Sample Product
        </h1>

        {/* Product Price */}
        <div style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#3B82F6',
          marginBottom: '24px'
        }}>
          $99.99
        </div>

        {/* Widget Preview */}
        <div style={{
          marginBottom: '24px'
        }}>
          <SimpleTextBadgePreview
            widgetSettings={widgetSettings}
            conversionPlayType={conversionPlayType}
            countMin={countMin}
            countMax={countMax}
          />
        </div>

        {/* Product Description */}
        <div style={{
          fontSize: '16px',
          color: '#6B7280',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          <p>
            This is a sample product description. The widget above will update automatically 
            as you make changes to the settings on the left.
          </p>
        </div>

        {/* Add to Cart Button */}
        <button style={{
          width: '100%',
          padding: '16px',
          background: '#3B82F6',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          marginBottom: '24px'
        }}>
          Add to Cart
        </button>

        {/* Additional Product Info */}
        <div style={{
          borderTop: '1px solid #E5E7EB',
          paddingTop: '24px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '12px',
            marginTop: 0
          }}>
            Product Details
          </h3>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            color: '#6B7280',
            fontSize: '14px',
            lineHeight: '1.8'
          }}>
            <li>• High quality materials</li>
            <li>• Fast shipping available</li>
            <li>• 30-day return policy</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

