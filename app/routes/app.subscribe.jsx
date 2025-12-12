import { json, redirect } from "@remix-run/node";
import { authenticate, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);

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

    // BYPASS billing.request() and call GraphQL API directly
    // This ensures we have full control over the structure for non-embedded apps
    const mutation = `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
        appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
          }
          confirmationUrl
        }
      }
    `;

    const variables = {
      name: planName,
      returnUrl: returnUrl,
      test: true, // Always use test mode for testing
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: planAmount,
                currencyCode: "USD",
              },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    };

    console.log("Calling GraphQL mutation directly with variables:", JSON.stringify(variables, null, 2));

    const response = await admin.graphql(mutation, {
      variables: variables,
    });

    const data = await response.json();

    console.log("GraphQL response:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return json(
        { error: data.errors.map(e => e.message).join(", ") || "Failed to create subscription" },
        { status: 500 }
      );
    }

    if (data.data?.appSubscriptionCreate?.userErrors?.length > 0) {
      const userErrors = data.data.appSubscriptionCreate.userErrors;
      console.error("User errors:", userErrors);
      return json(
        { error: userErrors.map(e => e.message).join(", ") || "Failed to create subscription" },
        { status: 400 }
      );
    }

    const confirmationUrl = data.data?.appSubscriptionCreate?.confirmationUrl;

    if (!confirmationUrl) {
      console.error("No confirmation URL returned");
      return json({ error: "No confirmation URL returned from Shopify" }, { status: 500 });
    }

    console.log("Redirecting to confirmation URL:", confirmationUrl);

    // Redirect to Shopify's confirmation page
    return redirect(confirmationUrl);
  } catch (error) {
    console.error("Error in subscribe action:", error);
    console.error("Error stack:", error.stack);
    return json(
      { error: error.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
};

