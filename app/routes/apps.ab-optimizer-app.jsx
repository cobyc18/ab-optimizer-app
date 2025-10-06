import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session, liquid } = await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const productHandle = url.searchParams.get("product");
  const password = url.searchParams.get("password");

  console.log('🔍 App Proxy Request:', {
    url: request.url,
    productHandle,
    password: password ? '[PROVIDED]' : '[NOT PROVIDED]',
    shop: session.shop,
    userAgent: request.headers.get('user-agent')
  });

  if (!productHandle) {
    return new Response("Product handle is required", { status: 400 });
  }

  try {
    // Get the active theme ID using GraphQL
    console.log('🎨 Fetching active theme...');
    const themeResponse = await fetch(`https://${session.shop}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': session.accessToken
      },
      body: JSON.stringify({
        query: `
          query GetActiveTheme {
            themes(first: 1, roles: [MAIN]) {
              nodes {
                id
                name
                role
              }
            }
          }
        `
      })
    });

    const themeData = await themeResponse.json();
    console.log('🎨 Theme data:', themeData);

    if (!themeData.data?.themes?.nodes?.[0]) {
      throw new Error('No active theme found');
    }

    const activeTheme = themeData.data.themes.nodes[0];
    const themeId = activeTheme.id.replace('gid://shopify/OnlineStoreTheme/', '');
    
    console.log('✅ Active theme found:', {
      originalId: activeTheme.id,
      extractedId: themeId,
      name: activeTheme.name,
      role: activeTheme.role
    });

    // Generate theme preview URL with product
    const themePreviewUrl = `https://${session.shop}/products/${productHandle}?preview_theme_id=${themeId}`;
    console.log('🌐 Theme preview URL:', themePreviewUrl);
    console.log('🔍 URL Components:', {
      shop: session.shop,
      productHandle,
      themeId,
      fullUrl: themePreviewUrl
    });

    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AB-Optimizer-App/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    };

    // If password is provided, add it to the request
    if (password) {
      fetchOptions.headers['X-Password'] = password;
    }

    console.log('🚀 Fetching theme preview URL...');
    const response = await fetch(themePreviewUrl, fetchOptions);
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.status === 200) {
      let html = await response.text();
      
      // Remove CSP headers that prevent iframe embedding
      html = html.replace(/content-security-policy[^>]*>/gi, '');
      html = html.replace(/x-frame-options[^>]*>/gi, '');
      
      // Add our own CSP headers that allow iframe embedding
      html = html.replace(
        /<head>/i, 
        `<head>
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://${session.shop} https://admin.shopify.com;">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">`
      );

      // Inject JavaScript to communicate with parent window
      const injectedScript = `
        <script>
          console.log('🎉 Product page loaded in iframe');
          
          // Send message to parent that page loaded successfully
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'product-loaded',
              productHandle: '${productHandle}',
              shop: '${session.shop}'
            }, '*');
          }
          
          // Check if this is a password page
          if (document.title.includes('Password') || 
              document.body.textContent.includes('password') ||
              document.querySelector('form[action*="password"]')) {
            console.log('🔒 Password page detected');
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'password-required',
                productHandle: '${productHandle}'
              }, '*');
            }
          }
          
          // Listen for password from parent
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'submit-password') {
              console.log('🔑 Received password from parent');
              
              // Find password form and submit it
              const passwordForm = document.querySelector('form[action*="password"]');
              const passwordInput = document.querySelector('input[type="password"], input[name*="password"]');
              
              if (passwordForm && passwordInput) {
                passwordInput.value = event.data.password;
                passwordForm.submit();
              } else {
                console.error('❌ Could not find password form');
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'password-rejected',
                    error: 'Could not find password form'
                  }, '*');
                }
              }
            }
          });
        </script>
      `;

      html = html.replace('</body>', injectedScript + '</body>');

      console.log('✅ Returning product page HTML');
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': `frame-ancestors https://${session.shop} https://admin.shopify.com`,
          'X-Frame-Options': 'ALLOWALL',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    } else if (response.status === 302 || response.status === 301) {
      // Redirect to password page
      console.log('🔒 Redirecting to password page');
      const redirectUrl = response.headers.get('location');
      
      if (redirectUrl && redirectUrl.includes('password')) {
        // Fetch the password page
        const passwordResponse = await fetch(redirectUrl, fetchOptions);
        let passwordHtml = await passwordResponse.text();
        
        // Remove CSP headers
        passwordHtml = passwordHtml.replace(/content-security-policy[^>]*>/gi, '');
        passwordHtml = passwordHtml.replace(/x-frame-options[^>]*>/gi, '');
        
        // Add our CSP headers
        passwordHtml = passwordHtml.replace(
          /<head>/i, 
          `<head>
            <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://${session.shop} https://admin.shopify.com;">
            <meta http-equiv="X-Frame-Options" content="ALLOWALL">`
        );

        // Inject JavaScript for password handling
        const passwordScript = `
          <script>
            console.log('🔒 Password page loaded');
            
            // Notify parent that password is required
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'password-required',
                productHandle: '${productHandle}'
              }, '*');
            }
            
            // Listen for password from parent
            window.addEventListener('message', function(event) {
              if (event.data && event.data.type === 'submit-password') {
                console.log('🔑 Submitting password:', event.data.password);
                
                const passwordForm = document.querySelector('form');
                const passwordInput = document.querySelector('input[type="password"], input[name*="password"]');
                
                if (passwordForm && passwordInput) {
                  passwordInput.value = event.data.password;
                  passwordForm.submit();
                } else {
                  console.error('❌ Could not find password form');
                  if (window.parent !== window) {
                    window.parent.postMessage({
                      type: 'password-rejected',
                      error: 'Could not find password form'
                    }, '*');
                  }
                }
              }
            });
          </script>
        `;

        passwordHtml = passwordHtml.replace('</body>', passwordScript + '</body>');

        return new Response(passwordHtml, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': `frame-ancestors https://${session.shop} https://admin.shopify.com`,
            'X-Frame-Options': 'ALLOWALL',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    }

    // If we get here, something went wrong
    console.log('❌ Failed to load product page');
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Preview Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://${session.shop} https://admin.shopify.com;">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
            <h2 style="color: #333; margin-bottom: 15px;">Preview Error</h2>
            <p style="color: #666; margin-bottom: 30px;">Unable to load the product page preview.</p>
            <a href="https://${session.shop}/products/${productHandle}" target="_blank" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              🌐 View Live Site
            </a>
          </div>
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

  } catch (error) {
    console.error('Error in product preview:', error);
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Preview Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://${session.shop} https://admin.shopify.com;">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">❌</div>
            <h2 style="color: #333; margin-bottom: 15px;">Preview Error</h2>
            <p style="color: #666; margin-bottom: 10px;">Unable to load the product page preview.</p>
            <p style="color: #999; font-size: 14px; margin-bottom: 30px;">Error: ${error.message}</p>
            <a href="https://${session.shop}/products/${productHandle}" target="_blank" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              🌐 View Live Site
            </a>
          </div>
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
  }
};