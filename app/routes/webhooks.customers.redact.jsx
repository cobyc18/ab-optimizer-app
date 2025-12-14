import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

/**
 * Mandatory compliance webhook: customers/redact
 * 
 * When a store owner requests that customer data be deleted, Shopify sends this webhook.
 * Your app must respond with a 200 status code and delete/redact the customer data
 * within 30 days (unless legally required to retain it).
 * 
 * Note: If a customer hasn't placed an order in the past 6 months, Shopify sends
 * this payload 10 days after the deletion request. Otherwise, it's withheld until
 * 6 months have passed.
 * 
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customers-redact
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
    console.log(`🗑️ Customer Redact webhook received for ${shop}`);

    const {
      shop_id,
      shop_domain,
      customer,
      orders_to_redact,
    } = payload;

    // Log the redaction request for compliance tracking
    console.log("Customer redaction request details:", {
      shopId: shop_id,
      shopDomain: shop_domain,
      customerId: customer?.id,
      customerEmail: customer?.email,
      ordersToRedact: orders_to_redact,
    });

    // TODO: Implement your data deletion/redaction logic here
    // You should:
    // 1. Delete or anonymize all customer data associated with this customer
    // 2. Delete or anonymize data associated with the orders in orders_to_redact
    // 3. Ensure you're not deleting data you're legally required to retain
    // 4. Log the redaction for audit purposes

    // Example: Delete customer-related data from your database
    // if (customer?.id) {
    //   await prisma.aBEvent.deleteMany({
    //     where: {
    //       shop: shop_domain,
    //       customerId: String(customer.id),
    //     },
    //   });
    // }

    // Example: Anonymize order-related data
    // if (orders_to_redact && orders_to_redact.length > 0) {
    //   await prisma.aBEvent.updateMany({
    //     where: {
    //       shop: shop_domain,
    //       orderId: {
    //         in: orders_to_redact.map(id => String(id)),
    //       },
    //     },
    //     data: {
    //       customerId: null,
    //       customerEmail: null,
    //       orderName: '[REDACTED]',
    //       purchaseValue: null,
    //     },
    //   });
    // }

    // IMPORTANT: You must respond with 200 OK
    return json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Error processing customers/redact webhook:", error);
    // For processing errors (after successful authentication), return 200
    // to prevent Shopify from retrying
    return json({ status: "error", message: error.message }, { status: 200 });
  }
};

