import { json, redirect } from "@remix-run/node";
import { authenticate, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server.js";
import { BillingInterval } from "@shopify/shopify-app-remix/server";

export const action = async ({ request }) => {
  try {
    const { billing, session } = await authenticate.admin(request);

    if (!billing || typeof billing.request !== 'function') {
      console.error("Billing API not available");
      return json({ error: "Billing API not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const planName = formData.get("plan");

    console.log("Subscribe action received planName:", planName);
    console.log("Valid plans:", [BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN]);

    if (!planName) {
      console.error("No plan name provided");
      return json({ error: "Plan name is required" }, { status: 400 });
    }

    // Validate plan name
    const validPlans = [BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN];
    if (!validPlans.includes(planName)) {
      console.error("Invalid plan name:", planName, "Valid plans:", validPlans);
      return json({ 
        error: `Invalid plan name: ${planName}. Valid plans are: ${validPlans.join(", ")}` 
      }, { status: 400 });
    }

    // Get the return URL
    const url = new URL(request.url);
    const returnUrl = `${url.origin}/app/billing?subscribed=true`;

    console.log("Requesting subscription for plan:", planName, "with returnUrl:", returnUrl);

    // Determine the plan amount based on plan name
    let planAmount = 0;
    if (planName === BASIC_PLAN) {
      planAmount = 5;
    } else if (planName === PRO_PLAN) {
      planAmount = 6;
    } else if (planName === ENTERPRISE_PLAN) {
      planAmount = 7;
    }

    // WORKAROUND: The library is not reading the billing config from shopify.server.js
    // for non-embedded apps. We must pass lineItems in the simplified format (matching shopify.server.js),
    // and the library will transform it to the GraphQL structure. However, since the config isn't being
    // read, we need to include ALL fields explicitly (amount, currencyCode, interval).
    const lineItems = [
      {
        amount: planAmount,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
    ];

    console.log("Passing lineItems explicitly (simplified format):", JSON.stringify(lineItems, null, 2));

    // Request the subscription with explicitly constructed lineItems
    await billing.request({
      plan: planName,
      isTest: true, // Always use test mode for testing
      returnUrl: returnUrl,
      lineItems: lineItems, // Pass in simplified format - library will transform to GraphQL
    });

    // This will redirect to Shopify's confirmation page
    // The redirect happens automatically via billing.request()
    // If we reach here, something went wrong
    return json({ error: "Billing request did not redirect" }, { status: 500 });
  } catch (error) {
    console.error("Error in subscribe action:", error);
    console.error("Error stack:", error.stack);
    return json(
      { error: error.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
};

