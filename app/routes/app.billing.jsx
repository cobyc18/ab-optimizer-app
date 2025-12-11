import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Link } from "@remix-run/react";
import { authenticate, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server.js";
import { useState } from "react";

export const loader = async ({ request }) => {
  try {
    const authResult = await authenticate.admin(request);
    const { billing, admin, session } = authResult;

    // Check if billing is available
    if (!billing) {
      console.error("Billing API not available. Auth result keys:", Object.keys(authResult || {}));
      return json({
        hasActivePayment: false,
        appSubscriptions: [],
        isDevelopmentStore: true,
        currencyCode: "USD",
        error: "Billing API not configured. Please check your shopify.server.js configuration.",
      });
    }

    // Log billing object structure for debugging
    console.log("Billing object type:", typeof billing);
    console.log("Billing object keys:", Object.keys(billing || {}));
    console.log("billing.check type:", typeof billing.check);

    if (typeof billing.check !== 'function') {
      console.error("billing.check is not a function. Available methods:", Object.keys(billing || {}));
      // Return fallback data instead of error to allow page to load
      return json({
        hasActivePayment: false,
        appSubscriptions: [],
        isDevelopmentStore: true,
        currencyCode: "USD",
        error: null, // Don't show error to user, just return empty state
      });
    }

    // Check if shop is a development store
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

    const shopResponse = await admin.graphql(shopQuery);
    const shopData = await shopResponse.json();
    // Always set to true for testing - all charges are in test mode
    const isDevelopmentStore = true; // shopData.data?.shop?.plan?.partnerDevelopment || false;

    // Check current billing status
    let billingCheck;
    try {
      billingCheck = await billing.check({
        isTest: true, // Always use test mode for testing
      });
    } catch (billingError) {
      console.error("Error calling billing.check:", billingError);
      // Return fallback data if billing check fails
      return json({
        hasActivePayment: false,
        appSubscriptions: [],
        isDevelopmentStore,
        currencyCode: "USD",
        error: `Billing check failed: ${billingError.message}`,
      });
    }

    // Get shop's billing currency
    const currencyQuery = `
      query {
        shop {
          currencyCode
        }
      }
    `;

    const currencyResponse = await admin.graphql(currencyQuery);
    const currencyData = await currencyResponse.json();
    const currencyCode = currencyData.data?.shop?.currencyCode || "USD";

    return json({
      hasActivePayment: billingCheck?.hasActivePayment || false,
      appSubscriptions: billingCheck?.appSubscriptions || [],
      isDevelopmentStore,
      currencyCode,
    });
  } catch (error) {
    console.error("Error in billing loader:", error);
    console.error("Error stack:", error.stack);
    return json({
      hasActivePayment: false,
      appSubscriptions: [],
      isDevelopmentStore: true, // Always true for testing
      currencyCode: "USD",
      error: error.message || "Unknown error occurred",
    });
  }
};

export default function Billing() {
  const { hasActivePayment, appSubscriptions, isDevelopmentStore, currencyCode, error } = useLoaderData();
  const submit = useSubmit();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleSubscribe = async (planName) => {
    console.log("Subscribe button clicked for plan:", planName);
    setIsRequesting(true);
    try {
      const formData = new FormData();
      formData.append("plan", planName);
      formData.append("isTest", "true"); // Always use test mode for testing
      console.log("Submitting subscription request...");
      submit(formData, { method: "post", action: "/app/subscribe" });
    } catch (err) {
      console.error("Error requesting subscription:", err);
      setIsRequesting(false);
      alert(`Error: ${err.message || "Failed to request subscription"}`);
    }
  };

  const handleCancel = async (subscriptionId) => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll lose access to premium features.")) {
      return;
    }

    setIsRequesting(true);
    try {
      const formData = new FormData();
      formData.append("subscriptionId", subscriptionId);
      formData.append("isTest", "true"); // Always use test mode for testing
      submit(formData, { method: "post", action: "/app/cancel-subscription" });
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      setIsRequesting(false);
    }
  };

  const activeSubscription = appSubscriptions.find(
    (sub) => sub.status === "ACTIVE" || sub.status === "ACCEPTED"
  );

  const plans = [
    {
      name: BASIC_PLAN,
      price: 29,
      interval: "month",
      features: [
        "Up to 5 A/B tests",
        "Basic analytics",
        "Email support",
        "Standard widgets",
      ],
    },
    {
      name: PRO_PLAN,
      price: 79,
      interval: "month",
      features: [
        "Unlimited A/B tests",
        "Advanced analytics",
        "Priority support",
        "All widgets",
        "Custom conversion plays",
      ],
    },
    {
      name: ENTERPRISE_PLAN,
      price: 199,
      interval: "month",
      features: [
        "Everything in Pro",
        "Dedicated account manager",
        "Custom integrations",
        "SLA guarantee",
        "White-label options",
      ],
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
          Billing & Subscription
        </h1>
        <p style={{ color: "#666", fontSize: "16px" }}>
          Manage your subscription and billing information
        </p>
        {isDevelopmentStore && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            backgroundColor: "#E3F2FD",
            borderRadius: "8px",
            color: "#1976D2",
            fontSize: "14px",
          }}>
            🧪 <strong>Development Store:</strong> All charges are in test mode and won't be billed.
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: "16px",
          backgroundColor: "#FFEBEE",
          borderRadius: "8px",
          color: "#C62828",
          marginBottom: "24px",
        }}>
          Error: {error}
        </div>
      )}

      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === "development" && (
        <div style={{
          padding: "16px",
          backgroundColor: "#F5F5F5",
          borderRadius: "8px",
          marginBottom: "24px",
          fontSize: "12px",
          fontFamily: "monospace",
        }}>
          <strong>Debug Info:</strong><br />
          hasActivePayment: {String(hasActivePayment)}<br />
          isRequesting: {String(isRequesting)}<br />
          appSubscriptions: {JSON.stringify(appSubscriptions, null, 2)}<br />
          activeSubscription: {activeSubscription ? activeSubscription.name : "null"}
        </div>
      )}

      {/* Current Subscription Status */}
      <div style={{
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "32px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
          Current Subscription
        </h2>
        {activeSubscription ? (
          <div>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "18px", fontWeight: "600", marginBottom: "4px" }}>
                {activeSubscription.name}
              </div>
              <div style={{ color: "#666", fontSize: "14px" }}>
                Status: <span style={{
                  color: activeSubscription.status === "ACTIVE" ? "#4CAF50" : "#FF9800",
                  fontWeight: "600",
                }}>
                  {activeSubscription.status}
                </span>
              </div>
              {activeSubscription.currentPeriodEnd && (
                <div style={{ color: "#666", fontSize: "14px", marginTop: "4px" }}>
                  Next billing date: {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              )}
            </div>
            <button
              onClick={() => handleCancel(activeSubscription.id)}
              disabled={isRequesting}
              style={{
                padding: "10px 20px",
                backgroundColor: "#FF5252",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isRequesting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                opacity: isRequesting ? 0.6 : 1,
              }}
            >
              {isRequesting ? "Processing..." : "Cancel Subscription"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: "#666", marginBottom: "16px" }}>
              You don't have an active subscription. Choose a plan below to get started.
            </p>
          </div>
        )}
      </div>

      {/* Available Plans */}
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" }}>
          Available Plans
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px",
        }}>
          {plans.map((plan) => {
            const isCurrentPlan = activeSubscription?.name === plan.name;
            const isUpgrade = activeSubscription && 
              (plan.name === PRO_PLAN || plan.name === ENTERPRISE_PLAN) &&
              activeSubscription.name === BASIC_PLAN;

            return (
              <div
                key={plan.name}
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: isCurrentPlan ? "0 4px 12px rgba(25, 118, 210, 0.3)" : "0 2px 4px rgba(0,0,0,0.1)",
                  border: isCurrentPlan ? "2px solid #1976D2" : "1px solid #E0E0E0",
                  position: "relative",
                }}
              >
                {isCurrentPlan && (
                  <div style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    backgroundColor: "#1976D2",
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    zIndex: 0,
                    pointerEvents: "none",
                  }}>
                    Current Plan
                  </div>
                )}
                <h3 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "8px" }}>
                  {plan.name ? plan.name.replace(" Plan", "") : "Plan"}
                </h3>
                <div style={{ marginBottom: "16px" }}>
                  <span style={{ fontSize: "36px", fontWeight: "bold" }}>
                    ${plan.price}
                  </span>
                  <span style={{ color: "#666", fontSize: "16px" }}>/{plan.interval}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, marginBottom: "24px" }}>
                  {plan.features.map((feature, idx) => (
                    <li
                      key={idx}
                      style={{
                        padding: "8px 0",
                        fontSize: "14px",
                        color: "#333",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ marginRight: "8px", color: "#4CAF50" }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Button clicked, plan:", plan.name, "isRequesting:", isRequesting, "isCurrentPlan:", isCurrentPlan);
                    if (!isRequesting && !isCurrentPlan) {
                      handleSubscribe(plan.name);
                    }
                  }}
                  disabled={isRequesting || isCurrentPlan}
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor: isCurrentPlan ? "#E0E0E0" : "#1976D2",
                    color: isCurrentPlan ? "#666" : "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: (isRequesting || isCurrentPlan) ? "not-allowed" : "pointer",
                    fontSize: "16px",
                    fontWeight: "600",
                    opacity: (isRequesting || isCurrentPlan) ? 0.6 : 1,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {isCurrentPlan
                    ? "Current Plan"
                    : isRequesting
                    ? "Processing..."
                    : isUpgrade
                    ? "Upgrade"
                    : "Subscribe"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      {activeSubscription && (
        <div style={{
          marginTop: "32px",
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
            Billing History
          </h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            View your billing history in your{" "}
            <a
              href={`https://admin.shopify.com/store/${window.location.hostname.split('.')[0]}/settings/billing`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1976D2", textDecoration: "underline" }}
            >
              Shopify Billing Settings
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

