import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

/**
 * API endpoint to manually end an A/B test.
 * Sets status to "manually_ended" and stops redirecting visitors.
 */
export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const body = await request.json();
    
    const { testId } = body;

    if (!testId) {
      return json({ 
        success: false,
        error: 'Missing required parameter: testId'
      }, { status: 400 });
    }

    if (!session?.shop) {
      return json({ 
        success: false,
        error: 'Missing shop information'
      }, { status: 401 });
    }

    // Verify the test belongs to this shop
    const test = await prisma.aBTest.findFirst({
      where: {
        id: testId,
        shop: session.shop
      }
    });

    if (!test) {
      return json({ 
        success: false,
        error: 'Test not found or does not belong to this shop'
      }, { status: 404 });
    }

    // Update test status to manually_ended
    await prisma.aBTest.update({
      where: { id: testId },
      data: {
        status: 'manually_ended',
        endDate: new Date()
      }
    });

    console.log(`✅ Test ${testId} manually ended by shop ${session.shop}`);

    return json({ 
      success: true,
      message: 'Experiment ended successfully'
    });

  } catch (error) {
    console.error('❌ Error in endExperiment:', error);
    return json({ 
      success: false,
      error: `Server error: ${error.message}` 
    }, { status: 500 });
  }
};

