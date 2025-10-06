import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { session, liquid } = await authenticate.public.appProxy(request);
  
  const url = new URL(request.url);
  const productHandle = url.searchParams.get("product");
  
  if (!productHandle) {
    return new Response("Product handle is required", { status: 400 });
  }

  try {
    // Fetch the live product page HTML from the storefront
    const productUrl = `https://${session.shop}/products/${productHandle}`;
    
    // Make a server-side request to fetch the product page HTML
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AB-Optimizer-App/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product page: ${response.status}`);
    }

    let html = await response.text();
    
    // Remove CSP frame-ancestors directive to allow embedding
    html = html.replace(/frame-ancestors[^;]*;?/g, '');
    
    // Add custom CSS to make the preview look good in the app
    const customCSS = `
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .product-preview-container {
          max-width: 100%;
          margin: 0 auto;
        }
        /* Hide navigation elements that don't make sense in preview */
        nav, .site-nav, .main-nav, .breadcrumb, .pagination {
          display: none !important;
        }
        /* Style adjustments for preview */
        .product-page {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
        }
      </style>
    `;

    // Inject custom CSS into the head
    html = html.replace('</head>', `${customCSS}</head>`);
    
    // Wrap the content in a preview container
    html = html.replace('<body', '<body><div class="product-preview-container"><div class="product-page">');
    html = html.replace('</body>', '</div></div></body>');

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
      },
    });

  } catch (error) {
    console.error('Error fetching product page:', error);
    
    // Return a fallback response
    return liquid(`
      <div style="padding: 20px; text-align: center; color: #666;">
        <h3>Product Preview Unavailable</h3>
        <p>Unable to load product preview. The product may not exist or may not be published.</p>
        <p>Product Handle: ${productHandle}</p>
      </div>
    `);
  }
};
