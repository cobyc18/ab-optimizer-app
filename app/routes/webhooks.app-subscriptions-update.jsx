import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

/**
 * Webhook handler for app_subscriptions/update
 * This webhook is triggered when a subscription status changes
 * (e.g., activated, cancelled, expired, etc.)
 */
export const action = async ({ request }) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`📦 App Subscription Update webhook received for ${shop}`);

    // Parse the webhook payload
    const subscriptionData = payload;

    // Log the subscription update
    console.log("Subscription update details:", {
      id: subscriptionData.id,
      name: subscriptionData.name,
      status: subscriptionData.status,
      test: subscriptionData.test,
      createdAt: subscriptionData.created_at,
      updatedAt: subscriptionData.updated_at,
      currentPeriodEnd: subscriptionData.current_period_end,
    });

    // Update shop settings with subscription status
    // You can store this in your database for quick access
    try {
      await prisma.shop.upsert({
        where: { shop },
        update: {
          settings: {
            ...((await prisma.shop.findUnique({ where: { shop } }))?.settings || {}),
            subscription: {
              id: subscriptionData.id,
              name: subscriptionData.name,
              status: subscriptionData.status,
              test: subscriptionData.test,
              updatedAt: new Date(),
            },
          },
        },
        create: {
          shop,
          accessToken: "", // Will be set during OAuth
          scope: "",
          settings: {
            subscription: {
              id: subscriptionData.id,
              name: subscriptionData.name,
              status: subscriptionData.status,
              test: subscriptionData.test,
              updatedAt: new Date(),
            },
          },
        },
      });

      console.log(`✅ Subscription status updated for ${shop}`);
    } catch (dbError) {
      console.error("Error updating subscription in database:", dbError);
      // Don't fail the webhook if DB update fails
    }

    return json({ success: true });
  } catch (error) {
    console.error("❌ Error processing app subscription update webhook:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

