import { json, redirect } from "@remix-run/node";
import { authenticate, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const { billing, session } = await authenticate.admin(request);

    const formData = await request.formData();
    const planName = formData.get("plan");

    if (!planName) {
      return json({ error: "Plan name is required" }, { status: 400 });
    }

    // Validate plan name
    const validPlans = [BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN];
    if (!validPlans.includes(planName)) {
      return json({ error: "Invalid plan name" }, { status: 400 });
    }

    // Get the return URL
    const url = new URL(request.url);
    const returnUrl = `${url.origin}/app/billing?subscribed=true`;

    // Request the subscription
    await billing.request({
      plan: planName,
      isTest: true, // Always use test mode for testing
      returnUrl: returnUrl,
    });

    // This will redirect to Shopify's confirmation page
    // The redirect happens automatically via billing.request()
  } catch (error) {
    console.error("Error in subscribe action:", error);
    return json(
      { error: error.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
};

