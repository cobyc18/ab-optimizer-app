import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  if (!topic || !shop || !session) {
    console.error("Webhook authentication failed");
    return json({ status: "error", message: "Authentication failed" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    console.log("=== THEMES_PUBLISH WEBHOOK RECEIVED ===");
    console.log("Shop:", shop);
    console.log("Topic:", topic);
    console.log("Theme ID:", payload.id);

    // This webhook is just for keeping the app active
    // Real purchase tracking will be done via client-side methods

    return json({ status: "success" });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 