import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const { themeId, snippetName, snippetContent, widget, productId, position } = await request.json();
    
    console.log("🔧 Creating widget preview data:", { widget, productId, position });
    
    // Since we don't have write_themes permission, we'll create a preview system instead
    // This generates the widget code and provides installation instructions
    
    const widgetSnippet = `
{% comment %}
  A/B Test Widget: ${widget}
  Product ID: ${productId}
  Position: ${JSON.stringify(position)}
  Generated: ${new Date().toISOString()}
{% endcomment %}

${snippetContent}

{% comment %} End A/B Test Widget {% endcomment %}`;

    // Return preview data instead of trying to modify theme files
    return json({ 
      success: true, 
      message: `Widget "${widget}" preview generated successfully!`,
      widgetCode: widgetSnippet,
      snippetName,
      themeId,
      widget,
      productId,
      position,
      installationInstructions: `
Installation Instructions:

1. Go to your Shopify Admin → Online Store → Themes
2. Click "Actions" → "Edit code" on your current theme
3. Navigate to "Snippets" folder
4. Create a new file called "${snippetName}.liquid"
5. Copy and paste the widget code below
6. Save the file
7. Add {% include '${snippetName}' %} to your product template where you want the widget to appear

Widget Code:
${widgetSnippet}
      `.trim()
    });

  } catch (error) {
    console.error("❌ Error creating widget preview:", error);
    
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

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const url = new URL(request.url);
    const themeId = url.searchParams.get('themeId');
    
    if (!themeId) {
      return json({ error: 'Theme ID is required' }, { status: 400 });
    }

    // Query to get theme information and files
    const query = `
      query getTheme($id: ID!) {
        onlineStoreTheme(id: $id) {
          id
          name
          role
          createdAt
          updatedAt
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { id: themeId }
    });

    const responseData = await response.json();
    
    if (responseData.errors) {
      throw new Error(`GraphQL errors: ${responseData.errors.map(e => e.message).join(', ')}`);
    }

    return json({ 
      success: true, 
      theme: responseData.data?.onlineStoreTheme
    });

  } catch (error) {
    console.error("❌ Error fetching theme info:", error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 400 });
  }
};
