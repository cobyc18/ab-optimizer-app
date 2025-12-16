import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  
  // Fetch merchant's subscription plan details
  let planDetails = null;
  try {
    const response = await admin.graphql(
      `#graphql
      query GetMerchantPlan {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            createdAt
            currentPeriodEnd
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }`
    );
    
    const data = await response.json();
    const activeSubscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];
    
    if (activeSubscriptions.length > 0) {
      const activePlan = activeSubscriptions.find(sub => sub.status === 'ACTIVE') || activeSubscriptions[0];
      planDetails = {
        planName: activePlan.name,
        status: activePlan.status,
        createdAt: activePlan.createdAt,
        currentPeriodEnd: activePlan.currentPeriodEnd,
        lineItems: activePlan.lineItems
      };
    }
  } catch (error) {
    console.error('Error fetching plan details:', error);
    // Don't throw - just log the error and continue
  }
  
  return json({
    shop: session.shop,
    planDetails,
  });
};

export default function Settings() {
  const { shop, planDetails } = useLoaderData();

  // Extract store handle from shop domain (e.g., "ogcc18" from "ogcc18.myshopify.com")
  const storeHandle = shop ? shop.replace('.myshopify.com', '') : '';
  const appHandle = "ab-optimizer-app";
  
  // Shopify charges page URL for managing subscriptions
  const manageSubscriptionUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

  const settingsSections = [
    {
      title: "Account Settings",
      hidden: true, // Hidden for now
      items: [
        { name: "Profile Information", description: "Update your account details", href: "#" },
        { name: "Email Preferences", description: "Manage notification settings", href: "#" },
        { name: "Password & Security", description: "Change password and security settings", href: "#" }
      ]
    },
    {
      title: "App Configuration",
      hidden: true, // Hidden for now
      items: [
        { name: "General Settings", description: "Configure app behavior and defaults", href: "#" },
        { name: "Integration Settings", description: "Manage third-party integrations", href: "#" },
        { name: "API Configuration", description: "View and manage API keys", href: "#" }
      ]
    },
    {
      title: "Billing & Subscription",
      hidden: false,
      items: [
        { name: "Manage Subscription", description: "View and manage your subscription", href: manageSubscriptionUrl, external: true, hidden: false },
        { name: "Current Plan", description: "View your current plan details", href: "/app/billing", hidden: true },
        { name: "Billing History", description: "Download invoices and receipts", href: "/app/billing", hidden: true }
      ]
    },
    {
      title: "Privacy & Security",
      hidden: false,
      items: [
        { name: "Data Privacy", description: "Manage data collection and usage", href: "https://trylab.io/privacy-policy", external: true, hidden: false },
        { name: "Security Settings", description: "Configure security preferences", href: "#", hidden: true },
        { name: "Access Logs", description: "View account activity and access", href: "#", hidden: true }
      ]
    }
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>
          Settings
        </h1>
        <p style={{ color: "#666", fontSize: "16px" }}>
          Manage your app preferences, account settings, and configuration options.
        </p>
      </div>

      {/* Shop Info - Hidden for now */}
      <div style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        display: "none" // Hidden for now
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#1976D2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            fontSize: "18px"
          }}>
            {shop ? shop.charAt(0).toUpperCase() : "S"}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Shop Domain</p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#333" }}>{shop || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Plan Details Placeholder */}
      <div style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        border: "2px solid #1976D2"
      }}>
        <h2 style={{
          fontSize: "20px",
          fontWeight: "600",
          marginBottom: "16px",
          color: "#333"
        }}>
          Current Subscription Plan (Test)
        </h2>
        {planDetails ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "14px", color: "#666", marginBottom: "4px" }}>Plan Name:</p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1976D2" }}>
                {planDetails.planName || "N/A"}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "14px", color: "#666", marginBottom: "4px" }}>Status:</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "500", color: "#333" }}>
                {planDetails.status || "N/A"}
              </p>
            </div>
            {planDetails.currentPeriodEnd && (
              <div>
                <p style={{ margin: 0, fontSize: "14px", color: "#666", marginBottom: "4px" }}>Current Period End:</p>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "500", color: "#333" }}>
                  {new Date(planDetails.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            )}
            {planDetails.lineItems && planDetails.lineItems.length > 0 && (
              <div>
                <p style={{ margin: 0, fontSize: "14px", color: "#666", marginBottom: "8px" }}>Pricing Details:</p>
                <div style={{ paddingLeft: "16px" }}>
                  {planDetails.lineItems.map((item, index) => {
                    const pricing = item.plan?.pricingDetails;
                    if (pricing?.__typename === 'AppRecurringPricing') {
                      return (
                        <div key={index} style={{ marginBottom: "8px" }}>
                          <p style={{ margin: 0, fontSize: "14px", color: "#333" }}>
                            ${pricing.price?.amount} {pricing.price?.currencyCode} / {pricing.interval?.toLowerCase().replace('_', ' ')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
            <div style={{
              marginTop: "8px",
              padding: "12px",
              backgroundColor: "#f0f9ff",
              borderRadius: "6px",
              border: "1px solid #bae6fd"
            }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#666", fontStyle: "italic" }}>
                This is a test placeholder showing plan details fetched via GraphQL
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ margin: 0, fontSize: "16px", color: "#666" }}>
              No active subscription found
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#999", fontStyle: "italic" }}>
              This could mean the merchant hasn't subscribed yet, or there was an error fetching the data.
            </p>
          </div>
        )}
      </div>

      {/* Settings Sections */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "24px"
      }}>
        {settingsSections.map((section) => (
          <div
            key={section.title}
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "24px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              display: section.hidden ? "none" : "block" // Hide entire section if hidden flag is true
            }}
          >
            <h2 style={{
              fontSize: "20px",
              fontWeight: "600",
              marginBottom: "20px",
              color: "#333"
            }}>
              {section.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {section.items.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  style={{
                    display: item.hidden ? "none" : "block", // Hide individual items if hidden flag is true
                    padding: "16px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "6px",
                    textDecoration: "none",
                    border: "1px solid #e5e7eb",
                    transition: "all 0.2s",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                    e.currentTarget.style.borderColor = "#1976D2";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f9fafb";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                >
                  <h3 style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "500",
                    color: "#333",
                    marginBottom: "4px"
                  }}>
                    {item.name}
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#666"
                  }}>
                    {item.description}
                  </p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
