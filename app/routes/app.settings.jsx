import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return json({
    shop: session.shop,
  });
};

export default function Settings() {
  const { shop } = useLoaderData();

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
