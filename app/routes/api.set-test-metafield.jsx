import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const { productId, value } = body;

    if (!productId) {
      return json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    if (typeof value !== 'boolean') {
      return json({ success: false, error: "Value must be a boolean." }, { status: 400 });
    }

    const { admin } = await authenticate.admin(request);

    // Get the product's GID for metafield
    let productGid = productId;
    if (!productGid.startsWith('gid://')) {
      const numericId = productGid.match(/Product\/(\d+)/)?.[1] || productGid.match(/^(\d+)$/)?.[1] || productGid;
      productGid = `gid://shopify/Product/${numericId}`;
    }

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

    const metafieldResponse = await admin.graphql(metafieldMutation, {
      variables: {
        metafields: [
          {
            ownerId: productGid,
            namespace: "ab_optimizer",
            key: "test_running",
            type: "boolean",
            value: value.toString()
          }
        ]
      }
    });

    const metafieldResult = await metafieldResponse.json();
    if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("⚠️ Metafield user errors:", metafieldResult.data.metafieldsSet.userErrors);
      return json({ 
        success: false, 
        error: metafieldResult.data.metafieldsSet.userErrors[0].message 
      }, { status: 400 });
    }

    console.log(`✅ Set product metafield: ab_optimizer.test_running = ${value}`);
    return json({ success: true });

  } catch (error) {
    console.error("⚠️ Failed to set product metafield:", error);
    return json({ 
      success: false, 
      error: error.message || "Failed to set product metafield" 
    }, { status: 500 });
  }
};
