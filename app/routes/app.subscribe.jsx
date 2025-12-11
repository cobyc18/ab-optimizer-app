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

    // Define plan configurations (must match shopify.server.js)
    const planConfigs = {
      [BASIC_PLAN]: {
        lineItems: [
          {
            amount: 5,
            currencyCode: "USD",
            interval: BillingInterval.Every30Days,
          },
        ],
      },
      [PRO_PLAN]: {
        lineItems: [
          {
            amount: 6,
            currencyCode: "USD",
            interval: BillingInterval.Every30Days,
          },
        ],
      },
      [ENTERPRISE_PLAN]: {
        lineItems: [
          {
            amount: 7,
            currencyCode: "USD",
            interval: BillingInterval.Every30Days,
          },
        ],
      },
    };

    const selectedPlanConfig = planConfigs[planName];
    if (!selectedPlanConfig) {
      return json({ error: `Plan configuration not found for: ${planName}` }, { status: 400 });
    }

    console.log("Plan config:", JSON.stringify(selectedPlanConfig, null, 2));

    // Request the subscription - explicitly pass lineItems to ensure they're included
    await billing.request({
      plan: planName,
      isTest: true, // Always use test mode for testing
      returnUrl: returnUrl,
      lineItems: selectedPlanConfig.lineItems, // Explicitly pass lineItems
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

