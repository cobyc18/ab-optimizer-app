import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    // Get current theme
    const { themes } = await admin.graphql(`
      query getThemes {
        themes(first: 10) {
          nodes {
            id
            name
            role
            previewable
          }
        }
      }
    `);

    const themesData = await themes.json();
    const mainTheme = themesData.data.themes.nodes.find(theme => theme.role === 'MAIN');

    // Get existing injected sections
    const injectedSections = await prisma.injectedSection.findMany({
      where: { shop: admin.shop },
      orderBy: { createdAt: 'desc' }
    });

    return json({ 
      theme: mainTheme,
      injectedSections 
    });
  } catch (error) {
    console.error('Error loading theme data:', error);
    return json({ error: 'Failed to load theme data' });
  }
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    switch (actionType) {
      case "inject_section":
        const sectionType = formData.get("sectionType");
        const sectionName = formData.get("sectionName");
        const sectionSettings = JSON.parse(formData.get("sectionSettings"));

        // Create the section liquid file content
        const sectionContent = generateSectionLiquid(sectionType, sectionSettings);
        
        // Get theme files
        const { theme } = await admin.graphql(`
          query getThemeFiles($id: ID!) {
            theme(id: $id) {
              id
              files(first: 100) {
                nodes {
                  key
                  name
                }
              }
            }
          }
        `, {
          variables: { id: `gid://shopify/Theme/${admin.shop.split('.')[0]}` }
        });

        const themeData = await theme.json();
        const themeId = themeData.data.theme.id;

        // Create the section file
        const sectionKey = `sections/${sectionName.toLowerCase().replace(/\s+/g, '-')}.liquid`;
        
        const { themeFileCreate } = await admin.graphql(`
          mutation createSectionFile($input: FileCreateInput!) {
            themeFileCreate(input: $input) {
              file {
                key
                name
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            input: {
              key: sectionKey,
              value: sectionContent,
              themeId: themeId
            }
          }
        });

        const createResult = await themeFileCreate.json();
        
        if (createResult.data.themeFileCreate.userErrors.length > 0) {
          throw new Error(createResult.data.themeFileCreate.userErrors[0].message);
        }

        // Save to database
        const injectedSection = await prisma.injectedSection.create({
          data: {
            shop: admin.shop,
            sectionType,
            sectionName,
            sectionKey,
            sectionSettings,
            isActive: true
          }
        });

        return json({ 
          success: true, 
          message: "Section injected successfully! You can now add it to your product pages in the theme editor.",
          sectionId: injectedSection.id 
        });

      case "delete_section":
        const sectionId = formData.get("sectionId");
        const sectionToDelete = await prisma.injectedSection.findUnique({
          where: { id: sectionId }
        });

        if (sectionToDelete) {
          // Delete from theme
          const { themeFileDelete } = await admin.graphql(`
            mutation deleteSectionFile($input: FileDeleteInput!) {
              themeFileDelete(input: $input) {
                deletedFileKeys
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              input: {
                key: sectionToDelete.sectionKey,
                themeId: `gid://shopify/Theme/${admin.shop.split('.')[0]}`
              }
            }
          });

          const deleteResult = await themeFileDelete.json();
          
          // Delete from database
          await prisma.injectedSection.delete({
            where: { id: sectionId }
          });

          return json({ 
            success: true, 
            message: "Section removed from theme successfully" 
          });
        }

        return json({ error: "Section not found" }, { status: 404 });

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in theme injector action:', error);
    return json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

function generateSectionLiquid(sectionType, settings) {
  const sectionName = settings.sectionName || 'Custom Widget';
  const sectionId = sectionName.toLowerCase().replace(/\s+/g, '-');

  switch (sectionType) {
    case 'countdown_timer':
      return `{% comment %}
  ${sectionName} - Injected by A/B Optimizer App
  This section was created by the A/B Optimizer app and provides unlimited customization options.
{% endcomment %}

<div class="ab-optimizer-countdown-${sectionId}" 
     style="
       padding: {{ section.settings.padding }}px;
       background: {{ section.settings.background_color }};
       border-radius: {{ section.settings.border_radius }}px;
       border: {{ section.settings.border_width }}px solid {{ section.settings.border_color }};
       margin: {{ section.settings.margin }}px 0;
       text-align: center;
     ">

  <div class="countdown-header" style="color: {{ section.settings.text_color }}; margin-bottom: 12px;">
    <span style="font-size: {{ section.settings.font_size }}px; font-weight: bold;">
      {{ section.settings.header_text | default: 'Limited Time Offer!' }}
    </span>
  </div>

  <div class="countdown-timer" 
       data-end-time="{{ section.settings.end_time }}"
       style="display: flex; justify-content: center; gap: 16px; margin-bottom: 12px;">
    
    <div class="time-unit" style="text-align: center;">
      <div style="
        background: {{ section.settings.timer_background }};
        color: {{ section.settings.timer_color }};
        padding: 8px;
        border-radius: 4px;
        font-size: {{ section.settings.timer_font_size }}px;
        font-weight: bold;
        min-width: 50px;
      " id="days-${sectionId}">--</div>
      <div style="font-size: {{ section.settings.label_font_size }}px; margin-top: 4px;">Days</div>
    </div>
    
    <div class="time-unit" style="text-align: center;">
      <div style="
        background: {{ section.settings.timer_background }};
        color: {{ section.settings.timer_color }};
        padding: 8px;
        border-radius: 4px;
        font-size: {{ section.settings.timer_font_size }}px;
        font-weight: bold;
        min-width: 50px;
      " id="hours-${sectionId}">--</div>
      <div style="font-size: {{ section.settings.label_font_size }}px; margin-top: 4px;">Hours</div>
    </div>
    
    <div class="time-unit" style="text-align: center;">
      <div style="
        background: {{ section.settings.timer_background }};
        color: {{ section.settings.timer_color }};
        padding: 8px;
        border-radius: 4px;
        font-size: {{ section.settings.timer_font_size }}px;
        font-weight: bold;
        min-width: 50px;
      " id="minutes-${sectionId}">--</div>
      <div style="font-size: {{ section.settings.label_font_size }}px; margin-top: 4px;">Minutes</div>
    </div>
    
    <div class="time-unit" style="text-align: center;">
      <div style="
        background: {{ section.settings.timer_background }};
        color: {{ section.settings.timer_color }};
        padding: 8px;
        border-radius: 4px;
        font-size: {{ section.settings.timer_font_size }}px;
        font-weight: bold;
        min-width: 50px;
      " id="seconds-${sectionId}">--</div>
      <div style="font-size: {{ section.settings.label_font_size }}px; margin-top: 4px;">Seconds</div>
    </div>
  </div>

  {% if section.settings.show_message %}
    <div class="countdown-message" style="color: {{ section.settings.text_color }}; font-size: {{ section.settings.font_size }}px;">
      {{ section.settings.message_text | default: 'Don\\'t miss out on this amazing offer!' }}
    </div>
  {% endif %}
</div>

<script>
  function updateCountdown${sectionId.replace(/-/g, '')}() {
    var timerEl = document.querySelector('[data-end-time]');
    if (!timerEl) return;
    
    var endTime = new Date(timerEl.getAttribute('data-end-time')).getTime();
    var now = new Date().getTime();
    var distance = endTime - now;

    if (distance < 0) {
      document.getElementById('days-${sectionId}').textContent = '00';
      document.getElementById('hours-${sectionId}').textContent = '00';
      document.getElementById('minutes-${sectionId}').textContent = '00';
      document.getElementById('seconds-${sectionId}').textContent = '00';
      return;
    }

    var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById('days-${sectionId}').textContent = days.toString().padStart(2, '0');
    document.getElementById('hours-${sectionId}').textContent = hours.toString().padStart(2, '0');
    document.getElementById('minutes-${sectionId}').textContent = minutes.toString().padStart(2, '0');
    document.getElementById('seconds-${sectionId}').textContent = seconds.toString().padStart(2, '0');
  }

  setInterval(updateCountdown${sectionId.replace(/-/g, '')}, 1000);
  updateCountdown${sectionId.replace(/-/g, '')}();
</script>

{% schema %}
{
  "name": "${sectionName}",
  "tag": "section",
  "class": "section",
  "settings": [
    {
      "type": "header",
      "content": "Content Settings"
    },
    {
      "type": "text",
      "id": "header_text",
      "label": "Header Text",
      "default": "Limited Time Offer!"
    },
    {
      "type": "text",
      "id": "end_time",
      "label": "End Date & Time",
      "default": "2024-12-31T23:59:59",
      "info": "Format: YYYY-MM-DDTHH:MM:SS"
    },
    {
      "type": "text",
      "id": "message_text",
      "label": "Message Text",
      "default": "Don't miss out on this amazing offer!"
    },
    {
      "type": "checkbox",
      "id": "show_message",
      "label": "Show Message",
      "default": true
    },
    {
      "type": "header",
      "content": "Desktop Styling"
    },
    {
      "type": "color",
      "id": "background_color",
      "label": "Background Color",
      "default": "#000000"
    },
    {
      "type": "color",
      "id": "text_color",
      "label": "Text Color",
      "default": "#ffffff"
    },
    {
      "type": "color",
      "id": "timer_color",
      "label": "Timer Text Color",
      "default": "#ffffff"
    },
    {
      "type": "color",
      "id": "timer_background",
      "label": "Timer Background Color",
      "default": "#32cd32"
    },
    {
      "type": "color",
      "id": "border_color",
      "label": "Border Color",
      "default": "#32cd32"
    },
    {
      "type": "range",
      "id": "border_width",
      "label": "Border Width",
      "min": 0,
      "max": 5,
      "step": 1,
      "default": 2
    },
    {
      "type": "range",
      "id": "border_radius",
      "label": "Border Radius",
      "min": 0,
      "max": 20,
      "step": 1,
      "default": 8
    },
    {
      "type": "range",
      "id": "padding",
      "label": "Padding",
      "min": 8,
      "max": 32,
      "step": 1,
      "default": 20
    },
    {
      "type": "range",
      "id": "margin",
      "label": "Margin",
      "min": 0,
      "max": 20,
      "step": 1,
      "default": 8
    },
    {
      "type": "range",
      "id": "font_size",
      "label": "Font Size",
      "min": 12,
      "max": 24,
      "step": 1,
      "default": 16
    },
    {
      "type": "range",
      "id": "timer_font_size",
      "label": "Timer Font Size",
      "min": 16,
      "max": 32,
      "step": 1,
      "default": 20
    },
    {
      "type": "range",
      "id": "label_font_size",
      "label": "Label Font Size",
      "min": 10,
      "max": 18,
      "step": 1,
      "default": 12
    },
    {
      "type": "header",
      "content": "Mobile Styling"
    },
    {
      "type": "range",
      "id": "mobile_padding",
      "label": "Mobile Padding",
      "min": 4,
      "max": 24,
      "step": 1,
      "default": 12
    },
    {
      "type": "range",
      "id": "mobile_margin",
      "label": "Mobile Margin",
      "min": 0,
      "max": 16,
      "step": 1,
      "default": 4
    },
    {
      "type": "range",
      "id": "mobile_font_size",
      "label": "Mobile Font Size",
      "min": 10,
      "max": 20,
      "step": 1,
      "default": 14
    },
    {
      "type": "range",
      "id": "mobile_timer_font_size",
      "label": "Mobile Timer Font Size",
      "min": 14,
      "max": 28,
      "step": 1,
      "default": 18
    },
    {
      "type": "range",
      "id": "mobile_label_font_size",
      "label": "Mobile Label Font Size",
      "min": 8,
      "max": 16,
      "step": 1,
      "default": 10
    },
    {
      "type": "header",
      "content": "Advanced Settings"
    },
    {
      "type": "select",
      "id": "display_condition",
      "label": "Display Condition",
      "options": [
        { "value": "always", "label": "Always Show" },
        { "value": "sale_only", "label": "Only on Sale Items" },
        { "value": "new_only", "label": "Only on New Items" },
        { "value": "low_stock", "label": "Only on Low Stock Items" }
      ],
      "default": "always"
    },
    {
      "type": "checkbox",
      "id": "hide_on_mobile",
      "label": "Hide on Mobile",
      "default": false
    },
    {
      "type": "checkbox",
      "id": "hide_on_desktop",
      "label": "Hide on Desktop",
      "default": false
    },
    {
      "type": "range",
      "id": "animation_duration",
      "label": "Animation Duration (seconds)",
      "min": 0,
      "max": 3,
      "step": 0.1,
      "default": 0.3
    },
    {
      "type": "select",
      "id": "animation_type",
      "label": "Animation Type",
      "options": [
        { "value": "none", "label": "None" },
        { "value": "fade", "label": "Fade In" },
        { "value": "slide", "label": "Slide Up" },
        { "value": "bounce", "label": "Bounce" }
      ],
      "default": "fade"
    }
  ],
  "presets": [
    {
      "name": "${sectionName}",
      "category": "A/B Optimizer"
    }
  ]
}
{% endschema %}`;

    case 'product_badge':
      return `{% comment %}
  ${sectionName} - Injected by A/B Optimizer App
{% endcomment %}

{% assign show_badge = true %}
{% case section.settings.display_condition %}
  {% when 'sale_only' %}
    {% unless product.compare_at_price > product.price %}
      {% assign show_badge = false %}
    {% endunless %}
  {% when 'new_only' %}
    {% assign product_age = 'now' | date: '%s' | minus: product.created_at | date: '%s' | divided_by: 86400 %}
    {% unless product_age <= 30 %}
      {% assign show_badge = false %}
    {% endunless %}
  {% when 'low_stock' %}
    {% unless product.available and product.inventory_quantity <= 10 %}
      {% assign show_badge = false %}
    {% endunless %}
{% endcase %}

{% if show_badge %}
  <div class="ab-optimizer-badge-${sectionId}" 
       style="
         display: inline-block;
         padding: {{ section.settings.padding }}px;
         background: {{ section.settings.background_color }};
         color: {{ section.settings.text_color }};
         border-radius: {{ section.settings.border_radius }}px;
         font-size: {{ section.settings.font_size }}px;
         font-weight: bold;
         border: {{ section.settings.border_width }}px solid {{ section.settings.border_color }};
         margin: {{ section.settings.margin }}px;
         {% if section.settings.hide_on_mobile %}
           display: none;
         {% endif %}
       ">
    
    {% case section.settings.badge_type %}
      {% when 'custom' %}
        {{ section.settings.custom_text }}
      {% when 'sale' %}
        {% if product.compare_at_price > product.price %}
          SALE
        {% endif %}
      {% when 'new' %}
        {% assign product_age = 'now' | date: '%s' | minus: product.created_at | date: '%s' | divided_by: 86400 %}
        {% if product_age <= 30 %}
          NEW
        {% endif %}
      {% when 'limited' %}
        {% if product.available and product.inventory_quantity <= 10 %}
          LIMITED
        {% endif %}
    {% endcase %}
  </div>

  <style>
    @media (max-width: 768px) {
      .ab-optimizer-badge-${sectionId} {
        padding: {{ section.settings.mobile_padding }}px !important;
        margin: {{ section.settings.mobile_margin }}px !important;
        font-size: {{ section.settings.mobile_font_size }}px !important;
        {% if section.settings.hide_on_mobile %}
          display: none !important;
        {% endif %}
      }
    }
    
    @media (min-width: 769px) {
      {% if section.settings.hide_on_desktop %}
        .ab-optimizer-badge-${sectionId} {
          display: none !important;
        }
      {% endif %}
    }
  </style>
{% endif %}

{% schema %}
{
  "name": "${sectionName}",
  "tag": "section",
  "class": "section",
  "settings": [
    {
      "type": "header",
      "content": "Badge Content"
    },
    {
      "type": "select",
      "id": "badge_type",
      "label": "Badge Type",
      "options": [
        { "value": "custom", "label": "Custom Text" },
        { "value": "sale", "label": "Sale Badge" },
        { "value": "new", "label": "New Product" },
        { "value": "limited", "label": "Limited Stock" }
      ],
      "default": "custom"
    },
    {
      "type": "text",
      "id": "custom_text",
      "label": "Custom Badge Text",
      "default": "SPECIAL"
    },
    {
      "type": "header",
      "content": "Desktop Styling"
    },
    {
      "type": "color",
      "id": "background_color",
      "label": "Background Color",
      "default": "#32cd32"
    },
    {
      "type": "color",
      "id": "text_color",
      "label": "Text Color",
      "default": "#ffffff"
    },
    {
      "type": "color",
      "id": "border_color",
      "label": "Border Color",
      "default": "#228b22"
    },
    {
      "type": "range",
      "id": "border_width",
      "label": "Border Width",
      "min": 0,
      "max": 5,
      "step": 1,
      "default": 1
    },
    {
      "type": "range",
      "id": "border_radius",
      "label": "Border Radius",
      "min": 0,
      "max": 20,
      "step": 1,
      "default": 4
    },
    {
      "type": "range",
      "id": "padding",
      "label": "Padding",
      "min": 4,
      "max": 20,
      "step": 1,
      "default": 8
    },
    {
      "type": "range",
      "id": "margin",
      "label": "Margin",
      "min": 0,
      "max": 20,
      "step": 1,
      "default": 4
    },
    {
      "type": "range",
      "id": "font_size",
      "label": "Font Size",
      "min": 10,
      "max": 24,
      "step": 1,
      "default": 12
    },
    {
      "type": "header",
      "content": "Mobile Styling"
    },
    {
      "type": "range",
      "id": "mobile_padding",
      "label": "Mobile Padding",
      "min": 2,
      "max": 16,
      "step": 1,
      "default": 6
    },
    {
      "type": "range",
      "id": "mobile_margin",
      "label": "Mobile Margin",
      "min": 0,
      "max": 16,
      "step": 1,
      "default": 2
    },
    {
      "type": "range",
      "id": "mobile_font_size",
      "label": "Mobile Font Size",
      "min": 8,
      "max": 20,
      "step": 1,
      "default": 10
    },
    {
      "type": "header",
      "content": "Display Settings"
    },
    {
      "type": "select",
      "id": "display_condition",
      "label": "Display Condition",
      "options": [
        { "value": "always", "label": "Always Show" },
        { "value": "sale_only", "label": "Only on Sale Items" },
        { "value": "new_only", "label": "Only on New Items" },
        { "value": "low_stock", "label": "Only on Low Stock Items" }
      ],
      "default": "always"
    },
    {
      "type": "checkbox",
      "id": "hide_on_mobile",
      "label": "Hide on Mobile",
      "default": false
    },
    {
      "type": "checkbox",
      "id": "hide_on_desktop",
      "label": "Hide on Desktop",
      "default": false
    }
  ],
  "presets": [
    {
      "name": "${sectionName}",
      "category": "A/B Optimizer"
    }
  ]
}
{% endschema %}`;

    default:
      return `{% comment %}
  ${sectionName} - Injected by A/B Optimizer App
{% endcomment %}

<div class="ab-optimizer-widget-${sectionId}">
  <p>Widget content will be generated here.</p>
</div>

{% schema %}
{
  "name": "${sectionName}",
  "tag": "section",
  "class": "section",
  "settings": [
    {
      "type": "text",
      "id": "placeholder",
      "label": "Placeholder",
      "default": "Widget settings will be configured here"
    }
  ]
}
{% endschema %}`;
  }
}

export default function ThemeInjector() {
  const { theme, injectedSections } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();

  const [sectionType, setSectionType] = useState("countdown_timer");
  const [sectionName, setSectionName] = useState("");

  const sectionTypes = {
    countdown_timer: {
      name: "Countdown Timer",
      description: "Display countdown timers with unlimited customization options",
      settings: {
        sectionName: { type: "text", label: "Section Name", default: "Countdown Timer" }
      }
    },
    product_badge: {
      name: "Product Badge", 
      description: "Customizable product badges with conditional display",
      settings: {
        sectionName: { type: "text", label: "Section Name", default: "Product Badge" }
      }
    },
    social_proof: {
      name: "Social Proof",
      description: "Social proof elements with advanced styling",
      settings: {
        sectionName: { type: "text", label: "Section Name", default: "Social Proof" }
      }
    },
    progress_bar: {
      name: "Progress Bar",
      description: "Progress bars for stock levels and goals",
      settings: {
        sectionName: { type: "text", label: "Section Name", default: "Progress Bar" }
      }
    }
  };

  const handleInjectSection = () => {
    if (!sectionName.trim()) {
      alert("Please enter a section name");
      return;
    }

    const formData = new FormData();
    formData.append("actionType", "inject_section");
    formData.append("sectionType", sectionType);
    formData.append("sectionName", sectionName);
    formData.append("sectionSettings", JSON.stringify({
      sectionName: sectionName
    }));

    submit(formData, { method: "post" });
  };

  const handleDeleteSection = (sectionId) => {
    if (confirm("Are you sure you want to remove this section from your theme?")) {
      const formData = new FormData();
      formData.append("actionType", "delete_section");
      formData.append("sectionId", sectionId);

      submit(formData, { method: "post" });
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
          🎨 Theme Section Injector
        </h1>
        <p style={{ margin: "0", opacity: "0.8", fontSize: "16px" }}>
          Inject custom sections with unlimited settings directly into your theme
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
        {/* Inject New Section */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600" }}>
            Inject New Section
          </h2>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
              Section Type
            </label>
            <select
              value={sectionType}
              onChange={(e) => setSectionType(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px"
              }}
            >
              {Object.keys(sectionTypes).map(type => (
                <option key={type} value={type}>
                  {sectionTypes[type].name}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#6b7280" }}>
              {sectionTypes[sectionType].description}
            </p>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
              Section Name *
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="Enter a unique name for this section"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px"
              }}
            />
          </div>

          <button
            onClick={handleInjectSection}
            style={{
              background: "linear-gradient(135deg, #32cd32 0%, #228b22 100%)",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              width: "100%"
            }}
          >
            🚀 Inject Section into Theme
          </button>

          <div style={{ 
            marginTop: "16px", 
            padding: "12px", 
            background: "#f3f4f6", 
            borderRadius: "8px",
            fontSize: "14px",
            color: "#374151"
          }}>
            <strong>How it works:</strong>
            <ol style={{ margin: "8px 0 0 16px", padding: "0" }}>
              <li>Select a section type and name</li>
              <li>Click "Inject Section" to add it to your theme</li>
              <li>Go to theme editor → product template</li>
              <li>Add the new section with 50+ settings</li>
            </ol>
          </div>
        </div>

        {/* Injected Sections */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600" }}>
            Injected Sections
          </h2>

          {injectedSections.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎨</div>
              <p>No sections injected yet</p>
              <p style={{ fontSize: "14px", opacity: "0.7" }}>Inject your first section to get started</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {injectedSections.map(section => (
                <div key={section.id} style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "16px",
                  background: "#f9fafb"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600" }}>
                        {section.sectionName}
                      </h3>
                      <p style={{ margin: "0", fontSize: "14px", color: "#6b7280" }}>
                        {sectionTypes[section.sectionType]?.name || section.sectionType}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#9ca3af" }}>
                        File: {section.sectionKey}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteSection(section.id)}
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
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 