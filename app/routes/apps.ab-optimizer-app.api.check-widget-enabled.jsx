/**
 * App proxy route handler for checking widget enabled status.
 * This route handles requests from the storefront via app proxy:
 * https://{shop}.myshopify.com/apps/ab-optimizer-app/api/check-widget-enabled
 * 
 * This forwards to the main API endpoint.
 */
export { loader, options } from "./api.check-widget-enabled.jsx";
