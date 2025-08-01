import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const action = async ({ request }) => {
  // Clone the request to avoid "Body has already been read" error
  const clonedRequest = request.clone();
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  if (!topic || !shop || !session) {
    console.error("Webhook authentication failed");
    return json({ status: "error", message: "Authentication failed" }, { status: 401 });
  }

  try {
    const payload = await clonedRequest.json();
    console.log("=== ORDERS_UPDATED WEBHOOK RECEIVED ===");
    console.log("Shop:", shop);
    console.log("Topic:", topic);
    console.log("Order ID:", payload.id);
    console.log("Order Name:", payload.name);
    console.log("Total Price:", payload.total_price);
    console.log("Financial Status:", payload.financial_status);
    console.log("Fulfillment Status:", payload.fulfillment_status);

    // Only process orders that are paid and not already processed
    if (payload.financial_status === "paid") {
      console.log("Processing paid order for A/B testing tracking...");

      // Try to determine which A/B test variant was shown
      let variant = "A"; // Default fallback
      let productId = null;

      // Method 1: Check order line items for product information
      if (payload.line_items && payload.line_items.length > 0) {
        const firstItem = payload.line_items[0];
        if (firstItem.product_id) {
          productId = String(firstItem.product_id);
          console.log("Found product ID from line item:", productId);
        }
      }

      // Method 2: Check order note for variant information
      if (payload.note) {
        const variantMatch = payload.note.match(/ab_variant:([AB])/i);
        if (variantMatch) {
          variant = variantMatch[1].toUpperCase();
          console.log("Found variant in order note:", variant);
        }
      }

      // Method 3: Check order tags for variant information
      if (payload.tags) {
        const variantMatch = payload.tags.match(/ab_variant:([AB])/i);
        if (variantMatch) {
          variant = variantMatch[1].toUpperCase();
          console.log("Found variant in order tags:", variant);
        }
      }

      // Method 4: Check order attributes for variant information
      if (payload.note_attributes) {
        const variantAttr = payload.note_attributes.find(attr => 
          attr.name && attr.name.toLowerCase().includes('ab_variant')
        );
        if (variantAttr && variantAttr.value) {
          variant = variantAttr.value.toUpperCase();
          console.log("Found variant in order attributes:", variant);
        }
      }

      // If we don't have a product ID, try to get it from the first line item
      if (!productId && payload.line_items && payload.line_items.length > 0) {
        productId = String(payload.line_items[0].product_id || "unknown");
      }

      // Log the purchase event to database
      try {
        const event = await prisma.aBEvent.create({
          data: {
            eventType: "purchase",
            productId: productId || "unknown",
            variant: variant,
            value: parseFloat(payload.total_price || "0"),
            metadata: {
              orderId: payload.id,
              orderName: payload.name,
              financialStatus: payload.financial_status,
              fulfillmentStatus: payload.fulfillment_status,
              customerId: payload.customer?.id,
              customerEmail: payload.customer?.email,
              detectedFrom: "webhook_orders_updated",
              shop: shop
            }
          }
        });

        console.log("✅ Purchase event logged to database:", event.id);
      } catch (dbError) {
        console.error("❌ Failed to log purchase event to database:", dbError);
      }
    } else {
      console.log("Order is not paid, skipping A/B testing tracking");
    }

    return json({ status: "success" });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 