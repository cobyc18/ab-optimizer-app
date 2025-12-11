import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const { billing } = await authenticate.admin(request);

    const formData = await request.formData();
    const subscriptionId = formData.get("subscriptionId");

    if (!subscriptionId) {
      return json({ error: "Subscription ID is required" }, { status: 400 });
    }

    // Cancel the subscription
    await billing.cancel({
      subscriptionId: subscriptionId,
      isTest: true, // Always use test mode for testing
      prorate: true, // Issue prorated credits
    });

    // Redirect back to billing page
    return redirect("/app/billing?cancelled=true");
  } catch (error) {
    console.error("Error in cancel-subscription action:", error);
    return json(
      { error: error.message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
};

