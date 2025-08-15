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
        const orderResponse = await admin.graphql(`
          query getOrder($id: ID!) {
            order(id: $id) {
              id
              name
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              financialStatus
              fulfillmentStatus
              email
              customer {
                id
                email
              }
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    product {
                      id
                    }
                    variant {
                      id
                    }
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
              note
              tags
              noteAttributes {
                name
                value
              }
            }
          }
        `, {
          variables: {
            id: `gid://shopify/Order/${payload.order_id}`
          }
        });

        const orderData = await orderResponse.json();
        
        if (orderData.data?.order) {
          const order = orderData.data.order;
          
          // Transform the order data to match our expected format
          const transformedOrder = {
            id: order.id.split('/').pop(),
            name: order.name,
            total_price: order.totalPriceSet?.shopMoney?.amount || "0",
            financial_status: order.financialStatus?.toLowerCase(),
            fulfillment_status: order.fulfillmentStatus?.toLowerCase(),
            email: order.email,
            customer: order.customer ? {
              id: order.customer.id.split('/').pop(),
              email: order.customer.email
            } : null,
            line_items: order.lineItems?.edges?.map(edge => ({
              id: edge.node.id.split('/').pop(),
              product_id: edge.node.product?.id?.split('/').pop(),
              variant_id: edge.node.variant?.id?.split('/').pop(),
              quantity: edge.node.quantity,
              price: edge.node.originalUnitPriceSet?.shopMoney?.amount || "0"
            })) || [],
            note: order.note,
            tags: order.tags,
            note_attributes: order.noteAttributes?.map(attr => ({
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