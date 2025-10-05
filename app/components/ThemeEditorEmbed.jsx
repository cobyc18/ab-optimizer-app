import React, { useState, useRef, useEffect } from 'react';

export default function ThemeEditorEmbed({ 
  themeEditorUrl, 
  product, 
  widget, 
  onWidgetPositionChange,
  onThemeEditorReady 
}) {
  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event) => {
      // Security: Only accept messages from Shopify admin
      if (!event.origin.includes('myshopify.com') && !event.origin.includes('shopify.com')) {
        return;
      }

      const { type, data } = event.data || {};

      switch (type) {
        case 'theme-editor-ready':
          setIsReady(true);
          setIsLoading(false);
          onThemeEditorReady?.();
          break;
          
        case 'widget-position-changed':
          onWidgetPositionChange?.(data);
          break;
          
        case 'theme-editor-error':
          setError(data.message || 'Theme editor failed to load');
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Cleanup
    return () => window.removeEventListener('message', handleMessage);
  }, [onWidgetPositionChange, onThemeEditorReady]);

  const handleIframeLoad = () => {
    // Send initial configuration to theme editor
    if (iframeRef.current?.contentWindow && themeEditorUrl) {
      const message = {
        type: 'initialize-widget',
        data: {
          product,
          widget,
          action: 'add-widget'
        }
      };
      
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  };

  const injectWidget = () => {
    if (iframeRef.current?.contentWindow && isReady) {
      const message = {
        type: 'inject-widget',
        data: {
          product,
          widget,
          position: { x: 50, y: 50 }, // Default position
          action: 'add-widget'
        }
      };
      
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  };

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '600px',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '2px dashed #dee2e6'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
          color: '#dc3545'
        }}>
          ⚠️
        </div>
        <h3 style={{
          color: '#dc3545',
          marginBottom: '8px',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          Theme Editor Failed to Load
        </h3>
        <p style={{
          color: '#6c757d',
          textAlign: 'center',
          marginBottom: '20px',
          maxWidth: '400px'
        }}>
          {error}
        </p>
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            window.location.reload();
          }}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '600px',
      background: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e1e5e9',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }}>
      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <h3 style={{
            color: '#1f2937',
            marginBottom: '8px',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            Loading Theme Editor
          </h3>
          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            Preparing your theme editor experience...
          </p>
        </div>
      )}

      {/* Theme Editor Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 5
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '16px'
          }}>
            🎨
          </div>
          <div>
            <h4 style={{
              color: 'white',
              margin: 0,
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Theme Editor
            </h4>
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              margin: 0,
              fontSize: '12px'
            }}>
              {product?.title} - {widget}
            </p>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={injectWidget}
            disabled={!isReady}
            style={{
              background: isReady ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: isReady ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            + Add Widget
          </button>
          
          <a
            href={themeEditorUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            Open Full Editor
          </a>
        </div>
      </div>

      {/* Iframe Container */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: 0,
        right: 0,
        bottom: 0,
        background: '#f8f9fa'
      }}>
        <iframe
          ref={iframeRef}
          src={themeEditorUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#ffffff'
          }}
          onLoad={handleIframeLoad}
          title="Shopify Theme Editor"
          allow="clipboard-write; clipboard-read"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>

      {/* CSS for loading animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
