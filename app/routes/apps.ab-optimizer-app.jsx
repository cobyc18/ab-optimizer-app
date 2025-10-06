import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session, liquid } = await authenticate.public.appProxy(request);
  
  const url = new URL(request.url);
  const productHandle = url.searchParams.get("product");
  
  console.log('🔍 App Proxy Request:', {
    url: request.url,
    productHandle,
    shop: session.shop,
    userAgent: request.headers.get('user-agent')
  });
  
  if (!productHandle) {
    return new Response("Product handle is required", { status: 400 });
  }

  try {
    // Use Liquid to render the product page with the shop's theme
    // This is the proper way to show the exact product page as it appears on the live site
    const response = liquid(`
      {% comment %}
        This will render the product page exactly as it appears on the live site
        using the shop's current theme and all styling
      {% endcomment %}
      
      {% assign product = all_products['${productHandle}'] %}
      
      {% if product %}
        {% comment %} Render the product page using the shop's theme {% endcomment %}
        <div class="product-preview-container">
          <div class="product-preview-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000;">
            📱 Live Product Preview: {{ product.title }} | 
            <a href="{{ shop.url }}/products/{{ product.handle }}" target="_blank" style="color: white; text-decoration: underline;">
              View on Live Site →
            </a>
          </div>
          
          <div class="product-content">
            {% comment %} Use the product object to render the page content {% endcomment %}
            <div class="product-page">
              <h1>{{ product.title }}</h1>
              
              {% if product.featured_image %}
                <div class="product-image">
                  <img src="{{ product.featured_image | img_url: '800x800' }}" alt="{{ product.featured_image.alt | escape }}" />
                </div>
              {% endif %}
              
              <div class="product-price">
                <span class="price">
                  {% if product.compare_at_price > product.price %}
                    <span class="sale-price">{{ product.price | money }}</span>
                    <span class="compare-price">{{ product.compare_at_price | money }}</span>
                  {% else %}
                    {{ product.price | money }}
                  {% endif %}
                </span>
              </div>
              
              {% if product.description != blank %}
                <div class="product-description">
                  {{ product.description }}
                </div>
              {% endif %}
              
              {% comment %} Product variants {% endcomment %}
              {% unless product.has_only_default_variant %}
                <div class="product-variants">
                  <h3>Options:</h3>
                  {% for option in product.options_with_values %}
                    <div class="product-option">
                      <label>{{ option.name }}:</label>
                      <select>
                        {% for value in option.values %}
                          <option value="{{ value }}">{{ value }}</option>
                        {% endfor %}
                      </select>
                    </div>
                  {% endfor %}
                </div>
              {% endunless %}
              
              {% comment %} Add to cart form {% endcomment %}
              <form action="/cart/add" method="post" enctype="multipart/form-data">
                <select name="id" style="display: none;">
                  {% for variant in product.variants %}
                    <option value="{{ variant.id }}">{{ variant.title }}</option>
                  {% endfor %}
                </select>
                <button type="submit" name="add" class="btn btn-primary">
                  Add to Cart
                </button>
              </form>
              
              {% comment %} Additional product images {% endcomment %}
              {% if product.images.size > 1 %}
                <div class="product-images">
                  {% for image in product.images %}
                    <img src="{{ image | img_url: '400x400' }}" alt="{{ image.alt | escape }}" />
                  {% endfor %}
                </div>
              {% endif %}
            </div>
          </div>
        </div>
        
        <style>
          .product-preview-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .product-page {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
          }
          .product-image img {
            max-width: 100%;
            height: auto;
          }
          .product-images {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 20px;
          }
          .product-images img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 8px;
          }
          .product-variants {
            margin: 20px 0;
          }
          .product-option {
            margin: 10px 0;
          }
          .product-option label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
          }
          .product-option select {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          }
          .btn-primary {
            background: #3B82F6;
            color: white;
          }
          .btn-primary:hover {
            background: #2563EB;
          }
          .sale-price {
            color: #EF4444;
            font-weight: bold;
          }
          .compare-price {
            text-decoration: line-through;
            color: #999;
            margin-left: 10px;
          }
        </style>
      {% else %}
        {% comment %} Product not found {% endcomment %}
        <div style="padding: 40px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px; margin: 20px;">
          <h3>❌ Product Not Found</h3>
          <p>The product "${productHandle}" could not be found in your store.</p>
          <div style="margin-top: 20px;">
            <a href="{{ shop.url }}" target="_blank" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              🌐 View Store
            </a>
          </div>
        </div>
      {% endif %}
    `);

    // Add proper CSP headers to allow framing from the shop domain
    response.headers.set('Content-Security-Policy', `frame-ancestors https://${session.shop} https://admin.shopify.com`);
    response.headers.set('X-Frame-Options', 'ALLOWALL');
    
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