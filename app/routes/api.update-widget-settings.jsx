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

    console.log('🔧 Update widget settings API called:', {
      templateFilename,
      themeId,
      blockId,
      appExtensionId,
      blockSettings
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

    /**
     * Finds the media/image block in the main product section
     * Uses multiple strategies to reliably identify the media block across different themes
     * @param {Object} mainSection - The main product section object
     * @returns {Object} - { blockId: string, index: number } or null if not found
     */
    function findMediaBlock(mainSection) {
      const blocks = mainSection.blocks || {};
      const blockOrder = mainSection.block_order || [];
      
      // Common media block types (check block.type property)
      const mediaBlockTypes = [
        'product-media',
        'product-medias', 
        'media',
        'gallery',
        'product-media-gallery',
        'product-image',
        'image'
      ];
      
      // Common media block IDs (check block_order array)
      const mediaBlockIds = [
        'media',
        'medias',
        'product-media',
        'product-medias',
        'gallery',
        'product-gallery',
        'image',
        'product-image'
      ];
      
      // Strategy 1: Find by block type (most reliable)
      for (const blockId of blockOrder) {
        const block = blocks[blockId];
        if (block && block.type) {
          const blockType = String(block.type).toLowerCase();
          if (mediaBlockTypes.some(type => blockType.includes(type))) {
            const index = blockOrder.indexOf(blockId);
            console.log('✅ Found media block by type:', { blockId, blockType, index });
            return { blockId, index };
          }
        }
      }
      
      // Strategy 2: Find by common block IDs
      for (const mediaBlockId of mediaBlockIds) {
        const index = blockOrder.indexOf(mediaBlockId);
        if (index !== -1) {
          console.log('✅ Found media block by ID:', { blockId: mediaBlockId, index });
          return { blockId: mediaBlockId, index };
        }
      }
      
      // Strategy 3: Fallback - use first block (often media is first)
      if (blockOrder.length > 0) {
        const firstBlockId = blockOrder[0];
        console.log('⚠️ Using first block as media fallback:', { blockId: firstBlockId, index: 0 });
        return { blockId: firstBlockId, index: 0 };
      }
      
      console.warn('⚠️ No media block found');
      return null;
    }

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

    // Merge with existing settings (don't overwrite everything, just update what we need)
    appBlock.settings = {
      ...(appBlock.settings || {}),
      ...formattedSettings
    };

    // Reorder block to appear relative to media block
    if (!mainSection.block_order) {
      mainSection.block_order = [];
    }
    
    // Remove block from current position if it exists
    const currentIndex = mainSection.block_order.indexOf(blockInstanceId);
    if (currentIndex !== -1) {
      mainSection.block_order.splice(currentIndex, 1);
    }
    
    // Find media block and position widget relative to it
    const mediaBlock = findMediaBlock(mainSection);
    if (mediaBlock) {
      // Insert BELOW the media block (after it)
      // To place ABOVE, change to: mediaBlock.index
      const insertIndex = mediaBlock.index + 1;
      mainSection.block_order.splice(insertIndex, 0, blockInstanceId);
      console.log('✅ Reordered block to appear below media block:', {
        blockInstanceId,
        mediaBlockId: mediaBlock.blockId,
        insertIndex,
        newBlockOrder: mainSection.block_order
      });
    } else {
      // Fallback: try price block, then add to end
      const priceIndex = mainSection.block_order.indexOf('price');
      if (priceIndex !== -1) {
        mainSection.block_order.splice(priceIndex + 1, 0, blockInstanceId);
        console.log('⚠️ Media block not found, using price block as fallback');
      } else {
        if (!mainSection.block_order.includes(blockInstanceId)) {
          mainSection.block_order.push(blockInstanceId);
        }
        console.log('⚠️ Media and price blocks not found, added block to end of block_order');
      }
    }

    // Update the template
    templateJson.sections[mainSectionKey] = mainSection;

    // Save the updated template
    const updatedContent = JSON.stringify(templateJson, null, 2);

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
      console.error('❌ Theme update errors:', updateJson.data.themeFilesUpsert.userErrors);
      return json({ 
        error: 'Failed to update template',
        userErrors: updateJson.data.themeFilesUpsert.userErrors
      }, { status: 400 });
    }

    console.log('✅ Successfully updated app block settings:', {
      blockInstanceId,
      updatedSettings: formattedSettings
    });

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

