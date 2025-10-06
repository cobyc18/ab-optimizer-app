export const loader = async ({ request, params }) => {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Handle GET requests (existing logic)
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
      
      // Remove any existing CSP meta tags
      html = html.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');
      html = html.replace(/<meta[^>]*x-frame-options[^>]*>/gi, '');

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
          
          // Intercept form submissions to prevent redirects
          document.addEventListener('submit', function(e) {
            const form = e.target;
            if (form.tagName === 'FORM' && form.querySelector('input[type="password"]')) {
              e.preventDefault();
              console.log('🔒 Intercepted password form submission');
              
              const passwordInput = form.querySelector('input[type="password"]');
              const password = passwordInput.value;
              
              if (!password) {
                console.error('❌ No password provided');
                return;
              }
              
              // Submit via fetch to our proxy
              const formData = new FormData(form);
              
              fetch(window.location.href, {
                method: 'POST',
                body: formData
              })
              .then(response => {
                if (response.ok) {
                  return response.text();
                }
                throw new Error('Password submission failed');
              })
              .then(html => {
                document.open();
                document.write(html);
                document.close();
              })
              .catch(error => {
                console.error('❌ Password submission error:', error);
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'password-rejected',
                    error: error.message
                  }, '*');
                }
              });
            }
          });
          
          // Listen for password from parent
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'submit-password') {
              console.log('🔑 Received password from parent');
              
              // Find password form and submit it
              const passwordForm = document.querySelector('form[action*="password"], form');
              const passwordInput = document.querySelector('input[type="password"], input[name*="password"]');
              
              if (passwordForm && passwordInput) {
                passwordInput.value = event.data.password;
                
                // Trigger form submission (which will be intercepted above)
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                passwordForm.dispatchEvent(submitEvent);
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
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    } else if (response.status === 302) {
      // Handle redirects (like password protection)
      const redirectUrl = response.headers.get('location');
      console.log('🔄 Redirect detected to:', redirectUrl);
      
      if (redirectUrl) {
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
        
        // Remove any existing CSP meta tags
        redirectHtml = redirectHtml.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');
        redirectHtml = redirectHtml.replace(/<meta[^>]*x-frame-options[^>]*>/gi, '');

        // Inject password handling script
        const passwordScript = `
          <script>
            console.log('🔒 Password page loaded via reverse proxy');
            
            // Send message to parent that password is required
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'password-required',
                storeDomain: '${storeDomain}'
              }, '*');
            }
            
            // Intercept form submissions
            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (form.tagName === 'FORM' && form.querySelector('input[type="password"]')) {
                e.preventDefault();
                console.log('🔒 Intercepted password form submission');
                
                const passwordInput = form.querySelector('input[type="password"]');
                const password = passwordInput.value;
                
                if (!password) {
                  console.error('❌ No password provided');
                  return;
                }
                
                // Submit via fetch to our proxy
                const formData = new FormData(form);
                
                fetch(window.location.href, {
                  method: 'POST',
                  body: formData
                })
                .then(response => {
                  if (response.ok) {
                    return response.text();
                  }
                  throw new Error('Password submission failed');
                })
                .then(html => {
                  document.open();
                  document.write(html);
                  document.close();
                })
                .catch(error => {
                  console.error('❌ Password submission error:', error);
                  if (window.parent !== window) {
                    window.parent.postMessage({
                      type: 'password-rejected',
                      error: error.message
                    }, '*');
                  }
                });
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
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      }
    }

    // If we get here, return the original response
    return response;
  } catch (error) {
    console.error('❌ Error in reverse proxy loader:', error);
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
            <p style="color: #666; margin-bottom: 30px;">Unable to load the live product page through the proxy.</p>
            <p style="color: #999; font-size: 14px; margin-top: 10px;">Error: ${error.message}</p>
            <button onclick="window.location.reload()" style="background: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; border: none; cursor: pointer;">
              Reload Preview
            </button>
          </div>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
};

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
    console.log('📡 Password submission response headers:', Object.fromEntries(response.headers.entries()));

        if (response.status === 200) {
          let html = await response.text();
          
          // Check if we're still on a password page (incorrect password)
          const isPasswordPage = html.includes('password') || 
                                html.includes('Password') || 
                                html.includes('input[type="password"]') ||
                                html.includes('Enter password');
          
          console.log('🔍 Is still password page after submission:', isPasswordPage);
          
          // Remove CSP headers that prevent iframe embedding
          html = html.replace(/content-security-policy[^>]*>/gi, '');
          html = html.replace(/x-frame-options[^>]*>/gi, '');
          
          // Remove any existing CSP meta tags
          html = html.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');
          html = html.replace(/<meta[^>]*x-frame-options[^>]*>/gi, '');
          
          // Remove any remaining CSP-related content
          html = html.replace(/frame-ancestors[^;]*;?/gi, '');
          html = html.replace(/X-Frame-Options[^;]*;?/gi, '');

          // Inject JavaScript to communicate with parent window and handle password forms
          const injectedScript = `
            <script>
              console.log('🎉 Password submitted successfully');
              
              // Check if we're still on a password page
              const stillOnPasswordPage = document.querySelector('input[type="password"]') !== null ||
                                        document.title.includes('Password') ||
                                        document.body.textContent.includes('password');
              
              if (stillOnPasswordPage) {
                console.log('❌ Still on password page - password may be incorrect');
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'password-rejected',
                    error: 'Incorrect password. Please try again.'
                  }, '*');
                }
              } else {
                console.log('✅ Password accepted - product page loaded');
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'password-accepted',
                    storeDomain: '${storeDomain}'
                  }, '*');
                }
              }
              
              // Handle password submission for both forms and standalone password inputs
              function handlePasswordSubmission(passwordValue) {
                console.log('🔑 Submitting password:', passwordValue);
                
                const formData = new FormData();
                formData.append('password', passwordValue);
                
                fetch(window.location.href, {
                  method: 'POST',
                  body: formData
                })
                .then(response => {
                  if (response.ok) {
                    return response.text();
                  }
                  throw new Error('Password submission failed');
                })
                .then(html => {
                  document.open();
                  document.write(html);
                  document.close();
                })
                .catch(error => {
                  console.error('❌ Password submission error:', error);
                  if (window.parent !== window) {
                    window.parent.postMessage({
                      type: 'password-rejected',
                      error: error.message
                    }, '*');
                  }
                });
              }
              
              // Intercept form submissions
              document.addEventListener('submit', function(e) {
                const form = e.target;
                if (form.tagName === 'FORM' && form.querySelector('input[type="password"]')) {
                  e.preventDefault();
                  console.log('🔒 Intercepted password form submission');
                  
                  const passwordInput = form.querySelector('input[type="password"]');
                  const password = passwordInput.value;
                  
                  if (!password) {
                    console.error('❌ No password provided');
                    return;
                  }
                  
                  handlePasswordSubmission(password);
                }
              });
              
              // Listen for password from parent (for standalone password inputs)
              window.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'submit-password') {
                  console.log('🔑 Received password from parent');
                  
                  const passwordInput = document.querySelector('input[type="password"]');
                  if (passwordInput) {
                    passwordInput.value = event.data.password;
                    handlePasswordSubmission(event.data.password);
                  } else {
                    console.error('❌ Could not find password input');
                    if (window.parent !== window) {
                      window.parent.postMessage({
                        type: 'password-rejected',
                        error: 'Could not find password input'
                      }, '*');
                    }
                  }
                }
              });
            </script>
          `;

          html = html.replace('</body>', injectedScript + '</body>');

          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
              'X-Frame-Options': 'ALLOWALL',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
          });
        } else if (response.status === 302 || response.status === 301) {
          // Handle redirects after password submission
          const redirectUrl = response.headers.get('location');
          console.log('🔄 Password submission redirect to:', redirectUrl);
          
          if (redirectUrl) {
            // Follow the redirect and fetch the actual product page
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
            
            // Remove any existing CSP meta tags
            redirectHtml = redirectHtml.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');
            redirectHtml = redirectHtml.replace(/<meta[^>]*x-frame-options[^>]*>/gi, '');

            // Inject success script
            const successScript = `
              <script>
                console.log('🎉 Password accepted - redirecting to product page');
                
                // Send message to parent that password was accepted
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'password-accepted',
                    storeDomain: '${storeDomain}'
                  }, '*');
                }
              </script>
            `;
            
            redirectHtml = redirectHtml.replace('</body>', successScript + '</body>');

            return new Response(redirectHtml, {
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': 'frame-ancestors https://ab-optimizer-app.onrender.com https://admin.shopify.com',
                'X-Frame-Options': 'ALLOWALL',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
              }
            });
          }
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
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
    }
  } catch (error) {
    console.error('❌ Password submission error:', error);
    return new Response("Password submission failed", { status: 500 });
  }
};

