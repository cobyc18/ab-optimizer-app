import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const templateName = formData.get("templateName");
    const themeId = formData.get("themeId");

    if (!templateName || !themeId) {
      return json({ 
        success: false, 
        error: "Missing templateName or themeId" 
      }, { status: 400 });
    }

    console.log('🔍 Checking if block exists in template:', {
      templateName,
      themeId
    });

    // Read the template file using Asset REST API
    const assetKey = `templates/${templateName}.json`;
    
    console.log('🔍 Fetching asset:', { assetKey, themeId });
    
    const response = await fetch(`https://${admin.rest.session.shop}/admin/api/2023-10/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': admin.rest.session.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('❌ Failed to fetch template:', response.status, response.statusText);
      return json({ 
        success: false, 
        blockExists: false,
        error: `Failed to fetch template: ${response.status} ${response.statusText}` 
      });
    }

    const responseData = await response.json();
    console.log('📄 Asset API response:', responseData);

    if (!responseData.asset || !responseData.asset.value) {
      console.log('❌ Template not found or has no content:', assetKey);
      return json({ 
        success: false, 
        blockExists: false,
        error: "Template not found or has no content" 
      });
    }

    const asset = responseData.asset;

    // Parse the template JSON
    let templateData;
    try {
      templateData = JSON.parse(asset.value);
    } catch (parseError) {
      console.error('❌ Failed to parse template JSON:', parseError);
      return json({ 
        success: false, 
        blockExists: false,
        error: "Invalid template JSON" 
      });
    }

    // Look for app blocks in all sections
    let blockFound = false;
    let blockDetails = null;

    if (templateData.sections) {
      for (const [sectionId, sectionData] of Object.entries(templateData.sections)) {
        if (sectionData.blocks) {
          for (const [blockId, blockData] of Object.entries(sectionData.blocks)) {
            // Check if this is our app block (simple-text-badge)
            if (blockData.type && blockData.type.includes('simple-text-badge')) {
              blockFound = true;
              blockDetails = {
                sectionId,
                blockId,
                blockType: blockData.type,
                settings: blockData.settings || {}
              };
              console.log('✅ Found app block:', blockDetails);
              break;
            }
          }
        }
        if (blockFound) break;
      }
    }

    if (blockFound) {
      console.log('✅ App block exists in template');
      return json({
        success: true,
        blockExists: true,
        blockDetails
      });
    } else {
      console.log('❌ App block not found in template');
      return json({
        success: true,
        blockExists: false
      });
    }

  } catch (error) {
    console.error('❌ Error checking block existence:', error);
    return json({ 
      success: false, 
      blockExists: false,
      error: error.message 
    }, { status: 500 });
  }
};
