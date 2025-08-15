import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import abTestingService from "../services/ab-testing.service.js";

export const action = async ({ request }) => {
  try {
    console.log("=== ORDERS_UPDATED WEBHOOK RECEIVED ===");
    
    // Clone the request to avoid "Body has already been read" error
    const clonedRequest = request.clone();
    const { topic, shop, session, admin } = await authenticate.webhook(request);

    if (!topic || !shop || !session) {
      console.error("Webhook authentication failed");
      return json({ status: "error", message: "Authentication failed" }, { status: 401 });
    }

    console.log("Shop:", shop);
    console.log("Topic:", topic);

    const payload = await clonedRequest.json();
    console.log("Order ID:", payload.id);
    console.log("Order Name:", payload.name);
    console.log("Total Price:", payload.total_price);
    console.log("Financial Status:", payload.financial_status);
    console.log("Fulfillment Status:", payload.fulfillment_status);

    // Only process orders that are paid and not already processed
    if (payload.financial_status === "paid") {
      console.log("Processing paid order for A/B testing tracking...");

      // Use the centralized service to process the purchase event
      await abTestingService.processPurchaseEvent({
        orderData: payload,
        shop: shop
      });
    } else {
      console.log("Order is not paid, skipping A/B testing tracking");
    }

    return json({ status: "success" });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 