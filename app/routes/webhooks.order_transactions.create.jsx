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
    console.log("=== ORDER_TRANSACTIONS_CREATE WEBHOOK RECEIVED ===");
    console.log("Shop:", shop);
    console.log("Topic:", topic);
    console.log("Transaction ID:", payload.id);
    console.log("Order ID:", payload.order_id);
    console.log("Transaction Kind:", payload.kind);
    console.log("Transaction Status:", payload.status);
    console.log("Amount:", payload.amount);

    // Only process successful transactions
    if (payload.status !== "success") {
      console.log("Transaction not successful, skipping A/B test tracking");
      return json({ status: "skipped", reason: "transaction_not_successful" });
    }

    // Only process capture or sale transactions (actual payments)
    if (!["capture", "sale", "authorization"].includes(payload.kind)) {
      console.log("Transaction kind not relevant for purchase tracking, skipping");
      return json({ status: "skipped", reason: "transaction_kind_not_relevant" });
    }

    // Get the order details to find line items
    try {
      const orderResponse = await admin.rest.get({
        path: `orders/${payload.order_id}.json`,
      });

      const order = orderResponse.data?.order;
      if (!order) {
        console.error("Order not found in response:", orderResponse);
        return json({ status: "error", message: "Order not found" }, { status: 404 });
      }
      console.log("Retrieved order details:", order.name);

      // Process each line item in the order
      if (order.line_items && order.line_items.length > 0) {
        for (const lineItem of order.line_items) {
          const productId = lineItem.product_id;
          const variantId = lineItem.variant_id;
          const quantity = lineItem.quantity;
          const price = parseFloat(lineItem.price) || 0;
          const totalPrice = price * quantity;

          console.log(`Processing line item - Product ID: ${productId}, Variant ID: ${variantId}, Quantity: ${quantity}, Price: ${price}`);

          // Check if this product has an active A/B test
          console.log(`🔍 Looking for active test for product ${productId} in shop ${session.shop}`);
          
          const activeTest = await prisma.aBTest.findFirst({
            where: {
              productId: String(productId),
              shop: session.shop,
              status: { in: ['active', 'running', 'live'] },
              startDate: { lte: new Date() },
              OR: [
                { endDate: null },
                { endDate: { gte: new Date() } }
              ]
            }
          });

          if (activeTest) {
            console.log(`✅ Found active test: ${activeTest.name} (${activeTest.id})`);
          } else {
            console.log(`❌ No active test found for product ${productId}`);
          }

          if (activeTest) {
            console.log(`Found active A/B test for product ${productId}:`, activeTest.id);

            // Check if we already logged a purchase event for this order/product combination
            const existingEvent = await prisma.aBEvent.findFirst({
              where: {
                testId: activeTest.id,
                eventType: "purchase",
                productId: String(productId),
                metadata: {
                  path: ["orderId"],
                  equals: payload.order_id
                }
              }
            });

            if (existingEvent) {
              console.log(`Purchase event already logged for order ${payload.order_id}, product ${productId}`);
              continue;
            }

            // Determine which variant the customer saw
            let variant = activeTest.templateA; // Default to template A
            
            // Check if there's any metadata or note that indicates which variant was shown
            if (order.note) {
              // Look for template names in the note
              if (order.note.includes(activeTest.templateA)) {
                variant = activeTest.templateA;
              } else if (order.note.includes(activeTest.templateB)) {
                variant = activeTest.templateB;
              } else {
                // Fallback to generic A/B detection
                const variantMatch = order.note.match(/ab_variant[:\s]+([AB])/i);
                if (variantMatch) {
                  variant = variantMatch[1].toUpperCase() === 'A' ? activeTest.templateA : activeTest.templateB;
                }
              }
            }

            // Check note attributes for variant information
            if (order.note_attributes) {
              const variantAttr = order.note_attributes.find(attr => 
                attr.name && attr.name.toLowerCase().includes('ab_variant')
              );
              if (variantAttr && variantAttr.value) {
                if (variantAttr.value.includes(activeTest.templateA)) {
                  variant = activeTest.templateA;
                } else if (variantAttr.value.includes(activeTest.templateB)) {
                  variant = activeTest.templateB;
                } else {
                  // Fallback to generic A/B detection
                  variant = variantAttr.value.toUpperCase() === 'A' ? activeTest.templateA : activeTest.templateB;
                }
              }
            }

            // Check tags for variant information
            if (order.tags) {
              const variantTag = order.tags.split(',').find(tag => 
                tag.trim().toLowerCase().includes('ab_variant')
              );
              if (variantTag) {
                if (variantTag.includes(activeTest.templateA)) {
                  variant = activeTest.templateA;
                } else if (variantTag.includes(activeTest.templateB)) {
                  variant = activeTest.templateB;
                } else {
                  // Fallback to generic A/B detection
                  const variantMatch = variantTag.match(/ab_variant[:\s]+([AB])/i);
                  if (variantMatch) {
                    variant = variantMatch[1].toUpperCase() === 'A' ? activeTest.templateA : activeTest.templateB;
                  }
                }
              }
            }

            console.log(`Determined variant: ${variant}`);

            // Log the purchase event
            const purchaseEvent = await prisma.aBEvent.create({
              data: {
                testId: activeTest.id,
                eventType: "purchase",
                productId: String(productId),
                variant: variant,
                value: totalPrice,
                metadata: {
                  orderId: payload.order_id,
                  orderName: order.name,
                  lineItemId: lineItem.id,
                  variantId: variantId,
                  quantity: quantity,
                  unitPrice: price,
                  totalPrice: totalPrice,
                  customerEmail: order.email,
                  customerId: order.customer?.id,
                  financialStatus: order.financial_status,
                  fulfillmentStatus: order.fulfillment_status,
                  transactionId: payload.id,
                  transactionKind: payload.kind,
                  transactionStatus: payload.status,
                  source: "webhook_order_transactions_create",
                  webhookReceivedAt: new Date().toISOString()
                }
              }
            });

            console.log(`Successfully logged purchase event:`, purchaseEvent.id);
          } else {
            console.log(`No active A/B test found for product ${productId}`);
          }
        }
      }

      console.log("=== ORDER_TRANSACTIONS_CREATE WEBHOOK PROCESSING COMPLETE ===");
      return json({ status: "success" });

    } catch (orderError) {
      console.error("Error retrieving order details:", orderError);
      return json({ status: "error", message: "Failed to retrieve order details" }, { status: 500 });
    }

  } catch (error) {
    console.error("Error processing ORDER_TRANSACTIONS_CREATE webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 