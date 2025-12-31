import { useEffect, useState } from 'react';
import ProductPagePreview from './ProductPagePreview';

// Import the CSS for the widget
const widgetStyles = `
/* Simple Text Badge Widget Styles */
.simple-text-badge-widget {
  width: 100%;
  margin: 0;
  padding: var(--badge-outer-padding-y, 0px) var(--badge-outer-padding-x, 0px);
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.simple-text-badge {
  display: flex;
  align-items: center;
  gap: var(--badge-icon-text-spacing, 20px);
  width: 100%;
  box-sizing: border-box;
  padding: var(--badge-inner-padding-y, 16px) var(--badge-inner-padding-x, 24px);
  background-color: var(--badge-background-color, #f5f5f0);
  border-radius: var(--badge-border-radius, 8px);
  border: var(--badge-border-thickness, 1px) solid var(--badge-border-color, #d4d4d8);
  box-shadow: var(--badge-drop-shadow, none);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.simple-text-badge.hover-enabled:hover {
  transform: translateY(-2px);
  box-shadow: var(--badge-drop-shadow-hover, var(--badge-drop-shadow, none));
}

.badge-icon-container {
  width: var(--badge-icon-size, 36px);
  height: var(--badge-icon-size, 36px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.badge-icon-container.blinking {
  animation: badgeBlink 1.8s ease-in-out infinite;
}

@keyframes badgeBlink {
  0%, 100% { 
    opacity: 1; 
    transform: scale(1); 
  }
  50% { 
    opacity: var(--badge-blink-opacity, 0.5); 
    transform: scale(var(--badge-blink-scale, 0.92)); 
  }
}

.badge-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.badge-icon-swatch {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--badge-icon-size, 36px) * 0.6);
}

.badge-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--badge-header-body-spacing, 6px);
  min-width: 0;
}

.badge-heading {
  margin: 0;
  line-height: 1.2;
  color: var(--badge-header-color, #0f172a);
  font-size: var(--badge-header-font-size, 24px);
  font-family: var(--badge-header-font-family, inherit);
  font-weight: 500;
  font-style: normal;
  text-decoration: var(--badge-header-text-decoration, none);
}

.badge-heading * {
  color: inherit !important;
  font-family: inherit !important;
  margin: 0 !important;
  padding: 0 !important;
}

.badge-heading h1 { font-size: 2em !important; }
.badge-heading h2 { font-size: 1.5em !important; }
.badge-heading h3 { font-size: 1.17em !important; }
.badge-heading h4 { font-size: 1em !important; }
.badge-heading h5 { font-size: 0.83em !important; }
.badge-heading h6 { font-size: 0.67em !important; }
.badge-heading p { font-size: 1em !important; }

.badge-heading strong,
.badge-heading b {
  font-weight: bold !important;
}

.badge-heading em,
.badge-heading i {
  font-style: italic !important;
}

.badge-heading u {
  text-decoration: underline !important;
}

.badge-body {
  margin: 0;
  line-height: 1.5;
  color: var(--badge-text-color, #1a5f5f);
  font-size: var(--badge-body-font-size, 16px);
  font-family: var(--badge-body-font-family, inherit);
  font-weight: 400;
  font-style: normal;
  text-decoration: var(--badge-body-text-decoration, none);
}

.badge-body * {
  color: inherit !important;
  font-family: inherit !important;
  margin: 0 !important;
  padding: 0 !important;
}

.badge-body h1 { font-size: 2em !important; }
.badge-body h2 { font-size: 1.5em !important; }
.badge-body h3 { font-size: 1.17em !important; }
.badge-body h4 { font-size: 1em !important; }
.badge-body h5 { font-size: 0.83em !important; }
.badge-body h6 { font-size: 0.67em !important; }
.badge-body p { font-size: 1em !important; }

.badge-body strong,
.badge-body b {
  font-weight: bold !important;
}

.badge-body em,
.badge-body i {
  font-style: italic !important;
}

.badge-body u {
  text-decoration: underline !important;
}

.badge-heading a,
.badge-body a {
  color: inherit;
  text-decoration: underline;
}

.badge-heading strong,
.badge-body strong {
  font-weight: bold;
}

.badge-heading em,
.badge-body em {
  font-style: italic;
}

@media (max-width: 768px) {
  .simple-text-badge-widget {
    padding: var(--badge-outer-padding-y-mobile, var(--badge-outer-padding-y, 0px))
      var(--badge-outer-padding-x-mobile, var(--badge-outer-padding-x, 0px));
  }

  .simple-text-badge {
    padding: var(--badge-inner-padding-y-mobile, var(--badge-inner-padding-y, 16px))
      var(--badge-inner-padding-x-mobile, var(--badge-inner-padding-x, 24px));
    flex-direction: row;
    align-items: center;
    gap: var(--badge-icon-text-spacing, 20px);
  }

  .badge-icon-container {
    width: var(--badge-icon-size-mobile, var(--badge-icon-size, 36px));
    height: var(--badge-icon-size-mobile, var(--badge-icon-size, 36px));
  }

  .badge-icon-swatch {
    font-size: calc(var(--badge-icon-size-mobile, var(--badge-icon-size, 36px)) * 0.6);
  }
}
`;

export default function WidgetLivePreview({ 
  widgetSettings, 
  conversionPlayType = '',
  countMin = 40,
  countMax = 60
}) {
  const [previewMode, setPreviewMode] = useState('mobile'); // 'mobile' or 'desktop'

  // Inject CSS styles
  useEffect(() => {
    const styleId = 'widget-live-preview-styles';
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = widgetStyles;
    
    return () => {
      // Don't remove styles on unmount as they might be needed elsewhere
      // The styles will persist for the session
    };
  }, []);

  return (
    <div style={{
      flex: 1,
      background: '#FFFFFF',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      height: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1F2937',
          margin: 0
        }}>
          Live Preview
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Mobile/Desktop Toggle */}
          <div style={{
            display: 'flex',
            background: '#F3F4F6',
            borderRadius: '8px',
            padding: '4px',
            gap: '4px'
          }}>
            <button
              onClick={() => setPreviewMode('mobile')}
              style={{
                padding: '6px 12px',
                background: previewMode === 'mobile' ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: previewMode === 'mobile' ? '#3B82F6' : '#6B7280',
                fontSize: '12px',
                fontWeight: previewMode === 'mobile' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: previewMode === 'mobile' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 18H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Mobile
            </button>
            <button
              onClick={() => setPreviewMode('desktop')}
              style={{
                padding: '6px 12px',
                background: previewMode === 'desktop' ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: previewMode === 'desktop' ? '#3B82F6' : '#6B7280',
                fontSize: '12px',
                fontWeight: previewMode === 'desktop' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: previewMode === 'desktop' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="4" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M2 8H22" stroke="currentColor" strokeWidth="2"/>
                <path d="M7 20H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Desktop
            </button>
          </div>
          <span style={{
            background: '#3B82F6',
            color: '#FFFFFF',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            Updates in real-time
          </span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ProductPagePreview
          widgetSettings={widgetSettings}
          conversionPlayType={conversionPlayType}
          countMin={countMin}
          countMax={countMax}
          previewMode={previewMode}
        />
      </div>
    </div>
  );
}

