import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const { themeId, snippetName, snippetContent, widget, productId } = await request.json();
    
    console.log("🔧 Injecting widget:", { themeId, snippetName, widget, productId });
    
    // Generate widget snippet content
    const widgetSnippet = `
{% comment %}
  A/B Test Widget: ${widget}
  Product ID: ${productId}
  Generated: ${new Date().toISOString()}
{% endcomment %}

${snippetContent}

{% comment %} End A/B Test Widget {% endcomment %}`;

    // Create the snippet using Shopify Admin API
    const response = await admin.rest.put({
      path: `themes/${themeId}/assets`,
      data: {
        asset: {
          key: `snippets/${snippetName}.liquid`,
          value: widgetSnippet
        }
      }
    });

    console.log("✅ Widget snippet created:", response.body.asset.key);

    return json({ 
      success: true, 
      message: `Widget "${widget}" successfully added to your theme!`,
      snippetKey: response.body.asset.key,
      themeId,
      widget,
      productId
    });

  } catch (error) {
    console.error("❌ Error injecting widget:", error);
    
    // Provide fallback instructions
    return json({ 
      success: false, 
      error: error.message,
      fallbackInstructions: `
Manual Installation Instructions:

1. Go to your Shopify Admin → Online Store → Themes
2. Click "Actions" → "Edit code" on your current theme
3. Navigate to "Snippets" folder
4. Create a new file called "${snippetName}.liquid"
5. Copy and paste the following code:

${snippetContent}

6. Save the file
7. Add {% include '${snippetName}' %} to your product template where you want the widget to appear
      `.trim()
    }, { status: 400 });
  }
};
