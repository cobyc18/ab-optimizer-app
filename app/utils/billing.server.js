import { authenticate } from "../shopify.server.js";

/**
 * Check if the current shop is a development store
 * @param {Request} request - The incoming request
 * @returns {Promise<boolean>} - True if the shop is a development store
 */
export async function isDevelopmentStore(request) {
  try {
    const { admin } = await authenticate.admin(request);

    const shopQuery = `
      query {
        shop {
          plan {
            partnerDevelopment
            displayName
          }
        }
      }
    `;

    const response = await admin.graphql(shopQuery);
    const data = await response.json();

    return data.data?.shop?.plan?.partnerDevelopment || false;
  } catch (error) {
    console.error("Error checking if development store:", error);
    // Default to false if we can't determine
    return false;
  }
}

/**
 * Check if the shop has an active subscription
 * @param {Request} request - The incoming request
 * @param {string[]} plans - Optional array of plan names to check for
 * @returns {Promise<{hasActivePayment: boolean, appSubscriptions: any[]}>}
 */
export async function checkBillingStatus(request, plans = null) {
  try {
    const { billing } = await authenticate.admin(request);
    const isDevStore = await isDevelopmentStore(request);

    const billingCheck = await billing.check({
      plans: plans || undefined,
      isTest: isDevStore,
    });

    return {
      hasActivePayment: billingCheck.hasActivePayment,
      appSubscriptions: billingCheck.appSubscriptions || [],
      isDevelopmentStore: isDevStore,
    };
  } catch (error) {
    console.error("Error checking billing status:", error);
    return {
      hasActivePayment: false,
      appSubscriptions: [],
      isDevelopmentStore: false,
    };
  }
}

/**
 * Require billing for a route - redirects to billing if no active payment
 * @param {Request} request - The incoming request
 * @param {string[]} plans - Array of plan names that are acceptable
 * @param {string} redirectTo - Where to redirect if billing is required
 * @returns {Promise<{hasActivePayment: boolean, appSubscriptions: any[]}>}
 */
export async function requireBilling(request, plans, redirectTo = "/app/billing") {
  try {
    const { billing } = await authenticate.admin(request);
    const isDevStore = await isDevelopmentStore(request);

    const billingCheck = await billing.require({
      plans: plans,
      isTest: isDevStore,
      onFailure: async () => {
        // Redirect to billing page
        const url = new URL(request.url);
        const returnUrl = `${url.origin}${url.pathname}${url.search}`;
        return billing.request({
          plan: plans[0], // Use first plan as default
          isTest: isDevStore,
          returnUrl: returnUrl,
        });
      },
    });

    return billingCheck;
  } catch (error) {
    console.error("Error requiring billing:", error);
    throw error;
  }
}

