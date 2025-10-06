import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Get the current theme information
  const themeResponse = await admin.graphql(`
    query GetCurrentTheme {
      theme(id: "gid://shopify/Theme/current") {
        id
        name
        role
      }
    }
  `);
  
  const themeData = await themeResponse.json();
  const currentTheme = themeData.data?.theme;

  return json({
    theme: currentTheme,
    shop: session.shop
  });
};

export default function DynamicManipulator() {
  const { theme, shop } = useLoaderData();
  const fetcher = useFetcher();

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        marginBottom: "24px"
      }}>
        <h1 style={{
          fontSize: "28px",
          fontWeight: "700",
          color: "#202223",
          marginBottom: "8px"
        }}>
          🎨 A/B Dynamic Manipulator
        </h1>
        <p style={{
          fontSize: "16px",
          color: "#637381",
          marginBottom: "24px"
        }}>
          Dynamic product page manipulation integrated into your existing A/B Test Extension! 
          Enable real-time customization controls in your A/B Test Block for instant layout and design changes.
        </p>

        <div style={{
          background: "#f6f6f7",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px"
        }}>
          <h3 style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#202223",
            marginBottom: "12px"
          }}>
            ✅ Extension Status
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div style={{
              background: "white",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e1e5e9"
            }}>
              <div style={{ fontSize: "14px", color: "#637381", marginBottom: "4px" }}>Theme</div>
              <div style={{ fontSize: "16px", fontWeight: "500", color: "#202223" }}>
                {theme?.name || "Unknown"}
              </div>
            </div>
            <div style={{
              background: "white",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e1e5e9"
            }}>
              <div style={{ fontSize: "14px", color: "#637381", marginBottom: "4px" }}>Status</div>
              <div style={{ fontSize: "16px", fontWeight: "500", color: "#10b981" }}>
                {theme?.role === "MAIN" ? "Live" : "Draft"}
              </div>
            </div>
            <div style={{
              background: "white",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e1e5e9"
            }}>
              <div style={{ fontSize: "14px", color: "#637381", marginBottom: "4px" }}>Extension</div>
              <div style={{ fontSize: "16px", fontWeight: "500", color: "#3b82f6" }}>
                Active
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          marginBottom: "24px"
        }}>
          <div style={{
            background: "white",
            border: "1px solid #e1e5e9",
            borderRadius: "8px",
            padding: "20px"
          }}>
            <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#202223",
              marginBottom: "12px"
            }}>
              🎯 Features
            </h3>
            <ul style={{ paddingLeft: "20px", color: "#637381" }}>
              <li style={{ marginBottom: "8px" }}>Real-time layout manipulation</li>
              <li style={{ marginBottom: "8px" }}>Dynamic color scheme changes</li>
              <li style={{ marginBottom: "8px" }}>Typography controls</li>
              <li style={{ marginBottom: "8px" }}>Animation effects</li>
              <li style={{ marginBottom: "8px" }}>Spacing adjustments</li>
              <li style={{ marginBottom: "8px" }}>Live preview</li>
            </ul>
          </div>

          <div style={{
            background: "white",
            border: "1px solid #e1e5e9",
            borderRadius: "8px",
            padding: "20px"
          }}>
            <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#202223",
              marginBottom: "12px"
            }}>
              🚀 How to Use
            </h3>
            <ol style={{ paddingLeft: "20px", color: "#637381" }}>
              <li style={{ marginBottom: "8px" }}>Go to your theme editor</li>
              <li style={{ marginBottom: "8px" }}>Find your existing "A/B Test Block"</li>
              <li style={{ marginBottom: "8px" }}>Enable "Dynamic Manipulation" in block settings</li>
              <li style={{ marginBottom: "8px" }}>Save and preview your store</li>
              <li style={{ marginBottom: "8px" }}>Use the floating "🎨 A/B Editor" control panel</li>
            </ol>
          </div>
        </div>

        <div style={{
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px"
        }}>
          <h3 style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "#92400e",
            marginBottom: "8px"
          }}>
            💡 Pro Tip
          </h3>
          <p style={{
            fontSize: "14px",
            color: "#92400e",
            margin: 0
          }}>
            The dynamic manipulation feature is now integrated into your existing A/B Test Extension! 
            Simply enable it in your A/B Test Block settings to get a floating "🎨 A/B Editor" control panel 
            for real-time product page customization. Perfect for testing different layouts without editing theme code.
          </p>
        </div>

        <div style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap"
        }}>
          <a
            href={`https://${shop}/admin/themes/current/editor`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 20px",
              background: "#3b82f6",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "14px"
            }}
          >
            🎨 Open Theme Editor
          </a>
          
          <button
            onClick={() => {
              // Open a product page in a new tab for testing
              window.open(`https://${shop}/admin/products`, '_blank');
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 20px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            📦 View Products
          </button>
        </div>
      </div>

      {/* Integration Instructions */}
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
      }}>
        <h2 style={{
          fontSize: "24px",
          fontWeight: "600",
          color: "#202223",
          marginBottom: "16px"
        }}>
          🔧 Integration Instructions
        </h2>
        
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e1e5e9",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px"
        }}>
          <h3 style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "#202223",
            marginBottom: "12px"
          }}>
            Method 1: Theme Editor (Recommended)
          </h3>
          <ol style={{ paddingLeft: "20px", color: "#374151", lineHeight: "1.6" }}>
            <li style={{ marginBottom: "8px" }}>Go to <strong>Online Store → Themes</strong></li>
            <li style={{ marginBottom: "8px" }}>Click <strong>Customize</strong> on your current theme</li>
            <li style={{ marginBottom: "8px" }}>Navigate to a product page</li>
            <li style={{ marginBottom: "8px" }}>Click <strong>Add block</strong> in the product section</li>
            <li style={{ marginBottom: "8px" }}>Enable <strong>Dynamic Manipulation</strong> in A/B Test Block</li>
            <li style={{ marginBottom: "8px" }}>Configure the settings and save</li>
          </ol>
        </div>

        <div style={{
          background: "#f0f9ff",
          border: "1px solid #0ea5e9",
          borderRadius: "8px",
          padding: "16px"
        }}>
          <h3 style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "#0c4a6e",
            marginBottom: "12px"
          }}>
            Method 2: Code Integration
          </h3>
          <p style={{
            fontSize: "14px",
            color: "#0c4a6e",
            marginBottom: "12px"
          }}>
            Include this snippet in your product template:
          </p>
          <pre style={{
            background: "#1e293b",
            color: "#e2e8f0",
            padding: "16px",
            borderRadius: "6px",
            fontSize: "14px",
            overflow: "auto",
            margin: 0
          }}>
{`{% render 'dynamic-manipulator-integration', block: block %}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
