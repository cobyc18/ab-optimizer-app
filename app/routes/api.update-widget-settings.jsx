import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

/**
 * API endpoint to update an existing app block's settings in a JSON template.
 * This is called AFTER the deep link adds the block to the theme editor.
 * 
 * Flow:
 * 1. Deep link adds block with default settings
 * 2. This endpoint finds the block and updates its settings
 */
export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.json();
    
    const {
      templateFilename,
      themeId,
      blockId, // e.g., "simple-text-badge"
      appExtensionId, // API key
      blockSettings // Settings to apply
    } = body;

    if (!templateFilename || !themeId || !blockId || !appExtensionId) {
      return json({ 
        error: 'Missing required parameters: templateFilename, themeId, blockId, appExtensionId' 
      }, { status: 400 });
    }

    console.log('🔧 [DEBUG] Update widget settings API called:', {
      templateFilename,
      themeId,
      blockId,
      appExtensionId,
      blockSettingsKeys: blockSettings ? Object.keys(blockSettings) : [],
      blockSettingsSample: blockSettings ? {
        header_text: blockSettings.header_text,
        body_text: blockSettings.body_text,
        text_color: blockSettings.text_color,
        background_color: blockSettings.background_color,
        icon_choice: blockSettings.icon_choice
      } : null,
      timestamp: new Date().toISOString()
    });

    // Read the current template file
    const fileQuery = `
      query getThemeFile($themeId: ID!, $filename: String!) {
        theme(id: $themeId) {
          files(filenames: [$filename]) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
              }
            }
          }
        }
      }
    `;

    const fileResponse = await admin.graphql(fileQuery, {
      variables: {
        themeId,
        filename: templateFilename
      }
    });

    const fileJson = await fileResponse.json();
    const fileNode = fileJson.data?.theme?.files?.nodes?.[0];
    const content = fileNode?.body?.content;

    if (!fileNode || !content) {
      return json({ 
        error: `Template file '${templateFilename}' not found or empty` 
      }, { status: 400 });
    }

    // Parse JSON template
    const stripJsonComments = (str) => {
      let result = '';
      let inString = false;
      let escapeNext = false;
      let inComment = false;
      let commentType = null; // '//' or '/*'
      let i = 0;
      
      while (i < str.length) {
        const char = str[i];
        const nextChar = str[i + 1];
        
        if (escapeNext) {
          result += char;
          escapeNext = false;
          i++;
          continue;
        }
        
        if (char === '\\' && inString) {
          escapeNext = true;
          result += char;
          i++;
          continue;
        }
        
        if (char === '"' && !inComment) {
          inString = !inString;
          result += char;
          i++;
          continue;
        }
        
        if (inString) {
          result += char;
          i++;
          continue;
        }
        
        // Check for comment start
        if (!inComment && char === '/' && nextChar === '/') {
          inComment = true;
          commentType = '//';
          i += 2;
          continue;
        }
        
        if (!inComment && char === '/' && nextChar === '*') {
          inComment = true;
          commentType = '/*';
          i += 2;
          continue;
        }
        
        // Check for comment end
        if (inComment && commentType === '//' && (char === '\n' || char === '\r')) {
          inComment = false;
          commentType = null;
          if (char === '\r' && nextChar === '\n') {
            i += 2;
          } else {
            i++;
          }
          continue;
        }
        
        if (inComment && commentType === '/*' && char === '*' && nextChar === '/') {
          inComment = false;
          commentType = null;
          i += 2;
          continue;
        }
        
        if (!inComment) {
          result += char;
        }
        
        i++;
      }
      
      return result.trim();
    };

    let templateJson;
    try {
      const cleanedContent = stripJsonComments(content).trim();
      templateJson = JSON.parse(cleanedContent);
    } catch (parseError) {
      return json({ 
        error: `Failed to parse JSON template: ${parseError.message}` 
      }, { status: 400 });
    }

    // Find the main section
    const sections = templateJson.sections || {};
    const mainSectionKey = Object.keys(sections).find(key => 
      sections[key].type === 'main-product' || 
      sections[key].type?.includes('product')
    ) || Object.keys(sections)[0];

    if (!mainSectionKey) {
      return json({ 
        error: 'Could not find main section in template' 
      }, { status: 400 });
    }

    const mainSection = sections[mainSectionKey];
    const blocks = mainSection.blocks || {};

    // Log all blocks for debugging
    console.log('🔍 Searching for app block in template:', {
      totalBlocks: Object.keys(blocks).length,
      blockDetails: Object.entries(blocks).map(([id, block]) => ({
        id,
        type: block?.type,
        hasSettings: !!block?.settings,
        settingsKeys: block?.settings ? Object.keys(block.settings) : []
      })),
      searchingFor: `blocks/${blockId}`,
      appExtensionId
    });

    // Find the app block that was just added by the deep link
    // It will have a type like: shopify://apps/{api_key}/blocks/{block_handle}/{unique_id}
    // OR it might be in a different format depending on how Shopify saves it
    const appBlockEntry = Object.entries(blocks).find(([blockInstanceId, block]) => {
      if (typeof block !== 'object' || !block.type) return false;
      
      const typeStr = String(block.type);
      
      // Try multiple matching strategies:
      // 1. Match by block handle in the type path
      const matchesBlockHandle = typeStr.includes(`blocks/${blockId}`);
      // 2. Match by app extension ID
      const matchesAppExtension = typeStr.includes(appExtensionId);
      // 3. Match by shopify://apps prefix
      const matchesShopifyApps = typeStr.includes('shopify://apps');
      // 4. Match by block handle anywhere in the type
      const matchesBlockIdAnywhere = typeStr.includes(blockId);
      
      const isMatch = matchesBlockHandle || 
                     (matchesShopifyApps && matchesAppExtension) ||
                     (matchesShopifyApps && matchesBlockIdAnywhere);
      
      if (isMatch || matchesShopifyApps) {
        console.log('🔍 Potential match found:', {
          blockInstanceId,
          type: typeStr,
          matchesBlockHandle,
          matchesAppExtension,
          matchesShopifyApps,
          matchesBlockIdAnywhere,
          isMatch
        });
      }
      
      return isMatch;
    });

    if (!appBlockEntry) {
      console.error('❌ App block not found. All blocks:', Object.entries(blocks).map(([id, b]) => ({
        id,
        type: b?.type
      })));
      
      return json({ 
        error: 'App block not found in template. Make sure the block was added via deep link first.',
        debug: {
          totalBlocks: Object.keys(blocks).length,
          blockTypes: Object.values(blocks).map(b => b?.type),
          blockIds: Object.keys(blocks),
          searchingFor: `blocks/${blockId}`,
          appExtensionId
        }
      }, { status: 404 });
    }

    const [blockInstanceId, appBlock] = appBlockEntry;

    console.log('✅ Found app block to update:', {
      blockInstanceId,
      blockType: appBlock.type,
      currentSettings: appBlock.settings
    });

    // Update the block's settings
    const formattedSettings = {};
    for (const [key, value] of Object.entries(blockSettings || {})) {
      // Ensure richtext values are properly formatted
      if (key === 'header_text' || key === 'body_text') {
        formattedSettings[key] = value || '<p></p>';
      } else {
        formattedSettings[key] = value;
      }
    }

    console.log('🔧 [DEBUG] Settings formatting:', {
      originalBlockSettings: appBlock.settings,
      formattedSettings: formattedSettings,
      willMerge: true
    });

    // Merge with existing settings (don't overwrite everything, just update what we need)
    const previousSettings = { ...(appBlock.settings || {}) };
    appBlock.settings = {
      ...(appBlock.settings || {}),
      ...formattedSettings
    };
    
    console.log('🔧 [DEBUG] Settings merge result:', {
      previousSettings: previousSettings,
      newSettings: appBlock.settings,
      changedKeys: Object.keys(formattedSettings)
    });

    // Reorder block to appear after "price" block
    if (!mainSection.block_order) {
      mainSection.block_order = [];
    }
    
    // Remove block from current position if it exists
    const currentIndex = mainSection.block_order.indexOf(blockInstanceId);
    if (currentIndex !== -1) {
      mainSection.block_order.splice(currentIndex, 1);
    }
    
    // Find "price" block index and insert after it
    const priceIndex = mainSection.block_order.indexOf('price');
    if (priceIndex !== -1) {
      // Insert after price block
      mainSection.block_order.splice(priceIndex + 1, 0, blockInstanceId);
      console.log('✅ Reordered block to appear after "price":', {
        blockInstanceId,
        priceIndex,
        newBlockOrder: mainSection.block_order
      });
    } else {
      // Fallback: add to end if price block not found
      if (!mainSection.block_order.includes(blockInstanceId)) {
        mainSection.block_order.push(blockInstanceId);
      }
      console.log('⚠️ Price block not found, added block to end of block_order');
    }

    // Update the template
    templateJson.sections[mainSectionKey] = mainSection;

    // Debug: Log the final settings in the template JSON before saving
    const finalBlockInJson = templateJson.sections[mainSectionKey]?.blocks?.[blockInstanceId];
    console.log('💾 [DEBUG] Template JSON before save - block settings:', {
      blockInstanceId: blockInstanceId,
      blockExists: !!finalBlockInJson,
      blockSettings: finalBlockInJson?.settings,
      blockSettingsKeys: finalBlockInJson?.settings ? Object.keys(finalBlockInJson.settings) : [],
      blockSettingsSample: finalBlockInJson?.settings ? {
        header_text: finalBlockInJson.settings.header_text,
        body_text: finalBlockInJson.settings.body_text,
        text_color: finalBlockInJson.settings.text_color,
        background_color: finalBlockInJson.settings.background_color,
        icon_choice: finalBlockInJson.settings.icon_choice
      } : null
    });

    // Save the updated template
    const updatedContent = JSON.stringify(templateJson, null, 2);
    
    console.log('💾 [DEBUG] Template JSON content length:', updatedContent.length);

    const updateMutation = `
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateResponse = await admin.graphql(updateMutation, {
      variables: {
        themeId,
        files: [{
          filename: templateFilename,
          body: {
            type: "TEXT",
            value: updatedContent
          }
        }]
      }
    });

    const updateJson = await updateResponse.json();

    if (updateJson.data?.themeFilesUpsert?.userErrors?.length > 0) {
      console.error('❌ [DEBUG] Theme update errors:', updateJson.data.themeFilesUpsert.userErrors);
      return json({ 
        error: 'Failed to update template',
        userErrors: updateJson.data.themeFilesUpsert.userErrors
      }, { status: 400 });
    }

    console.log('✅ [DEBUG] Successfully updated app block settings:', {
      blockInstanceId,
      updatedSettings: formattedSettings,
      finalBlockSettings: appBlock.settings,
      templateFilename: templateFilename,
      themeId: themeId,
      upsertedFiles: updateJson.data?.themeFilesUpsert?.upsertedThemeFiles,
      timestamp: new Date().toISOString()
    });
    
    // Verify the settings were actually saved by reading the template back
    console.log('🔍 [DEBUG] Verifying settings were saved...');
    try {
      const verifyResponse = await admin.graphql(fileQuery, {
        variables: {
          themeId,
          filename: templateFilename
        }
      });
      const verifyJson = await verifyResponse.json();
      const verifyContent = verifyJson.data?.theme?.files?.nodes?.[0]?.body?.content;
      if (verifyContent) {
        const verifyTemplate = JSON.parse(stripJsonComments(verifyContent));
        const verifyBlock = verifyTemplate.sections?.[mainSectionKey]?.blocks?.[blockInstanceId];
        console.log('✅ [DEBUG] Verification - settings in saved template:', {
          blockExists: !!verifyBlock,
          blockSettings: verifyBlock?.settings,
          blockSettingsSample: verifyBlock?.settings ? {
            header_text: verifyBlock.settings.header_text,
            body_text: verifyBlock.settings.body_text,
            text_color: verifyBlock.settings.text_color,
            background_color: verifyBlock.settings.background_color,
            icon_choice: verifyBlock.settings.icon_choice
          } : null
        });
      }
    } catch (verifyError) {
      console.error('⚠️ [DEBUG] Could not verify saved settings:', verifyError);
    }

    // Wait a moment for Shopify to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    return json({ 
      success: true,
      blockInstanceId,
      updatedSettings: formattedSettings
    });

  } catch (error) {
    console.error('❌ Error updating widget settings:', error);
    return json({ 
      error: error.message || 'Failed to update widget settings' 
    }, { status: 500 });
  }
};

