import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

/**
 * Mandatory compliance webhook: customers/data_request
 * 
 * When a customer requests their data from a store owner, Shopify sends this webhook.
 * Your app must respond with a 200 status code and provide the requested customer data
 * to the store owner within 30 days.
 * 
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customers-data_request
 */
export const action = async ({ request }) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`📋 Customer Data Request webhook received for ${shop}`);

    const {
      shop_id,
      shop_domain,
      orders_requested,
      customer,
      data_request,
    } = payload;

    // Log the data request for compliance tracking
    console.log("Customer data request details:", {
      shopId: shop_id,
      shopDomain: shop_domain,
      customerId: customer?.id,
      customerEmail: customer?.email,
      ordersRequested: orders_requested,
      dataRequestId: data_request?.id,
    });

    // TODO: Implement your data retrieval logic here
    // You should:
    // 1. Query your database for any customer data associated with this customer
    // 2. Compile the data into a format that can be provided to the store owner
    // 3. Store the request in your database for tracking (optional but recommended)
    // 4. Respond to the store owner with the customer's data (via email, admin panel, etc.)

    // Example: Store the request in your database for tracking
    // await prisma.dataRequest.create({
    //   data: {
    //     shopId: shop_id,
    //     shopDomain: shop_domain,
    //     customerId: customer?.id,
    //     customerEmail: customer?.email,
    //     ordersRequested: orders_requested,
    //     dataRequestId: data_request?.id,
    //     status: 'pending',
    //     createdAt: new Date(),
    //   },
    // });

    // IMPORTANT: You must respond with 200 OK
    // The actual data delivery to the store owner should happen asynchronously
    return json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Error processing customers/data_request webhook:", error);
    // Still return 200 to prevent Shopify from retrying
    // Log the error for your internal tracking
    return json({ status: "error", message: error.message }, { status: 200 });
  }
};

