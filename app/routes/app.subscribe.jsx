import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

/**
 * With Managed Pricing, we cannot create charges via the Billing API.
 * Instead, we redirect merchants to Shopify's plan selection page where
 * they can select and subscribe to a plan.
 * 
 * Reference: https://shopify.dev/docs/apps/launch/billing/managed-pricing
 */
export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);

    // App handle from shopify.app.toml
    const appHandle = "ab-optimizer-app";

    // Extract store handle from shop domain
    // e.g., "ogcc18" from "ogcc18.myshopify.com"
    const shop = session.shop;
    const storeHandle = shop.replace('.myshopify.com', '');

    // Build the plan selection page URL
    // Pattern: https://admin.shopify.com/store/:store_handle/charges/:app_handle/pricing_plans
    const planSelectionUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

    console.log("Redirecting to Managed Pricing plan selection page:", planSelectionUrl);
    console.log("Store handle:", storeHandle, "App handle:", appHandle);

    // Redirect to Shopify's plan selection page
    return redirect(planSelectionUrl);
  } catch (error) {
    console.error("Error in subscribe action:", error);
    console.error("Error stack:", error.stack);
    // Even on error, redirect to plan selection page as fallback
    // The merchant can still select a plan there
    const { session } = await authenticate.admin(request);
    const storeHandle = session.shop.replace('.myshopify.com', '');
    return redirect(`https://admin.shopify.com/store/${storeHandle}/charges/ab-optimizer-app/pricing_plans`);
  }
};

