import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

/**
 * API endpoint to check if a product is already being used in a running A/B test.
 * This prevents users from selecting products that are already in active tests.
 */
export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const body = await request.json();
    
    const { productId } = body;

    if (!productId) {
      return json({ 
        error: 'Missing required parameter: productId',
        inUse: false
      }, { status: 400 });
    }

    if (!session?.shop) {
      return json({ 
        error: 'Missing shop information',
        inUse: false
      }, { status: 401 });
    }

    // Check if there's a running test for this product
    const runningTest = await prisma.aBTest.findFirst({
      where: {
        shop: session.shop,
        productId: productId,
        status: 'running'
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true
      }
    });

    if (runningTest) {
      return json({ 
        inUse: true,
        testName: runningTest.name,
        testId: runningTest.id,
        startDate: runningTest.startDate
      });
    }

    return json({ 
      inUse: false
    });

  } catch (error) {
    console.error('❌ Error in checkProductInTest:', error);
    return json({ 
      inUse: false,
      error: `Server error: ${error.message}` 
    }, { status: 500 });
  }
};

