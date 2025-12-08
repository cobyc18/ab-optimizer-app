import SimpleTextBadgePreview from './SimpleTextBadgePreview';

export default function ProductPagePreview({ 
  widgetSettings, 
  conversionPlayType = '',
  countMin = 40,
  countMax = 60
}) {
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
          aspectRatio: '1',
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

