import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { session, liquid } = await authenticate.public.appProxy(request);
  
  const url = new URL(request.url);
  const productHandle = url.searchParams.get("product");
  const password = url.searchParams.get("password");
  const isPasswordForm = url.searchParams.get("form") === "password";
  
  if (!productHandle) {
    return new Response("Product handle is required", { status: 400 });
  }

  try {
    // Construct the exact product URL as it appears on the live site
    const productUrl = `https://${session.shop}/products/${productHandle}`;
    
    // Prepare headers for the request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; AB-Optimizer-App/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    // If password is provided, try to authenticate first
    let authenticated = false;
    let authCookies = '';
    
    if (password) {
      try {
        // First, get the password form page to extract any CSRF tokens or form data
        const passwordPageResponse = await fetch(productUrl, {
          method: 'GET',
          headers,
          redirect: 'manual'
        });

        if (passwordPageResponse.status === 302 || passwordPageResponse.status === 301) {
          const redirectUrl = passwordPageResponse.headers.get('location');
          if (redirectUrl && redirectUrl.includes('password')) {
            // Get the password page
            const passwordPage = await fetch(redirectUrl, { headers });
            const passwordPageHtml = await passwordPage.text();
            
            // Try to submit the password
            const passwordSubmitResponse = await fetch(redirectUrl, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': redirectUrl,
              },
              body: new URLSearchParams({
                'password': password,
                'form_type': 'storefront_password',
                'utf8': '✓'
              }).toString(),
              redirect: 'manual'
            });

            // Check if authentication was successful
            if (passwordSubmitResponse.status === 302 || passwordSubmitResponse.status === 301) {
              const finalRedirect = passwordSubmitResponse.headers.get('location');
              if (finalRedirect && !finalRedirect.includes('password')) {
                // Authentication successful, get cookies
                authCookies = passwordSubmitResponse.headers.get('set-cookie') || '';
                authenticated = true;
              }
            }
          }
        }
      } catch (authError) {
        console.error('Authentication error:', authError);
      }
    }

    // Make the final request to get the product page
    const finalHeaders = {
      ...headers,
      ...(authCookies ? { 'Cookie': authCookies } : {})
    };

    const response = await fetch(productUrl, {
      method: 'GET',
      headers: finalHeaders,
      // Allow redirects and don't follow redirects to avoid password pages
      redirect: 'manual'
    });

    let html;
    let finalUrl = productUrl;

    // Handle different response scenarios
    if (response.status === 200) {
      html = await response.text();
    } else if (response.status === 302 || response.status === 301) {
      // Handle redirects (like password protection)
      const redirectUrl = response.headers.get('location');
      if (redirectUrl) {
        finalUrl = redirectUrl;
        // Try to fetch from the redirected URL
        const redirectResponse = await fetch(redirectUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AB-Optimizer-App/1.0)',
          }
        });
        
        if (redirectResponse.ok) {
          html = await redirectResponse.text();
        } else {
          throw new Error(`Redirect failed: ${redirectResponse.status}`);
        }
      } else {
        throw new Error(`Redirect without location header`);
      }
    } else if (response.status === 404) {
      // Product not found
      return liquid(`
        <div style="padding: 40px; text-align: center; color: #666;">
          <h3>Product Not Found</h3>
          <p>The product "${productHandle}" does not exist or is not published.</p>
          <p>URL: ${productUrl}</p>
        </div>
      `);
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if we got a password protection page or incorrect password
    const isPasswordProtected = html.includes('password protected') || 
                               html.includes('store password') || 
                               html.includes('Enter store password') ||
                               html.includes('incorrect password') ||
                               html.includes('wrong password');
    
    if (isPasswordProtected) {
      // If password was provided but still getting password page, it was incorrect
      if (password) {
        return liquid(`
          <div style="padding: 40px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px; margin: 20px;">
            <h3>❌ Incorrect Password</h3>
            <p>The password you entered is incorrect. Please try again.</p>
            
            <form method="get" style="max-width: 400px; margin: 30px auto; text-align: left;">
              <input type="hidden" name="product" value="${productHandle}" />
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
                  Store Password:
                </label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  style="
                    width: 100%; 
                    padding: 12px; 
                    border: 2px solid #dc3545; 
                    border-radius: 8px; 
                    font-size: 16px;
                    box-sizing: border-box;
                    background-color: #fff5f5;
                  "
                  placeholder="Enter your store password"
                  autofocus
                />
                <p style="color: #dc3545; font-size: 14px; margin-top: 5px; margin-bottom: 0;">
                  ⚠️ Previous password was incorrect
                </p>
              </div>
              
              <div style="display: flex; gap: 10px; justify-content: center;">
                <button 
                  type="submit"
                  style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: transform 0.2s;
                  "
                  onmouseover="this.style.transform='scale(1.05)'"
                  onmouseout="this.style.transform='scale(1)'"
                >
                  🔓 Try Again
                </button>
                
                <a 
                  href="${productUrl}" 
                  target="_blank"
                  style="
                    background: #f8f9fa;
                    color: #666;
                    border: 2px solid #e1e5e9;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    text-decoration: none;
                    display: inline-block;
                    transition: transform 0.2s;
                  "
                  onmouseover="this.style.transform='scale(1.05)'"
                  onmouseout="this.style.transform='scale(1)'"
                >
                  🌐 View Live Site
                </a>
              </div>
            </form>
            
            <p style="margin-top: 30px; font-size: 14px; color: #999;">
              Need help? Check your Shopify Admin → Online Store → Preferences
            </p>
          </div>
        `);
      }
      // If password form is requested, show the form
      if (isPasswordForm) {
        return liquid(`
          <div style="padding: 40px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px; margin: 20px;">
            <h3>🔒 Enter Store Password</h3>
            <p>Your store is password protected. Enter the password to preview the product.</p>
            
            <form method="get" style="max-width: 400px; margin: 30px auto; text-align: left;">
              <input type="hidden" name="product" value="${productHandle}" />
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
                  Store Password:
                </label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  style="
                    width: 100%; 
                    padding: 12px; 
                    border: 2px solid #e1e5e9; 
                    border-radius: 8px; 
                    font-size: 16px;
                    box-sizing: border-box;
                  "
                  placeholder="Enter your store password"
                />
              </div>
              
              <div style="display: flex; gap: 10px; justify-content: center;">
                <button 
                  type="submit"
                  style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: transform 0.2s;
                  "
                  onmouseover="this.style.transform='scale(1.05)'"
                  onmouseout="this.style.transform='scale(1)'"
                >
                  🔓 Unlock Preview
                </button>
                
                <a 
                  href="${productUrl}" 
                  target="_blank"
                  style="
                    background: #f8f9fa;
                    color: #666;
                    border: 2px solid #e1e5e9;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    text-decoration: none;
                    display: inline-block;
                    transition: transform 0.2s;
                  "
                  onmouseover="this.style.transform='scale(1.05)'"
                  onmouseout="this.style.transform='scale(1)'"
                >
                  🌐 View Live Site
                </a>
              </div>
            </form>
            
            <p style="margin-top: 30px; font-size: 14px; color: #999;">
              Don't know the password? Check your Shopify Admin → Online Store → Preferences
            </p>
          </div>
        `);
      }
      
      // If no password provided, show the initial password protection message with form link
      return liquid(`
        <div style="padding: 40px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px; margin: 20px;">
          <h3>🔒 Store is Password Protected</h3>
          <p>Your store is currently password protected. You can either:</p>
          
          <div style="display: flex; gap: 15px; justify-content: center; margin: 30px 0; flex-wrap: wrap;">
            <a 
              href="?product=${productHandle}&form=password"
              style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 500;
                display: inline-block;
                transition: transform 0.2s;
              "
              onmouseover="this.style.transform='scale(1.05)'"
              onmouseout="this.style.transform='scale(1)'"
            >
              🔓 Enter Password
            </a>
            
            <a 
              href="${productUrl}" 
              target="_blank"
              style="
                background: #f8f9fa;
                color: #666;
                border: 2px solid #e1e5e9;
                padding: 15px 25px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 500;
                display: inline-block;
                transition: transform 0.2s;
              "
              onmouseover="this.style.transform='scale(1.05)'"
              onmouseout="this.style.transform='scale(1)'"
            >
              🌐 View Live Site
            </a>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #999;">
            Or disable password protection in Shopify Admin → Online Store → Preferences
          </p>
        </div>
      `);
    }

    // Remove CSP frame-ancestors directive to allow embedding
    html = html.replace(/frame-ancestors[^;]*;?/g, '');
    
    // Add custom CSS to make the preview look good in the app
    const customCSS = `
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8f9fa;
        }
        .product-preview-container {
          max-width: 100%;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .product-preview-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 20px;
          font-size: 14px;
          font-weight: 500;
        }
        /* Hide navigation elements that don't make sense in preview */
        nav, .site-nav, .main-nav, .breadcrumb, .pagination, .footer {
          display: none !important;
        }
        /* Style adjustments for preview */
        .product-page {
          padding: 20px;
        }
        /* Ensure images are responsive */
        img {
          max-width: 100%;
          height: auto;
        }
      </style>
    `;

    // Inject custom CSS into the head
    html = html.replace('</head>', `${customCSS}</head>`);
    
    // Wrap the content in a preview container with header
    const authStatus = authenticated ? '🔓 Unlocked' : '🌐 Live';
    const previewHeader = `
      <div class="product-preview-header">
        📱 Live Product Preview: ${productHandle} (${authStatus}) | 
        <a href="${productUrl}" target="_blank" style="color: white; text-decoration: underline;">
          View on Live Site →
        </a>
      </div>
    `;
    
    html = html.replace('<body', `<body><div class="product-preview-container">${previewHeader}<div class="product-page">`);
    html = html.replace('</body>', '</div></div></body>');

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error fetching product page:', error);
    
    // Return a detailed error response
    return liquid(`
      <div style="padding: 40px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px; margin: 20px;">
        <h3>⚠️ Preview Error</h3>
        <p>Unable to load product preview. This could be due to:</p>
        <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
          <li>Store password protection is enabled</li>
          <li>Product is not published</li>
          <li>Network connectivity issues</li>
          <li>Product handle: <code>${productHandle}</code></li>
        </ul>
        <p style="margin-top: 20px;">
          <a href="https://${session.shop}/products/${productHandle}" target="_blank" style="color: #3B82F6; text-decoration: none;">
            → Try viewing on Live Site
          </a>
        </p>
      </div>
    `);
  }
};
