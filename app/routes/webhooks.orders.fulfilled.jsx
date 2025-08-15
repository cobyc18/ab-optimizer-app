import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import abTestingService from "../services/ab-testing.service.js";

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
    console.log("=== ORDERS_FULFILLED WEBHOOK RECEIVED ===");
    console.log("Shop:", shop);
    console.log("Topic:", topic);
    console.log("Order ID:", payload.id);
    console.log("Order Name:", payload.name);
    console.log("Total Price:", payload.total_price);
    console.log("Financial Status:", payload.financial_status);
    console.log("Fulfillment Status:", payload.fulfillment_status);

    // Process fulfilled orders for A/B testing tracking
    console.log("Processing fulfilled order for A/B testing tracking...");

    // Use the centralized service to process the purchase event
    await abTestingService.processPurchaseEvent({
      orderData: payload,
      shop: shop
    });

    return json({ status: "success" });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 