import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { themeId, templateName, templateFilename, blockType, settings } = await request.json();

    console.log('📝 Configure App Block Settings Request:', {
      themeId,
      templateName,
      templateFilename,
      blockType,
      settingsKeys: Object.keys(settings || {})
    });

    if (!themeId || !templateName || !blockType) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Determine the asset key - use templateFilename if provided, otherwise default to .json
    const assetKey = templateFilename || `templates/${templateName}.json`;
    console.log(`📖 Reading template asset: ${assetKey}`);

    // Strip the 'gid://shopify/OnlineStoreTheme/' prefix if present
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '');
    console.log(`🔧 Using theme ID: ${cleanThemeId}`);

    // Retry logic - sometimes the file isn't immediately available
    let assetResponse;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📖 Attempt ${attempts}/${maxAttempts} to read template asset`);
      
      try {
        assetResponse = await admin.rest.get({
          path: `themes/${cleanThemeId}/assets`,
          query: { "asset[key]": assetKey },
        });

        if (assetResponse && assetResponse.body && assetResponse.body.asset) {
          console.log('✅ Template asset found!');
          break;
        }
      } catch (error) {
        console.log(`⚠️ Attempt ${attempts} failed:`, error.message);
      }

      if (attempts < maxAttempts) {
        console.log('⏳ Waiting 2 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!assetResponse || !assetResponse.body || !assetResponse.body.asset) {
      console.error('❌ Failed to read template asset after all retries');
      return json({ 
        error: "Failed to read template file after multiple attempts",
        assetKey,
        attempts
      }, { status: 500 });
    }

    const asset = assetResponse.body.asset;
    console.log('✅ Template asset read successfully');

    // Step 2: Parse the JSON
    let templateData;
    try {
      templateData = JSON.parse(asset.value);
      console.log('✅ Template JSON parsed, sections:', Object.keys(templateData.sections || {}));
    } catch (parseError) {
      console.error('❌ Failed to parse template JSON:', parseError);
      return json({ error: "Invalid template JSON" }, { status: 500 });
    }

    // Step 3: Find the "main" section or create one if needed
    let mainSectionKey = 'main';
    if (!templateData.sections || !templateData.sections[mainSectionKey]) {
      console.log('⚠️ No main section found, checking for other sections...');
      // Try to find any section that could be the main section
      if (templateData.sections) {
        const sectionKeys = Object.keys(templateData.sections);
        if (sectionKeys.length > 0) {
          mainSectionKey = sectionKeys[0];
          console.log(`📌 Using section "${mainSectionKey}" as main section`);
        }
      }
    }

    // Ensure the section exists
    if (!templateData.sections) {
      templateData.sections = {};
    }
    if (!templateData.sections[mainSectionKey]) {
      // Create a basic main section
      templateData.sections[mainSectionKey] = {
        type: 'product',
        blocks: {},
        block_order: []
      };
      console.log(`✨ Created main section: ${mainSectionKey}`);
    }

    // Ensure blocks and block_order exist
    if (!templateData.sections[mainSectionKey].blocks) {
      templateData.sections[mainSectionKey].blocks = {};
    }
    if (!templateData.sections[mainSectionKey].block_order) {
      templateData.sections[mainSectionKey].block_order = [];
    }

    // Step 4: Generate a unique block ID
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const blockId = `app_${timestamp}_${randomSuffix}`;

    console.log(`✨ Adding new app block with ID: ${blockId}`);

    // Step 5: Add the block with settings to the main section
    templateData.sections[mainSectionKey].blocks[blockId] = {
      type: blockType,
      settings: settings || {},
      disabled: false
    };

    // Add to block_order
    templateData.sections[mainSectionKey].block_order.push(blockId);
    
    console.log('✅ Block added to template:', {
      sectionKey: mainSectionKey,
      blockId,
      blockType,
      settingsApplied: Object.keys(settings || {})
    });

    // Step 5: Write the updated JSON back to the theme
    const updatedJson = JSON.stringify(templateData, null, 2);
    
    console.log(`💾 Writing updated template back to ${assetKey}`);

    const updateResponse = await admin.rest.put({
      path: `themes/${cleanThemeId}/assets`,
      data: {
        asset: {
          key: assetKey,
          value: updatedJson
        }
      }
    });

    if (!updateResponse || !updateResponse.body || !updateResponse.body.asset) {
      console.error('❌ Failed to write updated template');
      return json({ error: "Failed to update template file" }, { status: 500 });
    }

    console.log('✅ Template updated successfully!');

    return json({
      success: true,
      sectionKey: mainSectionKey,
      blockId,
      settingsApplied: Object.keys(settings || {})
    });

  } catch (error) {
    console.error("❌ Error configuring app block settings:", error);
    return json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    );
  }
};

