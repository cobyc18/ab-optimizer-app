import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import abTestingService from "../services/ab-testing.service.js";

export const action = async ({ request }) => {
  try {
    console.log("=== ORDER_TRANSACTIONS_CREATE WEBHOOK RECEIVED ===");
    
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
    console.log("Transaction ID:", payload.id);
    console.log("Order ID:", payload.order_id);
    console.log("Transaction Kind:", payload.kind);
    console.log("Transaction Status:", payload.status);
    console.log("Amount:", payload.amount);

    // Only process successful sales transactions
    if (payload.kind === "sale" && payload.status === "success") {
      console.log("Processing successful sale transaction for A/B testing tracking...");

      try {
        // Fetch the order details using the Admin API
        const orderResponse = await admin.rest({
          path: `orders/${payload.order_id}.json`
        });

        const orderData = await orderResponse.json();
        
        if (orderData.order) {
          const order = orderData.order;
          
          // Transform the order data to match our expected format
          const transformedOrder = {
            id: order.id.toString(),
            name: order.name,
            total_price: order.total_price || "0",
            financial_status: order.financial_status,
            fulfillment_status: order.fulfillment_status,
            email: order.email,
            customer: order.customer ? {
              id: order.customer.id.toString(),
              email: order.customer.email
            } : null,
            line_items: order.line_items?.map(item => ({
              id: item.id.toString(),
              product_id: item.product_id.toString(),
              variant_id: item.variant_id.toString(),
              quantity: item.quantity,
              price: item.price
            })) || [],
            note: order.note,
            tags: order.tags,
            note_attributes: order.note_attributes?.map(attr => ({
              name: attr.name,
              value: attr.value
            })) || []
          };

          // Use the centralized service to process the purchase event
          await abTestingService.processPurchaseEvent({
            orderData: transformedOrder,
            shop: shop
          });
        } else {
          console.log("Order not found or no data returned");
        }
      } catch (orderError) {
        console.error("Error retrieving order details:", orderError);
        // Don't fail the webhook, just log the error
      }
    } else {
      console.log("Transaction is not a successful sale, skipping A/B testing tracking");
    }

    console.log("=== ORDER_TRANSACTIONS_CREATE WEBHOOK PROCESSING COMPLETE ===");
    return json({ status: "success" });

  } catch (error) {
    console.error("Error processing ORDER_TRANSACTIONS_CREATE webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 