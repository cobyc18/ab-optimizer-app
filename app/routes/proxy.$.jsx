export const action = async ({ request, params }) => {
  // Handle POST requests (like password form submissions)
  const url = new URL(request.url);
  const fullPath = params["*"];
  
  console.log('🔄 Reverse Proxy POST Request:', {
    url: request.url,
    fullPath,
    userAgent: request.headers.get('user-agent')
  });

  if (!fullPath) {
    return new Response("Store domain is required", { status: 400 });
  }

  // Extract store domain and path from the full path
  const pathParts = fullPath.split('/');
  const storeDomain = pathParts[0];
  const storePath = pathParts.slice(1).join('/');
  
  try {
    // Get form data from the request
    const formData = await request.formData();
    const password = formData.get('password');
    
    console.log('🔑 Password form submission:', {
      storeDomain,
      storePath,
      hasPassword: !!password
    });

    // Construct the target URL
    const targetUrl = `https://${storeDomain}/${storePath}`;
    
    // Submit the password to the store
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AB-Optimizer-App/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(formData)
    });

    console.log('📡 Password submission response status:', response.status);

    if (response.status === 200 || response.status === 302) {
      let html = await response.text();
      
      // Remove CSP headers that prevent iframe embedding
      html = html.replace(/content-security-policy[^>]*>/gi, '');
      html = html.replace(/x-frame-options[^>]*>/gi, '');
      
      // Add our own CSP headers that allow iframe embedding
      html = html.replace(
        /<head>/i, 
        `<head>
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com;">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">`
      );

      // Inject JavaScript to communicate with parent window
      const injectedScript = `
        <script>
          console.log('🎉 Password submitted successfully');
          
          // Send message to parent that page loaded successfully
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'password-submitted',
              storeDomain: '${storeDomain}'
            }, '*');
          }
        </script>
      `;

      html = html.replace('</body>', injectedScript + '</body>');

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
          'X-Frame-Options': 'ALLOWALL',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    } else {
      // Password was incorrect, return the password page again
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Incorrect Password</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com;">
            <meta http-equiv="X-Frame-Options" content="ALLOWALL">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
            <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px;">
              <div style="font-size: 3rem; margin-bottom: 20px;">❌</div>
              <h2 style="color: #333; margin-bottom: 15px;">Incorrect Password</h2>
              <p style="color: #666; margin-bottom: 30px;">The password you entered was incorrect. Please try again.</p>
              <button onclick="window.parent.postMessage({type: 'password-rejected'}, '*')" style="background: #EF4444; color: white; padding: 12px 24px; border-radius: 6px; border: none; cursor: pointer;">
                Try Again
              </button>
            </div>
          </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
          'X-Frame-Options': 'ALLOWALL',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
  } catch (error) {
    console.error('❌ Password submission error:', error);
    return new Response("Password submission failed", { status: 500 });
  }
};

export const loader = async ({ request, params }) => {
  const url = new URL(request.url);
  const fullPath = params["*"]; // This captures everything after /proxy/
  
  console.log('🔄 Reverse Proxy Request:', {
    url: request.url,
    fullPath,
    userAgent: request.headers.get('user-agent')
  });

  if (!fullPath) {
    return new Response("Store domain is required", { status: 400 });
  }

  // Extract store domain and path from the full path
  // fullPath should be like: "ogcc18.myshopify.com/products/the-videographer-snowboard"
  const pathParts = fullPath.split('/');
  const storeDomain = pathParts[0]; // "ogcc18.myshopify.com"
  const storePath = pathParts.slice(1).join('/'); // "products/the-videographer-snowboard"
  
  console.log('🔍 Parsed components:', {
    storeDomain,
    storePath,
    fullPath
  });

  try {
    // Construct the target URL
    const targetUrl = `https://${storeDomain}/${storePath}`;
    console.log('🎯 Fetching from target URL:', targetUrl);

    // Fetch the HTML from the live store
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AB-Optimizer-App/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    });

    console.log('📡 Target response status:', response.status);

    if (response.status === 200) {
      let html = await response.text();
      
      // Remove CSP headers that prevent iframe embedding
      html = html.replace(/content-security-policy[^>]*>/gi, '');
      html = html.replace(/x-frame-options[^>]*>/gi, '');
      
      // Add our own CSP headers that allow iframe embedding
      html = html.replace(
        /<head>/i, 
        `<head>
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com;">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">`
      );

      // Inject JavaScript to communicate with parent window
      const injectedScript = `
        <script>
          console.log('🎉 Live store loaded in iframe via reverse proxy');
          
          // Send message to parent that page loaded successfully
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'proxy-loaded',
              storeDomain: '${storeDomain}',
              url: '${targetUrl}'
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
                storeDomain: '${storeDomain}'
              }, '*');
            }
          }
          
          // Listen for password from parent
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'submit-password') {
              console.log('🔑 Received password from parent');
              
              // Find password form and submit it
              const passwordForm = document.querySelector('form[action*="password"], form');
              const passwordInput = document.querySelector('input[type="password"], input[name*="password"]');
              
              if (passwordForm && passwordInput) {
                // Modify the form action to submit back to our proxy
                const currentUrl = window.location.href;
                passwordForm.action = currentUrl;
                passwordForm.method = 'POST';
                
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

      console.log('✅ Serving proxied HTML with modified headers');
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
          'X-Frame-Options': 'ALLOWALL',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    } else if (response.status === 302 || response.status === 301) {
      // Handle redirects (like password pages)
      console.log('🔒 Redirect detected, likely password page');
      const redirectUrl = response.headers.get('location');
      
      if (redirectUrl) {
        // Follow the redirect
        const redirectResponse = await fetch(redirectUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AB-Optimizer-App/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
          }
        });
        
        let redirectHtml = await redirectResponse.text();
        
        // Remove CSP headers
        redirectHtml = redirectHtml.replace(/content-security-policy[^>]*>/gi, '');
        redirectHtml = redirectHtml.replace(/x-frame-options[^>]*>/gi, '');
        
        // Add our CSP headers
        redirectHtml = redirectHtml.replace(
          /<head>/i, 
          `<head>
            <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com;">
            <meta http-equiv="X-Frame-Options" content="ALLOWALL">`
        );

        // Inject password handling script
        const passwordScript = `
          <script>
            console.log('🔒 Password page loaded via reverse proxy');
            
            // Notify parent that password is required
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'password-required',
                storeDomain: '${storeDomain}'
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

        redirectHtml = redirectHtml.replace('</body>', passwordScript + '</body>');

        return new Response(redirectHtml, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
            'X-Frame-Options': 'ALLOWALL',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    }

    // If we get here, something went wrong
    console.log('❌ Failed to fetch target URL');
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Proxy Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com;">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
            <h2 style="color: #333; margin-bottom: 15px;">Proxy Error</h2>
            <p style="color: #666; margin-bottom: 30px;">Unable to fetch the requested page.</p>
            <a href="${targetUrl}" target="_blank" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              🌐 View Live Site
            </a>
          </div>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('❌ Reverse proxy error:', error);
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Proxy Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com;">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">❌</div>
            <h2 style="color: #333; margin-bottom: 15px;">Proxy Error</h2>
            <p style="color: #666; margin-bottom: 10px;">Unable to fetch the requested page.</p>
            <p style="color: #999; font-size: 14px; margin-bottom: 30px;">Error: ${error.message}</p>
            <a href="https://${storeDomain}" target="_blank" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              🌐 View Live Site
            </a>
          </div>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
