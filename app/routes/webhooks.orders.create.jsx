import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import abTestingService from "../services/ab-testing.service.js";

export const action = async ({ request }) => {
  try {
    console.log("🔔 ORDERS_CREATE WEBHOOK RECEIVED - START");
    
    // Clone the request to avoid "Body has already been read" error
    const clonedRequest = request.clone();
    const { topic, shop, session, admin } = await authenticate.webhook(request);

    if (!topic || !shop || !session) {
      console.error("❌ Webhook authentication failed");
      console.error("Topic:", topic);
      console.error("Shop:", shop);
      console.error("Session:", !!session);
      return json({ status: "error", message: "Authentication failed" }, { status: 401 });
    }

    console.log("✅ Webhook authentication successful");
    console.log("Shop:", shop);
    console.log("Topic:", topic);

    const payload = await clonedRequest.json();
    console.log("📦 Order payload received:");
    console.log("- Order ID:", payload.id);
    console.log("- Order Name:", payload.name);
    console.log("- Total Price:", payload.total_price);
    console.log("- Financial Status:", payload.financial_status);
    console.log("- Fulfillment Status:", payload.fulfillment_status);
    console.log("- Line Items Count:", payload.line_items?.length || 0);
    console.log("- Customer Email:", payload.email);
    console.log("- Customer ID:", payload.customer?.id);

    // Only process paid orders
    if (payload.financial_status !== "paid") {
      console.log("⏭️ Order not paid, skipping A/B test tracking");
      console.log("Financial status:", payload.financial_status);
      return json({ status: "skipped", reason: "order_not_paid" });
    }

    console.log("💰 Order is paid, processing with ABTestingService...");

    // Use the centralized service to process the purchase event
    await abTestingService.processPurchaseEvent({
      orderData: payload,
      shop: shop
    });

    console.log("🎉 ORDERS_CREATE WEBHOOK PROCESSING COMPLETE");
    return json({ status: "success" });

  } catch (error) {
    console.error("❌ Error processing ORDERS_CREATE webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 