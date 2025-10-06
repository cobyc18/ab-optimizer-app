import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session, liquid } = await authenticate.public.appProxy(request);
  
  const url = new URL(request.url);
  const productHandle = url.searchParams.get("product");
  
  console.log('🔍 App Proxy Request:', {
    url: request.url,
    productHandle,
    shop: session.shop,
    userAgent: request.headers.get('user-agent'),
    headers: Object.fromEntries(request.headers.entries())
  });
  
  if (!productHandle) {
    return new Response("Product handle is required", { status: 400 });
  }

  try {
    // Let's start with a simple test to make sure Liquid rendering works
    console.log('🔍 Attempting Liquid rendering for product:', productHandle);
    
    // First, let's return a simple HTML response to test if the app proxy is working
    const testResponse = new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>App Proxy Working Test</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0; 
              padding: 20px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: rgba(255,255,255,0.1);
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255,255,255,0.2);
            }
            .success-icon {
              font-size: 4rem;
              margin-bottom: 20px;
            }
            .product-info {
              background: rgba(255,255,255,0.2);
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
              text-align: left;
            }
            .product-info strong {
              color: #fff;
            }
            .test-button {
              background: rgba(255,255,255,0.3);
              color: white;
              border: 2px solid rgba(255,255,255,0.5);
              padding: 15px 30px;
              border-radius: 10px;
              font-size: 16px;
              cursor: pointer;
              margin: 10px;
              transition: all 0.3s ease;
            }
            .test-button:hover {
              background: rgba(255,255,255,0.4);
              transform: translateY(-2px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">🎉</div>
            <h1>App Proxy Working!</h1>
            <p>This confirms the app proxy is successfully serving content.</p>
            
            <div class="product-info">
              <strong>Product Handle:</strong> ${productHandle}<br/>
              <strong>Shop:</strong> ${session.shop}<br/>
              <strong>Request URL:</strong> ${request.url}<br/>
              <strong>Timestamp:</strong> ${new Date().toISOString()}
            </div>
            
            <div>
              <button class="test-button" onclick="alert('JavaScript is working!')">
                🧪 Test JavaScript
              </button>
              <button class="test-button" onclick="window.parent.postMessage('iframe-loaded', '*')">
                📡 Send Message to Parent
              </button>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
              If you can see this page, the app proxy is working correctly and CSP headers are set properly.
            </p>
          </div>
          
          <script>
            console.log('🎉 App Proxy JavaScript loaded successfully!');
            console.log('Product Handle:', '${productHandle}');
            console.log('Shop:', '${session.shop}');
            
            // Send a message to the parent window to confirm iframe loaded
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'app-proxy-loaded',
                productHandle: '${productHandle}',
                shop: '${session.shop}'
              }, '*');
            }
          </script>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `frame-ancestors https://${session.shop} https://admin.shopify.com`,
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    console.log('✅ Returning test HTML response for app proxy');
    return testResponse;
    
    // Let's start with a simple test to make sure Liquid rendering works
    console.log('🔍 Attempting Liquid rendering for product:', productHandle);
    
    const response = liquid(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product Preview Test</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0; 
              padding: 20px; 
              background: #f8f9fa;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 15px 20px;
              font-size: 14px;
              font-weight: 500;
            }
            .content {
              padding: 20px;
            }
            .product-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-top: 20px;
            }
            .product-image img {
              width: 100%;
              height: auto;
              border-radius: 8px;
            }
            .product-details h1 {
              color: #333;
              margin-bottom: 15px;
            }
            .price {
              font-size: 24px;
              font-weight: bold;
              color: #3B82F6;
              margin-bottom: 20px;
            }
            .description {
              color: #666;
              line-height: 1.6;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              📱 Live Product Preview: {{ shop.name }} | 
              <a href="{{ shop.url }}/products/${productHandle}" target="_blank" style="color: white; text-decoration: underline;">
                View on Live Site →
              </a>
            </div>
            
            <div class="content">
              {% assign product = all_products['${productHandle}'] %}
              
              {% if product %}
                <div class="product-info">
                  <div class="product-image">
                    {% if product.featured_image %}
                      <img src="{{ product.featured_image | img_url: '600x600' }}" alt="{{ product.featured_image.alt | escape }}" />
                    {% else %}
                      <div style="background: #f1f3f4; height: 300px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                        <span style="color: #999;">No image available</span>
                      </div>
                    {% endif %}
                  </div>
                  
                  <div class="product-details">
                    <h1>{{ product.title }}</h1>
                    
                    <div class="price">
                      {% if product.compare_at_price > product.price %}
                        <span style="color: #EF4444;">{{ product.price | money }}</span>
                        <span style="text-decoration: line-through; color: #999; margin-left: 10px;">{{ product.compare_at_price | money }}</span>
                      {% else %}
                        {{ product.price | money }}
                      {% endif %}
                    </div>
                    
                    {% if product.description != blank %}
                      <div class="description">
                        {{ product.description | truncate: 200 }}
                      </div>
                    {% endif %}
                    
                    <div style="margin-top: 20px;">
                      <strong>Product Handle:</strong> ${productHandle}<br/>
                      <strong>Product ID:</strong> {{ product.id }}<br/>
                      <strong>Available:</strong> {{ product.available }}<br/>
                      <strong>Variants:</strong> {{ product.variants.size }}
                    </div>
                  </div>
                </div>
              {% else %}
                <div style="text-align: center; padding: 40px;">
                  <h3>❌ Product Not Found</h3>
                  <p>The product "${productHandle}" could not be found in your store.</p>
                  <p>Available products:</p>
                  <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                    {% for product in all_products limit: 5 %}
                      <li>{{ product.title }} ({{ product.handle }})</li>
                    {% endfor %}
                  </ul>
                </div>
              {% endif %}
            </div>
          </div>
        </body>
      </html>
    `);

    // Add proper CSP headers to allow framing from the shop domain
    response.headers.set('Content-Security-Policy', `frame-ancestors https://${session.shop} https://admin.shopify.com`);
    response.headers.set('X-Frame-Options', 'ALLOWALL');
    
    console.log('✅ Successfully created Liquid response with headers:', {
      csp: `frame-ancestors https://${session.shop} https://admin.shopify.com`,
      xFrameOptions: 'ALLOWALL'
    });
    
    return response;

  } catch (error) {
    console.error('Error in product preview:', error);
    
    // Show error message
    const errorResponse = liquid(`
      <div style="padding: 40px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px; margin: 20px;">
        <h3>⚠️ Preview Error</h3>
        <p>Unable to load the product page preview.</p>
        <p style="color: #999; font-size: 14px; margin-top: 10px;">Error: ${error.message}</p>
        <div style="margin-top: 20px;">
          <a href="{{ shop.url }}/products/${productHandle}" target="_blank" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            🌐 View Live Site
          </a>
        </div>
      </div>
    `);
    
    // Add proper CSP headers to error response as well
    errorResponse.headers.set('Content-Security-Policy', `frame-ancestors https://${session.shop} https://admin.shopify.com`);
    errorResponse.headers.set('X-Frame-Options', 'ALLOWALL');
    
    return errorResponse;
  }
};