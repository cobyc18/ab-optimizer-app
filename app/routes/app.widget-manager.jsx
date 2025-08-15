import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useEffect } from "react";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    // Fetch all widget configurations for this shop
    const widgetConfigs = await prisma.widgetConfig.findMany({
      where: { shop: admin.shop },
      orderBy: { createdAt: 'desc' }
    });

    return json({ widgetConfigs });
  } catch (error) {
    console.error('Error loading widget configs:', error);
    return json({ error: 'Failed to load widget configurations' });
  }
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    switch (actionType) {
      case "create_widget":
        const widgetType = formData.get("widgetType");
        const name = formData.get("name");
        const config = JSON.parse(formData.get("config"));

        const newWidget = await prisma.widgetConfig.create({
          data: {
            shop: admin.shop,
            widgetType,
            name,
            config
          }
        });

        return json({ 
          success: true, 
          message: "Widget created successfully",
          widgetId: newWidget.id 
        });

      case "update_widget":
        const widgetId = formData.get("widgetId");
        const updatedConfig = JSON.parse(formData.get("config"));

        await prisma.widgetConfig.update({
          where: { id: widgetId },
          data: { config: updatedConfig }
        });

        return json({ 
          success: true, 
          message: "Widget updated successfully" 
        });

      case "delete_widget":
        const deleteWidgetId = formData.get("widgetId");

        await prisma.widgetConfig.delete({
          where: { id: deleteWidgetId }
        });

        return json({ 
          success: true, 
          message: "Widget deleted successfully" 
        });

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in widget action:', error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

export default function WidgetManager() {
  const { widgetConfigs } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const fetcher = useFetcher();

  const [selectedWidgetType, setSelectedWidgetType] = useState("countdown_timer");
  const [widgetName, setWidgetName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);

  // Widget type configurations
  const widgetTypes = {
    countdown_timer: {
      name: "Countdown Timer",
      settings: {
        header_text: { type: "text", label: "Header Text", default: "Limited Time Offer!" },
        end_time: { type: "datetime-local", label: "End Date & Time", default: "" },
        message_text: { type: "text", label: "Message Text", default: "Don't miss out on this amazing offer!" },
        show_message: { type: "checkbox", label: "Show Message", default: true },
        background_color: { type: "color", label: "Background Color", default: "#000000" },
        text_color: { type: "color", label: "Text Color", default: "#ffffff" },
        timer_color: { type: "color", label: "Timer Text Color", default: "#ffffff" },
        timer_background: { type: "color", label: "Timer Background Color", default: "#32cd32" },
        border_color: { type: "color", label: "Border Color", default: "#32cd32" },
        border_width: { type: "range", label: "Border Width", min: 0, max: 5, default: 2 },
        border_radius: { type: "range", label: "Border Radius", min: 0, max: 20, default: 8 },
        padding: { type: "range", label: "Padding", min: 8, max: 32, default: 20 },
        margin: { type: "range", label: "Margin", min: 0, max: 20, default: 8 },
        font_size: { type: "range", label: "Font Size", min: 12, max: 24, default: 16 },
        timer_font_size: { type: "range", label: "Timer Font Size", min: 16, max: 32, default: 20 },
        label_font_size: { type: "range", label: "Label Font Size", min: 10, max: 18, default: 12 }
      }
    },
    product_badge: {
      name: "Product Badge",
      settings: {
        badge_type: { type: "select", label: "Badge Type", options: ["custom", "sale", "new", "limited"], default: "custom" },
        custom_text: { type: "text", label: "Custom Badge Text", default: "SPECIAL" },
        background_color: { type: "color", label: "Background Color", default: "#32cd32" },
        text_color: { type: "color", label: "Text Color", default: "#ffffff" },
        border_color: { type: "color", label: "Border Color", default: "#228b22" },
        border_width: { type: "range", label: "Border Width", min: 0, max: 5, default: 1 },
        border_radius: { type: "range", label: "Border Radius", min: 0, max: 20, default: 4 },
        padding: { type: "range", label: "Padding", min: 4, max: 20, default: 8 },
        margin: { type: "range", label: "Margin", min: 0, max: 20, default: 4 },
        font_size: { type: "range", label: "Font Size", min: 10, max: 24, default: 12 }
      }
    },
    social_proof: {
      name: "Social Proof",
      settings: {
        proof_type: { type: "select", label: "Social Proof Type", options: ["recent_purchase", "review_count", "testimonial", "trust_badge", "stock_warning", "custom"], default: "recent_purchase" },
        custom_text: { type: "text", label: "Custom Text", default: "Custom social proof message" },
        background_color: { type: "color", label: "Background Color", default: "#f8f9fa" },
        text_color: { type: "color", label: "Text Color", default: "#000000" },
        border_color: { type: "color", label: "Border Color", default: "#e5e7eb" },
        border_width: { type: "range", label: "Border Width", min: 0, max: 5, default: 1 },
        border_radius: { type: "range", label: "Border Radius", min: 0, max: 20, default: 8 },
        padding: { type: "range", label: "Padding", min: 8, max: 32, default: 16 },
        margin: { type: "range", label: "Margin", min: 0, max: 20, default: 8 },
        font_size: { type: "range", label: "Font Size", min: 12, max: 24, default: 14 },
        icon_size: { type: "range", label: "Icon Size", min: 12, max: 32, default: 16 },
        text_align: { type: "select", label: "Text Alignment", options: ["left", "center", "right"], default: "left" }
      }
    },
    progress_bar: {
      name: "Progress Bar",
      settings: {
        progress_type: { type: "select", label: "Progress Type", options: ["stock_level", "goal_progress", "custom"], default: "stock_level" },
        custom_label: { type: "text", label: "Custom Label", default: "Progress" },
        current_value: { type: "number", label: "Current Value", default: 50 },
        max_value: { type: "number", label: "Max Value", default: 100 },
        goal_value: { type: "number", label: "Goal Value", default: 100 },
        custom_percentage: { type: "range", label: "Custom Percentage", min: 0, max: 100, default: 75 },
        custom_message: { type: "text", label: "Custom Message", default: "Progress update" },
        show_message: { type: "checkbox", label: "Show Progress Message", default: true },
        background_color: { type: "color", label: "Background Color", default: "#ffffff" },
        text_color: { type: "color", label: "Text Color", default: "#000000" },
        bar_background: { type: "color", label: "Bar Background Color", default: "#e5e7eb" },
        bar_fill_color: { type: "color", label: "Bar Fill Color", default: "#32cd32" },
        border_color: { type: "color", label: "Border Color", default: "#e5e7eb" },
        border_width: { type: "range", label: "Border Width", min: 0, max: 5, default: 1 },
        border_radius: { type: "range", label: "Border Radius", min: 0, max: 20, default: 8 },
        padding: { type: "range", label: "Padding", min: 8, max: 32, default: 16 },
        margin: { type: "range", label: "Margin", min: 0, max: 20, default: 8 },
        font_size: { type: "range", label: "Font Size", min: 12, max: 24, default: 14 },
        bar_height: { type: "range", label: "Bar Height", min: 8, max: 32, default: 12 }
      }
    },
    star_rating: {
      name: "Star Rating",
      settings: {
        rating: { type: "range", label: "Rating", min: 1, max: 5, default: 5 },
        colour: { type: "color", label: "Star Color", default: "#ffd700" },
        font_size: { type: "range", label: "Font Size", min: 12, max: 32, default: 16 },
        show_text: { type: "checkbox", label: "Show Rating Text", default: true },
        text_color: { type: "color", label: "Text Color", default: "#000000" }
      }
    }
  };

  const [formData, setFormData] = useState({});

  useEffect(() => {
    // Initialize form data with defaults for selected widget type
    const defaults = {};
    Object.keys(widgetTypes[selectedWidgetType].settings).forEach(key => {
      defaults[key] = widgetTypes[selectedWidgetType].settings[key].default;
    });
    setFormData(defaults);
  }, [selectedWidgetType]);

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateWidget = () => {
    if (!widgetName.trim()) {
      alert("Please enter a widget name");
      return;
    }

    const formDataObj = new FormData();
    formDataObj.append("actionType", "create_widget");
    formDataObj.append("widgetType", selectedWidgetType);
    formDataObj.append("name", widgetName);
    formDataObj.append("config", JSON.stringify(formData));

    submit(formDataObj, { method: "post" });
  };

  const handleEditWidget = (widget) => {
    setEditingWidget(widget);
    setSelectedWidgetType(widget.widgetType);
    setWidgetName(widget.name);
    setFormData(widget.config);
    setShowCreateForm(true);
  };

  const handleUpdateWidget = () => {
    const formDataObj = new FormData();
    formDataObj.append("actionType", "update_widget");
    formDataObj.append("widgetId", editingWidget.id);
    formDataObj.append("config", JSON.stringify(formData));

    submit(formDataObj, { method: "post" });
  };

  const handleDeleteWidget = (widgetId) => {
    if (confirm("Are you sure you want to delete this widget?")) {
      const formDataObj = new FormData();
      formDataObj.append("actionType", "delete_widget");
      formDataObj.append("widgetId", widgetId);

      submit(formDataObj, { method: "post" });
    }
  };

  const renderFormField = (key, setting) => {
    const { type, label, options, min, max, default: defaultValue } = setting;
    const value = formData[key] ?? defaultValue;

    switch (type) {
      case "text":
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
              {label}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />
          </div>
        );

      case "number":
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
              {label}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleInputChange(key, parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />
          </div>
        );

      case "datetime-local":
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
              {label}
            </label>
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />
          </div>
        );

      case "select":
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
              {label}
            </label>
            <select
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            >
              {options.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        );

      case "color":
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
              {label}
            </label>
            <input
              type="color"
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
              style={{
                width: "100%",
                height: "40px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            />
          </div>
        );

      case "range":
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
              {label}: {value}
            </label>
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) => handleInputChange(key, parseInt(e.target.value))}
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "#d1d5db",
                outline: "none"
              }}
            />
          </div>
        );

      case "checkbox":
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleInputChange(key, e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              <span style={{ fontWeight: "500" }}>{label}</span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ 
        background: "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)",
        color: "#ffffff",
        padding: "24px",
        borderRadius: "12px",
        marginBottom: "24px"
      }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "bold" }}>
          🎨 Widget Manager
        </h1>
        <p style={{ margin: "0", opacity: "0.8", fontSize: "16px" }}>
          Create and manage unlimited widget configurations with unlimited settings
        </p>
      </div>

      {/* Success/Error Messages */}
      {actionData && (
        <div style={{
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "24px",
          background: actionData.success
            ? "linear-gradient(135deg, #32cd32 0%, #228b22 100%)"
            : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
          color: "white",
          fontSize: "14px",
          textAlign: "center"
        }}>
          {actionData.success ? "✅ " : "❌ "}
          {actionData.message || actionData.error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Widget List */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ margin: "0", fontSize: "20px", fontWeight: "600" }}>Your Widgets</h2>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingWidget(null);
                setWidgetName("");
                setSelectedWidgetType("countdown_timer");
              }}
              style={{
                background: "linear-gradient(135deg, #32cd32 0%, #228b22 100%)",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              ➕ Create Widget
            </button>
          </div>

          {widgetConfigs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎨</div>
              <p>No widgets created yet</p>
              <p style={{ fontSize: "14px", opacity: "0.7" }}>Create your first widget to get started</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {widgetConfigs.map(widget => (
                <div key={widget.id} style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "16px",
                  background: "#f9fafb"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600" }}>
                        {widget.name}
                      </h3>
                      <p style={{ margin: "0", fontSize: "14px", color: "#6b7280" }}>
                        {widgetTypes[widget.widgetType]?.name || widget.widgetType}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#9ca3af" }}>
                        ID: {widget.id}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleEditWidget(widget)}
                        style={{
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteWidget(widget.id)}
                        style={{
                          background: "#dc2626",
                          color: "white",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Widget Form */}
        {showCreateForm && (
          <div style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            maxHeight: "600px",
            overflowY: "auto"
          }}>
            <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600" }}>
              {editingWidget ? "Edit Widget" : "Create New Widget"}
            </h2>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
                Widget Name *
              </label>
              <input
                type="text"
                value={widgetName}
                onChange={(e) => setWidgetName(e.target.value)}
                placeholder="Enter widget name"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
                Widget Type
              </label>
              <select
                value={selectedWidgetType}
                onChange={(e) => setSelectedWidgetType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              >
                {Object.keys(widgetTypes).map(type => (
                  <option key={type} value={type}>
                    {widgetTypes[type].name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>
                Widget Settings
              </h3>
              {Object.keys(widgetTypes[selectedWidgetType].settings).map(key => 
                renderFormField(key, widgetTypes[selectedWidgetType].settings[key])
              )}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={editingWidget ? handleUpdateWidget : handleCreateWidget}
                style={{
                  background: "linear-gradient(135deg, #32cd32 0%, #228b22 100%)",
                  color: "white",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  flex: "1"
                }}
              >
                {editingWidget ? "💾 Update Widget" : "🚀 Create Widget"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingWidget(null);
                }}
                style={{
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 