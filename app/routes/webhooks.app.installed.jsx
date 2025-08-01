import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const action = async ({ request }) => {
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  if (!topic || !shop || !session) {
    console.error("Webhook authentication failed");
    return json({ status: "error", message: "Authentication failed" }, { status: 401 });
  }

  try {
    console.log("=== APP INSTALLED WEBHOOK RECEIVED ===");
    console.log("Shop:", shop);

    // Create shop record in database if it doesn't exist
    try {
      const existingShop = await prisma.shop.findFirst({
        where: { domain: shop }
      });

      if (!existingShop) {
        const newShop = await prisma.shop.create({
          data: {
            domain: shop,
            accessToken: session.accessToken,
            scope: session.scope || "",
            isActive: true
          }
        });
        console.log("✅ Created new shop record:", newShop.id);
      } else {
        console.log("✅ Shop record already exists:", existingShop.id);
      }
    } catch (dbError) {
      console.error("Error creating shop record:", dbError);
    }

    console.log("=== APP INSTALLED WEBHOOK PROCESSING COMPLETE ===");
    return json({ status: "success" });

  } catch (error) {
    console.error("Error processing APP_INSTALLED webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 