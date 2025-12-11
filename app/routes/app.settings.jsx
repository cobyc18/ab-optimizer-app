import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return json({
    shop: session.shop,
  });
};

export default function Settings() {
  const { shop } = useLoaderData();

  const settingsSections = [
    {
      title: "Account Settings",
      items: [
        { name: "Profile Information", description: "Update your account details", href: "#" },
        { name: "Email Preferences", description: "Manage notification settings", href: "#" },
        { name: "Password & Security", description: "Change password and security settings", href: "#" }
      ]
    },
    {
      title: "App Configuration",
      items: [
        { name: "General Settings", description: "Configure app behavior and defaults", href: "#" },
        { name: "Integration Settings", description: "Manage third-party integrations", href: "#" },
        { name: "API Configuration", description: "View and manage API keys", href: "#" }
      ]
    },
    {
      title: "Billing & Subscription",
      items: [
        { name: "Manage Subscription", description: "View and manage your subscription", href: "/app/billing" },
        { name: "Current Plan", description: "View your current plan details", href: "/app/billing" },
        { name: "Billing History", description: "Download invoices and receipts", href: "/app/billing" }
      ]
    },
    {
      title: "Privacy & Security",
      items: [
        { name: "Data Privacy", description: "Manage data collection and usage", href: "#" },
        { name: "Security Settings", description: "Configure security preferences", href: "#" },
        { name: "Access Logs", description: "View account activity and access", href: "#" }
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

      {/* Shop Info */}
      <div style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
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
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
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
                <Link
                  key={item.name}
                  to={item.href}
                  style={{
                    display: "block",
                    padding: "16px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "6px",
                    textDecoration: "none",
                    border: "1px solid #e5e7eb",
                    transition: "all 0.2s"
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
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
