import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

/**
 * Mandatory compliance webhook: shop/redact
 * 
 * 48 hours after a store owner uninstalls your app, Shopify sends this webhook.
 * Your app must respond with a 200 status code and delete all shop data from your database.
 * 
 * This webhook provides shop_id and shop_domain so you can identify and delete
 * all data associated with that shop.
 * 
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#shop-redact
 */
export const action = async ({ request }) => {
  let topic, shop, payload;
  
  try {
    const authResult = await authenticate.webhook(request);
    topic = authResult.topic;
    shop = authResult.shop;
    payload = authResult.payload;

    // Check if authentication was successful
    if (!topic || !shop) {
      console.error("❌ Webhook authentication failed - missing topic or shop");
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (authError) {
    // authenticate.webhook() throws an error when HMAC validation fails
    console.error("❌ Webhook HMAC validation failed:", authError.message);
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(`🏪 Shop Redact webhook received for ${shop}`);

    const {
      shop_id,
      shop_domain,
    } = payload;

    // Log the redaction request for compliance tracking
    console.log("Shop redaction request details:", {
      shopId: shop_id,
      shopDomain: shop_domain,
    });

    // TODO: Implement your shop data deletion logic here
    // You should:
    // 1. Delete all A/B tests associated with this shop
    // 2. Delete all events associated with this shop
    // 3. Delete all widget configs associated with this shop
    // 4. Delete the shop record itself
    // 5. Ensure you're not deleting data you're legally required to retain

    // Example: Delete all shop-related data from your database
    try {
      // Delete all A/B tests for this shop
      await prisma.aBTest.deleteMany({
        where: { shop: shop_domain },
      });

      // Delete all events for this shop
      await prisma.aBEvent.deleteMany({
        where: { shop: shop_domain },
      });

      // Delete all widget configs for this shop
      await prisma.widgetConfig.deleteMany({
        where: { shop: shop_domain },
      });

      // Delete the shop record
      await prisma.shop.deleteMany({
        where: { shop: shop_domain },
      });

      console.log(`✅ Successfully deleted all data for shop: ${shop_domain}`);
    } catch (dbError) {
      console.error(`❌ Error deleting shop data for ${shop_domain}:`, dbError);
      // Continue to return 200 even if deletion fails
      // Log the error for your internal tracking
    }

    // IMPORTANT: You must respond with 200 OK
    return json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Error processing shop/redact webhook:", error);
    // For processing errors (after successful authentication), return 200
    // to prevent Shopify from retrying
    return json({ status: "error", message: error.message }, { status: 200 });
  }
};

