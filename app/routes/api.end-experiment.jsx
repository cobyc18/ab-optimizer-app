import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import shopify from "../shopify.server.js";

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

    // Clear the product metafield since test is no longer running
    try {
      let productGid = test.productId;
      if (!productGid.startsWith('gid://')) {
        const numericId = productGid.match(/Product\/(\d+)/)?.[1] || productGid.match(/^(\d+)$/)?.[1] || productGid;
        productGid = `gid://shopify/Product/${numericId}`;
      }

      // Get admin client
      const { admin: adminClient } = await authenticate.admin(request);
      
      const metafieldMutation = `
        mutation productUpdateMetafield($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      const metafieldResponse = await adminClient.graphql(metafieldMutation, {
        variables: {
          metafields: [
            {
              ownerId: productGid,
              namespace: "ab_optimizer",
              key: "test_running",
              type: "boolean",
              value: "false"
            }
          ]
        }
      });
      
      const metafieldResult = await metafieldResponse.json();
      if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
        console.error("⚠️ Metafield user errors when clearing:", metafieldResult.data.metafieldsSet.userErrors);
      } else {
        console.log("✅ Cleared product metafield: ab_optimizer.test_running = false (test manually ended)");
      }
    } catch (metafieldError) {
      console.error("⚠️ Failed to clear metafield when ending test:", metafieldError);
      // Don't fail the endpoint if metafield clearing fails
    }

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

