import { json } from "@remix-run/node";
import prisma from "../db.server.js";

/**
 * API endpoint to check if a widget should be enabled (visible) on the live storefront.
 * Widgets are only enabled if there's a running A/B test for the product.
 * This prevents visitors from seeing unconfigured widgets before the test is launched.
 * 
 * This endpoint can be called from the storefront (no authentication required for GET requests).
 * CORS headers are set to allow storefront access.
 */
export const loader = async ({ request }) => {
  // CORS headers for storefront access
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    const shop = url.searchParams.get('shop');

    if (!productId) {
      return json({ 
        enabled: false,
        error: 'Missing required parameter: productId'
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    if (!shop) {
      return json({ 
        enabled: false,
        error: 'Missing required parameter: shop'
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Normalize productId - extract numeric ID from Shopify GID format
    // Shopify GID format: gid://shopify/Product/123456789
    // Database stores: 123456789 (just the numeric part)
    const productNumericId = typeof productId === "string"
      ? (productId.match(/Product\/(\d+)/)?.[1] || productId)
      : productId;

    console.log('🔍 Checking widget enabled status:', {
      originalProductId: productId,
      normalizedProductId: productNumericId,
      shop: shop
    });

    // Check if there's a running test for this product - SCOPED BY SHOP
    const runningTest = await prisma.aBTest.findFirst({
      where: {
        shop: shop,
        productId: productNumericId,
        status: 'running'
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true
      }
    });

    const enabled = !!runningTest;

    console.log('🔍 Widget enabled check result:', {
      enabled: enabled,
      testName: runningTest?.name,
      testId: runningTest?.id
    });

    return json({ 
      enabled: enabled,
      testId: runningTest?.id,
      testName: runningTest?.name
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error in checkWidgetEnabled:', error);
    // Default to disabled on error (fail-safe)
    return json({ 
      enabled: false,
      error: `Server error: ${error.message}` 
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
};

// Handle OPTIONS request for CORS preflight
export const options = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
