import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  
  if (!shop) {
    return json({ error: "Shop parameter is required" }, { status: 400 });
  }

  // Generate the liquid code with the correct URLs for our standalone app
  const liquidCode = `{%- comment -%}
  ab-test-ab-redirect.liquid
  Injects JS for A/B bucketing and redirect using ?view=ab-b
  Usage: {% render 'ab-test-ab-redirect' %}
{%- endcomment -%}

<script>
// Global A/B test tracking system that works on all pages
(function() {
  console.log("=== GLOBAL A/B TEST TRACKING INITIALIZED COBY !!===");
  
  // Function to determine the current A/B test variant (global version)
  function determineCurrentVariantGlobal() {
    // Check if we have a stored bucket for any test
    var keys = Object.keys(localStorage);
    var testKeys = keys.filter(key => key.startsWith('ab_test_'));
    
    if (testKeys.length > 0) {
      var bucket = localStorage.getItem(testKeys[0]);
      if (bucket) {
        console.log("Using stored bucket for variant:", bucket);
        return bucket;
      }
    }
    
    // If no stored bucket, try to determine from URL
    var url = new URL(window.location.href);
    var currentView = url.searchParams.get('view') || "";
    
    if (currentView) {
      console.log("Determining variant from view parameter:", currentView);
      if (currentView === "default") {
        return "A"; // Assuming default template is variant A
      } else {
        return "B"; // Assuming custom templates are variant B
      }
    }
    
    // Fallback to variant A if we can't determine
    console.log("Could not determine variant, using fallback A");
    return "A";
  }
  
  // Global purchase tracking function
  function trackPurchaseGlobal(orderData) {
    console.log("Global purchase tracking triggered coby!:", orderData);
    
    // Try to get product ID from various sources
    var productId = null;
    
    // Method 1: Check if we're on a product page
    if (window.location.pathname.includes('/products/')) {
      // Extract product ID from URL or page data
      var productMatch = window.location.pathname.match(/\/products\/([^\/]+)/);
      if (productMatch) {
        // We'll need to look up the product ID by handle
        console.log("Product handle found:", productMatch[1]);
        // For now, we'll use a placeholder - in a real implementation, you'd look this up
        productId = "unknown";
      }
    }
    
    // Method 2: Check localStorage for recent product visits
    var keys = Object.keys(localStorage);
    var productKeys = keys.filter(key => key.includes('product') || key.includes('ab_test'));
    if (productKeys.length > 0) {
      console.log("Found product-related keys in localStorage:", productKeys);
    }
    
    // Method 3: Check sessionStorage for recent product visits
    var sessionKeys = Object.keys(sessionStorage);
    var sessionProductKeys = sessionKeys.filter(key => key.includes('product') || key.includes('ab_test'));
    if (sessionProductKeys.length > 0) {
      console.log("Found product-related keys in sessionStorage:", sessionProductKeys);
    }
    
    // If we can't determine product ID, still log the purchase
    if (!productId) {
      console.log("Could not determine product ID, logging purchase without product context");
      productId = "unknown";
    }
    
    var orderValue = orderData.total_price || orderData.totalPrice || orderData.price || 0;
    var orderId = orderData.id || orderData.order_id || orderData.orderId || null;
    var currentVariant = determineCurrentVariantGlobal();
    
    fetch('https://${shop}/apps/ab-optimizer-app/ab-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        eventType: 'purchase', 
        productId: String(productId),
        variant: currentVariant,
        value: orderValue,
        metadata: { 
          orderId: orderId,
          orderData: orderData,
          purchaseAmount: orderValue,
          pageUrl: window.location.href,
          detectedFrom: 'global_tracker'
        }
      })
    }).then(r => r.json()).then(data => {
      console.log("Logged global purchase event:", data);
    }).catch(e => {
      console.log("Failed to log global purchase event", e);
    });
  }
  
  // Enhanced purchase detection for all pages
  function detectPurchaseGlobal() {
    console.log("Global purchase detection checking page coby!!:", window.location.href);
    
    // Check multiple thank you page patterns
    var isThankYouPage = (
      window.location.pathname.includes('/thank_you') ||
      window.location.pathname.includes('/thank-you') ||
      window.location.pathname.includes('/order') ||
      window.location.pathname.includes('/orders') ||
      window.location.pathname.includes('/confirmation') ||
      window.location.pathname.includes('/success') ||
      window.location.pathname.includes('/checkouts') ||
      window.location.search.includes('thank_you') ||
      window.location.search.includes('order_id') ||
      window.location.search.includes('checkout') ||
      document.title.toLowerCase().includes('thank you') ||
      document.title.toLowerCase().includes('order confirmation') ||
      document.title.toLowerCase().includes('purchase confirmation') ||
      // Additional patterns for Shopify's standard thank you pages
      window.location.pathname.includes('/checkouts/') && window.location.pathname.includes('/thank') ||
      window.location.search.includes('key=') && window.location.search.includes('checkout') ||
      document.querySelector('[data-order-confirmation]') ||
      document.querySelector('.order-confirmation') ||
      document.querySelector('[data-thank-you]')
    );
    
    // Additional check for Shopify's standard thank you page patterns
    if (window.location.pathname.includes('/checkouts/') && 
        (window.location.pathname.includes('/thank_you') || 
         window.location.pathname.includes('/thank-you'))) {
      isThankYouPage = true;
    }
    
    if (!isThankYouPage) {
      console.log("Not on thank you page, skipping global purchase detection");
      return;
    }
    
    console.log("Thank you page detected, looking for order data...");
    
    var orderData = {};
    
    // Method 1: Look for order data in meta tags
    var orderMeta = document.querySelector('meta[name="order-id"]') || 
                    document.querySelector('meta[property="order-id"]') ||
                    document.querySelector('meta[name="order_id"]');
    if (orderMeta) {
      orderData.order_id = orderMeta.getAttribute('content');
      console.log("Found order ID in meta tag:", orderData.order_id);
    }
    
    // Method 2: Look for order data in script tags
    var scripts = document.querySelectorAll('script');
    scripts.forEach(function(script) {
      if (script.textContent && (
        script.textContent.includes('order') || 
        script.textContent.includes('checkout') ||
        script.textContent.includes('purchase') ||
        script.textContent.includes('total_price')
      )) {
        try {
          // Look for JSON objects containing order data
          var jsonMatches = script.textContent.match(/\\{[^}]*"order"[^}]*\\}/g) ||
                           script.textContent.match(/\\{[^}]*"total_price"[^}]*\\}/g) ||
                           script.textContent.match(/\\{[^}]*"checkout"[^}]*\\}/g);
          
          if (jsonMatches) {
            jsonMatches.forEach(function(match) {
              try {
                var orderInfo = JSON.parse(match);
                orderData = { ...orderData, ...orderInfo };
                console.log("Found order data in script:", orderInfo);
              } catch (e) {
                // Ignore parsing errors
              }
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    
    // Method 3: Look for order data in URL parameters
    var urlParams = new URLSearchParams(window.location.search);
    var orderIdFromUrl = urlParams.get('order_id') || urlParams.get('order-id') || urlParams.get('id');
    if (orderIdFromUrl) {
      orderData.order_id = orderIdFromUrl;
      console.log("Found order ID in URL:", orderIdFromUrl);
    }
    
    // Method 4: Look for order data in page content
    var orderElements = document.querySelectorAll('[data-order-id], [data-order], .order-id, .order-number');
    orderElements.forEach(function(element) {
      var orderId = element.getAttribute('data-order-id') || 
                    element.getAttribute('data-order') || 
                    element.textContent;
      if (orderId) {
        orderData.order_id = orderId.trim();
        console.log("Found order ID in page content:", orderId);
      }
    });
    
    // Method 5: Look for total price in page content
    var priceElements = document.querySelectorAll('[data-total], .total, .order-total, .amount');
    priceElements.forEach(function(element) {
      var priceText = element.textContent || element.innerText;
      if (priceText && priceText.match(/[\\d.,]+/)) {
        var price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (price > 0) {
          orderData.total_price = price;
          console.log("Found total price in page content:", price);
        }
      }
    });
    
    // If we found any order data, log the purchase
    if (Object.keys(orderData).length > 0) {
      console.log("Order data found:", orderData);
      trackPurchaseGlobal(orderData);
    } else {
      console.log("No order data found, but on thank you page - logging basic purchase event");
      // Log a basic purchase event even without detailed order data
      trackPurchaseGlobal({ 
        order_id: 'unknown',
        total_price: 0,
        detected_from: 'thank_you_page_global'
      });
    }
    
    // Also check for purchase intent as backup
    checkForCompletedPurchase();
  }
  
  // Purchase intent tracking - track when user starts checkout process
  function trackPurchaseIntent(productId, variant) {
    console.log("Tracking purchase intent for product:", productId, "variant:", variant);
    
    // Store purchase intent in localStorage
    var purchaseIntent = {
      productId: productId,
      variant: variant,
      timestamp: Date.now(),
      checkoutStarted: true
    };
    
    localStorage.setItem('ab_purchase_intent', JSON.stringify(purchaseIntent));
    console.log("Purchase intent stored:", purchaseIntent);
  }
  
  // Check for completed purchases by monitoring URL changes
  function checkForCompletedPurchase() {
    var currentUrl = window.location.href;
    
    // Check if we're on a thank you page
    if (currentUrl.includes('/thank_you') || 
        currentUrl.includes('/thank-you') || 
        currentUrl.includes('/checkouts') && currentUrl.includes('/thank')) {
      
      console.log("Thank you page detected, checking for purchase intent...");
      
      // Get stored purchase intent
      var purchaseIntentStr = localStorage.getItem('ab_purchase_intent');
      if (purchaseIntentStr) {
        try {
          var purchaseIntent = JSON.parse(purchaseIntentStr);
          console.log("Found purchase intent:", purchaseIntent);
          
          // Calculate time difference to ensure it's recent (within 1 hour)
          var timeDiff = Date.now() - purchaseIntent.timestamp;
          var oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
          
          if (timeDiff < oneHour) {
            console.log("Recent purchase intent found, logging purchase event");
            
            // Log the purchase event
            trackPurchaseGlobal({
              order_id: 'from_intent_' + Date.now(),
              total_price: 0, // We don't have the exact amount from intent
              productId: purchaseIntent.productId,
              variant: purchaseIntent.variant,
              detected_from: 'purchase_intent_tracking'
            });
            
            // Clear the purchase intent
            localStorage.removeItem('ab_purchase_intent');
            console.log("Purchase intent cleared");
          } else {
            console.log("Purchase intent too old, clearing");
            localStorage.removeItem('ab_purchase_intent');
          }
        } catch (e) {
          console.log("Error parsing purchase intent:", e);
          localStorage.removeItem('ab_purchase_intent');
        }
      } else {
        console.log("No purchase intent found");
      }
    }
  }
  
  // Monitor URL changes for purchase completion
  function setupPurchaseMonitoring() {
    var currentUrl = window.location.href;
    
    // Check immediately
    checkForCompletedPurchase();
    
    // Monitor for URL changes
    var lastUrl = currentUrl;
    setInterval(function() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log("URL changed to:", lastUrl);
        checkForCompletedPurchase();
      }
    }, 1000); // Check every second
    
    // Also listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', function() {
      console.log("Popstate event, checking for purchase completion");
      setTimeout(checkForCompletedPurchase, 500);
    });
    
    // Listen for beforeunload to check if user is leaving to checkout
    window.addEventListener('beforeunload', function() {
      var purchaseIntentStr = localStorage.getItem('ab_purchase_intent');
      if (purchaseIntentStr) {
        console.log("User leaving page with purchase intent");
      }
    });
  }
  
  // Run global purchase detection when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      detectPurchaseGlobal();
      setupPurchaseMonitoring();
    });
  } else {
    detectPurchaseGlobal();
    setupPurchaseMonitoring();
  }
  
  // Also run on window load to catch any late-loading content
  window.addEventListener('load', function() {
    detectPurchaseGlobal();
    setupPurchaseMonitoring();
  });
  
  // Listen for page visibility changes (in case user returns to thank you page)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      detectPurchaseGlobal();
      checkForCompletedPurchase();
    }
  });
  
  // Expose functions globally for use in product page tracking
  window.ABTestTracking = {
    trackPurchaseIntent: trackPurchaseIntent,
    trackPurchaseGlobal: trackPurchaseGlobal,
    checkForCompletedPurchase: checkForCompletedPurchase
  };
  
  console.log("=== GLOBAL A/B TEST TRACKING SETUP COMPLETE ===");
})();
</script>

{% if product %}
<script>
// Prevent multiple executions of this script using sessionStorage
var scriptId = 'ab-test-script-' + {{ product.id | json }};
if (sessionStorage.getItem(scriptId)) {
  console.log("A/B test script already executed for this product, skipping...");
} else {
  sessionStorage.setItem(scriptId, 'true');
  
  (async function() {
    console.log("=== A/B TEST DEBUG START ===");
    console.log("Current URL:", window.location.href);
    console.log("Hostname:", window.location.hostname);
    console.log("Pathname:", window.location.pathname);
    
    var rawId = {{ product.id | json }};
    var productId = rawId;
    if (typeof rawId === "string" && rawId.startsWith("gid://")) {
      var match = rawId.match(/Product\\/(\\\\d+)/);
      if (match) productId = match[1];
    }
    console.log("Product ID:", productId);

    // Check current URL parameters
    var url = new URL(window.location.href);
    var currentView = url.searchParams.get('view') || "";
    var previewPath = url.searchParams.get('previewPath') || "";
    var noRedirect = url.searchParams.get('no_redirect') || "";
    console.log("Current view parameter:", currentView);
    console.log("Preview path parameter:", previewPath);
    console.log("No redirect parameter:", noRedirect);
    
    // Multiple ways to detect theme editor
    var isThemeEditor = (
      window.location.hostname === "admin.shopify.com" && 
      window.location.pathname.includes("/themes/") && 
      window.location.pathname.includes("/editor")
    ) || (
      window.location.hostname === "admin.shopify.com" && 
      previewPath !== ""
    ) || (
      window.location.href.includes("context=apps")
    );
    
    console.log("Is theme editor:", isThemeEditor);
    
    // CRITICAL: If we're in theme editor, NEVER redirect
    if (isThemeEditor) {
      console.log("In Shopify theme editor - NEVER redirecting");
      console.log("=== A/B TEST DEBUG END ===");
      return;
    }
    
    // If no_redirect parameter is present, skip redirect
    if (noRedirect === "true") {
      console.log("No redirect parameter detected - skipping A/B test redirect");
      console.log("=== A/B TEST DEBUG END ===");
      return;
    }

    // If there's already a view parameter, don't redirect - user is manually navigating
    if (currentView && currentView !== "") {
      console.log("User is manually viewing template:", currentView, "- no redirect");
      // Still log the impression for the current template
      var res = await fetch('https://${shop}/apps/ab-optimizer-app/ab-test-config?productId=' + encodeURIComponent(productId));
      if (res.ok) {
        var config = await res.json();
        if (config.testId) {
          fetch('https://${shop}/apps/ab-optimizer-app/ab-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testId: config.testId, variant: currentView, eventType: 'impression', productId: String(productId) })
          }).then(r => r.json()).then(data => {
            console.log("Logged impression event for manual view:", data);
          }).catch(e => {
            console.log("Failed to log impression event", e);
          });
        }
      }
      console.log("=== A/B TEST DEBUG END ===");
      return;
    }

    // Additional safety checks for manual navigation
    var isManualNavigation = false;
    
    // Check if user came from another template (referrer contains view parameter)
    if (document.referrer) {
      var referrerUrl = new URL(document.referrer);
      var referrerView = referrerUrl.searchParams.get('view');
      if (referrerView && referrerView !== "") {
        console.log("User navigated from template with view parameter:", referrerView, "- treating as manual navigation");
        isManualNavigation = true;
      }
    }
    
    // Only treat as manual navigation if there's a specific referrer with view parameter
    // Don't treat direct visits or internal navigation as manual navigation
    // This allows normal customer visits to trigger A/B testing
    
    if (isManualNavigation) {
      console.log("Manual navigation detected - skipping A/B test redirect");
      console.log("=== A/B TEST DEBUG END ===");
      return;
    }

    console.log("Fetching A/B test config...");
    var res = await fetch('https://${shop}/apps/ab-optimizer-app/ab-test-config?productId=' + encodeURIComponent(productId));
    if (!res.ok) {
      console.log("Failed to fetch test config");
      console.log("=== A/B TEST DEBUG END ===");
      return;
    }
    var config = await res.json();
    console.log("Fetched config:", config);
    if (!config.testId) {
      console.log("No testId in config");
      console.log("=== A/B TEST DEBUG END ===");
      return;
    }

    var testId = config.testId;
    var variantA = config.templateA;
    var variantB = config.templateB;
    var bucketKey = 'ab_test_' + testId;
    var bucket = localStorage.getItem(bucketKey);

    if (!bucket) {
      bucket = Math.random() < config.trafficSplit / 100 ? variantA : variantB;
      localStorage.setItem(bucketKey, bucket);
      console.log("Assigned bucket:", bucket);
    } else {
      console.log("Existing bucket:", bucket);
    }

    // Store test ID globally for tracking functions
    window.currentTestId = testId;
    window.currentVariant = bucket;

    // Only redirect for actual customer visits (not manual navigation)
    if (bucket && bucket !== "" && !currentView) {
      url.searchParams.set('view', bucket);
      console.log("Redirecting to variant:", url.toString());
      window.location.replace(url.toString());
    } else {
      console.log("No redirect needed. Current view:", currentView, "Bucket:", bucket);
    }

    // Log impression event (only once per page load using sessionStorage)
    var impressionKey = 'impression-' + productId + '-' + Date.now();
    if (!sessionStorage.getItem(impressionKey)) {
      sessionStorage.setItem(impressionKey, 'true');
      fetch('https://${shop}/apps/ab-optimizer-app/ab-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, variant: bucket, eventType: 'impression', productId: String(productId) })
      }).then(r => r.json()).then(data => {
        console.log("Logged impression event:", data);
      }).catch(e => {
        console.log("Failed to log impression event", e);
      });
    } else {
      console.log("Impression already logged, skipping...");
    }
    
    console.log("=== A/B TEST DEBUG END ===");
  })();
}
</script>
{% endif %}`;

  return new Response(liquidCode, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache'
    }
  });
}; 