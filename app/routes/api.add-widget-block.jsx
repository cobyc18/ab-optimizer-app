import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

function stripJsonComments(input) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let escapeNext = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      i += 1;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      i += 1;
      continue;
    }

    if (inString) {
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      result += char;
      i += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      result += char;
      i += 1;
      continue;
    }

    // Handle single-line comments (//)
    if (char === '/' && nextChar === '/') {
      // Skip until end of line
      while (i < input.length && input[i] !== '\n' && input[i] !== '\r') {
        i += 1;
      }
      // Include the newline character in the output
      if (i < input.length) {
        result += input[i];
        i += 1;
      }
      continue;
    }

    // Handle multi-line comments (/* ... */)
    if (char === '/' && nextChar === '*') {
      // Skip the opening /* (both characters)
      i += 2;
      // Look for closing */
      while (i < input.length) {
        if (input[i] === '*' && i + 1 < input.length && input[i + 1] === '/') {
          i += 2; // Skip the closing */ (both characters)
          break;
        }
        i += 1;
      }
      continue;
    }

    result += char;
    i += 1;
  }

  return result.trim();
}

function escapeControlCharacters(input) {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const code = char.charCodeAt(0);

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      if (code >= 0 && code <= 31) {
        if (code === 0x09) {
          result += '\\t';
        } else if (code === 0x0A) {
          result += '\\n';
        } else if (code === 0x0D) {
          result += '\\r';
        } else {
          const hex = code.toString(16).padStart(4, '0');
          result += `\\u${hex}`;
        }
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }

  return result;
}

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

export const action = async ({ request }) => {
  try {
    console.log('🔧 Add widget block API called');
    const { admin } = await authenticate.admin(request);
    const requestBody = await request.json();
    const { templateFilename, themeId, blockId, appExtensionId, blockSettings } = requestBody;

    console.log('🔧 Add widget block request details:', { 
      templateFilename, 
      themeId, 
      blockId, 
      appExtensionId,
      blockSettings,
      fullRequestBody: requestBody,
      hasAllParams: !!(templateFilename && themeId && blockId && appExtensionId)
    });

    if (!templateFilename || !themeId || !blockId || !appExtensionId) {
      console.error('❌ Missing required parameters:', {
        hasTemplateFilename: !!templateFilename,
        hasThemeId: !!themeId,
        hasBlockId: !!blockId,
        hasAppExtensionId: !!appExtensionId
      });
      return json({ error: 'Missing required parameters: templateFilename, themeId, blockId, appExtensionId' }, { status: 400 });
    }

    // 1. Get the template file content
    const fileRes = await admin.graphql(
      `query getFile($themeId: ID!, $filename: String!) {
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
      }`,
      { 
        variables: { 
          themeId: themeId, 
          filename: templateFilename 
        } 
      }
    );
    
    const fileJson = await fileRes.json();
    console.log('📄 Template file GraphQL response:', JSON.stringify(fileJson, null, 2));
    
    if (fileJson.errors) {
      console.error('❌ GraphQL errors:', fileJson.errors);
      return json({ error: `GraphQL error: ${fileJson.errors[0]?.message}` }, { status: 400 });
    }
    
    const fileNode = fileJson.data?.theme?.files?.nodes?.[0];
    const content = fileNode?.body?.content;
    
    console.log('📄 Template file node check:', {
      hasFileNode: !!fileNode,
      hasContent: !!content,
      contentLength: content?.length,
      filename: fileNode?.filename
    });
    
    if (!fileNode || !content) {
      console.error('❌ Template file not found or empty:', {
        fileNode,
        hasContent: !!content,
        availableFiles: fileJson.data?.theme?.files?.nodes?.map(n => n.filename)
      });
      return json({ error: `Template file '${templateFilename}' not found or empty` }, { status: 400 });
    }

    console.log('📄 Template file retrieved successfully, type:', templateFilename.endsWith('.json') ? 'JSON' : 'Liquid');

    let updatedContent;
    let blockInstanceId; // Declare at higher scope for verification code
    // For JSON templates, app blocks use the format: shopify://apps/{api_key}/blocks/{block_handle}/{unique_id}
    // The appExtensionId is the same as the API key (client_id from shopify.app.toml)
    const appApiKey = appExtensionId; // This is the API key (client_id)
    const blockHandle = blockId; // e.g., "simple-text-badge"
    const uniqueBlockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const appBlockType = `shopify://apps/${appApiKey}/blocks/${blockHandle}/${uniqueBlockId}`;
    const appBlockId = `${appExtensionId}/${blockId}`;
    const appliedBlockSettings = blockSettings && typeof blockSettings === 'object' ? blockSettings : {};

    if (templateFilename.endsWith('.json')) {
      // Handle JSON templates (OS 2.0)
      try {
        let cleanedContent = stripJsonComments(content).trim();
        console.log('📄 Cleaned JSON content (removed comments safely):', {
          originalLength: content.length,
          cleanedLength: cleanedContent.length
        });

        let templateJson;
        try {
          templateJson = JSON.parse(cleanedContent);
        } catch (parseError) {
          console.error('❌ JSON parse error after comment removal:', {
            error: parseError.message,
            position: parseError.message.match(/position (\d+)/)?.[1],
            line: parseError.message.match(/line (\d+)/)?.[1],
            column: parseError.message.match(/column (\d+)/)?.[1]
          });
          
          // Extract error position for debugging
          const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
          const errorLine = parseInt(parseError.message.match(/line (\d+)/)?.[1] || '0');
          const errorCol = parseInt(parseError.message.match(/column (\d+)/)?.[1] || '0');

          console.log('🔍 Error details:', {
            position: errorPos,
            line: errorLine,
            column: errorCol
          });

          const fixedContent = escapeControlCharacters(cleanedContent);
          console.log('📄 Escaped control characters within strings, retrying parse...');

          try {
            templateJson = JSON.parse(fixedContent);
            console.log('✅ Successfully parsed JSON after fixing control characters');
          } catch (secondError) {
            console.error('❌ Second parse attempt failed:', {
              error: secondError.message,
              position: secondError.message.match(/position (\d+)/)?.[1],
              line: secondError.message.match(/line (\d+)/)?.[1],
              column: secondError.message.match(/column (\d+)/)?.[1],
              fixedContentStart: fixedContent.substring(0, 200),
              fixedContentAroundError: fixedContent.substring(
                Math.max(0, parseInt(secondError.message.match(/position (\d+)/)?.[1] || '0') - 100),
                Math.min(fixedContent.length, parseInt(secondError.message.match(/position (\d+)/)?.[1] || '0') + 100)
              )
            });
            
            throw new Error(`Failed to parse JSON template after fixing control characters: ${secondError.message}. Original error: ${parseError.message}`);
          }
        }
        
        // Find the main product section
        const sections = templateJson.sections || {};
        console.log('📋 Template sections found:', Object.keys(sections));
        
        const mainSectionKey = Object.keys(sections).find(key => 
          sections[key].type === 'main-product' || 
          sections[key].type?.includes('product')
        ) || Object.keys(sections)[0];

        console.log('📋 Main section key:', mainSectionKey, {
          sectionType: sections[mainSectionKey]?.type,
          allSectionTypes: Object.keys(sections).map(k => ({ key: k, type: sections[k]?.type }))
        });

        if (!mainSectionKey) {
          console.error('❌ Could not find main section in template');
          return json({ error: 'Could not find main section in template' }, { status: 400 });
        }

        const mainSection = sections[mainSectionKey];
        console.log('📋 Main section before adding block:', {
          mainSectionKey,
          hasBlocks: !!mainSection.blocks,
          hasBlockOrder: !!mainSection.block_order,
          existingBlocks: Object.keys(mainSection.blocks || {}),
          existingBlockOrder: mainSection.block_order || []
        });
        
        // Initialize blocks and block_order if they don't exist
        if (!mainSection.blocks) {
          mainSection.blocks = {};
        }
        if (!mainSection.block_order) {
          mainSection.block_order = [];
        }

        // Generate unique block instance ID
        blockInstanceId = `app_block_${Date.now()}`;

        // Add the app block
        // Ensure settings are properly formatted - all values must be strings for richtext
        const formattedSettings = {};
        for (const [key, value] of Object.entries(appliedBlockSettings)) {
          // Ensure richtext values are properly formatted
          if (key === 'header_text' || key === 'body_text') {
            formattedSettings[key] = value || '<p></p>';
          } else {
            formattedSettings[key] = value;
          }
        }
        
        mainSection.blocks[blockInstanceId] = {
          type: appBlockType,
          settings: formattedSettings
        };

        // Add to block_order relative to media block
        if (!mainSection.block_order.includes(blockInstanceId)) {
          const mediaBlock = findMediaBlock(mainSection);
          if (mediaBlock) {
            // Insert BELOW the media block (after it)
            // To place ABOVE, change to: mediaBlock.index
            const insertIndex = mediaBlock.index + 1;
            mainSection.block_order.splice(insertIndex, 0, blockInstanceId);
            console.log('✅ Positioned widget below media block:', {
              blockInstanceId,
              mediaBlockId: mediaBlock.blockId,
              insertIndex,
              blockOrder: mainSection.block_order
            });
          } else {
            // Fallback: try price block, then add to end
            const priceIndex = mainSection.block_order.indexOf('price');
            if (priceIndex !== -1) {
              mainSection.block_order.splice(priceIndex + 1, 0, blockInstanceId);
              console.log('⚠️ Media block not found, using price block as fallback');
            } else {
              mainSection.block_order.push(blockInstanceId);
              console.log('⚠️ Media and price blocks not found, added to end');
            }
          }
        }

        templateJson.sections[mainSectionKey] = mainSection;

        // Verify the settings are in the block before stringifying
        const finalBlock = templateJson.sections[mainSectionKey].blocks[blockInstanceId];
        console.log('🔍 Final block structure before stringify:', {
          blockInstanceId,
          blockType: finalBlock.type,
          blockSettings: finalBlock.settings,
          settingsKeys: Object.keys(finalBlock.settings || {}),
          headerTextValue: finalBlock.settings?.header_text,
          bodyTextValue: finalBlock.settings?.body_text,
          textColorValue: finalBlock.settings?.text_color
        });

        updatedContent = JSON.stringify(templateJson, null, 2);
        console.log('✅ Added app block to JSON template:', { 
          blockInstanceId, 
          appBlockType,
          mainSectionKey,
          updatedBlockOrder: mainSection.block_order,
          updatedBlocks: Object.keys(mainSection.blocks),
          blockSettings: appliedBlockSettings,
          settingsKeys: Object.keys(appliedBlockSettings)
        });
        
        // Log the actual block structure that will be sent
        console.log('🔍 Block structure being sent to Shopify:', JSON.stringify({
          blockId: blockInstanceId,
          block: mainSection.blocks[blockInstanceId],
          blockOrder: mainSection.block_order
        }, null, 2));
        
        // Log a preview of the JSON content (first 2000 chars)
        console.log('📄 JSON content preview (first 2000 chars):', updatedContent.substring(0, 2000));

      } catch (parseError) {
        console.error('❌ Failed to parse JSON template:', parseError);
        return json({ error: `Failed to parse JSON template: ${parseError.message}` }, { status: 400 });
      }
    } else {
      // Handle Liquid templates (OS 2.0 with schema)
      try {
        console.log('📄 Processing Liquid template...');
        // Extract the schema section
        const schemaStartMatch = content.match(/\{%\s*schema\s*%\}/i);
        const schemaEndMatch = content.match(/\{%\s*endschema\s*%\}/i);
        
        console.log('📄 Schema match check:', {
          hasSchemaStart: !!schemaStartMatch,
          hasSchemaEnd: !!schemaEndMatch,
          schemaStartIndex: schemaStartMatch?.index,
          schemaEndIndex: schemaEndMatch?.index
        });
        
        if (!schemaStartMatch || !schemaEndMatch) {
          // Old Liquid template without schema - add render statement
          console.log('📄 Old Liquid template without schema, using render statement');
          const renderStatement = `{% render '${blockId}' %}\n`;
          const schemaIndex = content.indexOf('{% schema %}');
          if (schemaIndex !== -1) {
            updatedContent = content.slice(0, schemaIndex) + renderStatement + content.slice(schemaIndex);
          } else {
            updatedContent = content + '\n' + renderStatement;
          }
          console.log('✅ Added app block render to old Liquid template');
        } else {
          // OS 2.0 Liquid template with schema - update schema JSON
          console.log('📄 OS 2.0 Liquid template with schema detected');
          const schemaStartIndex = schemaStartMatch.index + schemaStartMatch[0].length;
          const schemaEndIndex = schemaEndMatch.index;
          const schemaJsonStr = content.slice(schemaStartIndex, schemaEndIndex).trim();
          
          console.log('📄 Schema JSON string length:', schemaJsonStr.length);
          console.log('📄 Schema JSON preview (first 200 chars):', schemaJsonStr.substring(0, 200));
          
          const schemaJson = JSON.parse(schemaJsonStr);
          console.log('📄 Parsed schema JSON:', Object.keys(schemaJson));
          
          // Find the main product section in schema
          const sections = schemaJson.sections || {};
          console.log('📋 Liquid template sections found:', Object.keys(sections));
          
          const mainSectionKey = Object.keys(sections).find(key => 
            sections[key].type === 'main-product' || 
            sections[key].type?.includes('product')
          ) || Object.keys(sections)[0];

          console.log('📋 Main section key in Liquid template:', mainSectionKey, {
            sectionType: sections[mainSectionKey]?.type,
            allSectionTypes: Object.keys(sections).map(k => ({ key: k, type: sections[k]?.type }))
          });

          if (!mainSectionKey) {
            console.error('❌ Could not find main section in Liquid template schema');
            return json({ error: 'Could not find main section in Liquid template schema' }, { status: 400 });
          }

          const mainSection = sections[mainSectionKey];
          console.log('📋 Main section before adding block (Liquid):', {
            mainSectionKey,
            hasBlocks: !!mainSection.blocks,
            hasBlockOrder: !!mainSection.block_order,
            existingBlocks: Object.keys(mainSection.blocks || {}),
            existingBlockOrder: mainSection.block_order || []
          });
          
          // Initialize blocks and block_order if they don't exist
          if (!mainSection.blocks) {
            mainSection.blocks = {};
          }
          if (!mainSection.block_order) {
            mainSection.block_order = [];
          }

          // Generate unique block instance ID
          blockInstanceId = `app_block_${Date.now()}`;

          // Add the app block
          mainSection.blocks[blockInstanceId] = {
            type: appBlockType,
            settings: appliedBlockSettings
          };

          // Add to block_order relative to media block
          if (!mainSection.block_order.includes(blockInstanceId)) {
            const mediaBlock = findMediaBlock(mainSection);
            if (mediaBlock) {
              // Insert BELOW the media block (after it)
              // To place ABOVE, change to: mediaBlock.index
              const insertIndex = mediaBlock.index + 1;
              mainSection.block_order.splice(insertIndex, 0, blockInstanceId);
              console.log('✅ Positioned widget below media block (Liquid):', {
                blockInstanceId,
                mediaBlockId: mediaBlock.blockId,
                insertIndex,
                blockOrder: mainSection.block_order
              });
            } else {
              // Fallback: try price block, then add to end
              const priceIndex = mainSection.block_order.indexOf('price');
              if (priceIndex !== -1) {
                mainSection.block_order.splice(priceIndex + 1, 0, blockInstanceId);
                console.log('⚠️ Media block not found, using price block as fallback (Liquid)');
              } else {
                mainSection.block_order.push(blockInstanceId);
                console.log('⚠️ Media and price blocks not found, added to end (Liquid)');
              }
            }
          }

          sections[mainSectionKey] = mainSection;
          schemaJson.sections = sections;

          // Reconstruct the template with updated schema
          const updatedSchemaJson = JSON.stringify(schemaJson, null, 2);
          const beforeSchema = content.slice(0, schemaStartIndex);
          const afterSchema = content.slice(schemaEndIndex);
          
          updatedContent = beforeSchema + '\n' + updatedSchemaJson + '\n' + afterSchema;
          
          console.log('✅ Added app block to Liquid template schema:', { 
            blockInstanceId, 
            appBlockType,
            mainSectionKey,
            updatedBlockOrder: mainSection.block_order,
            updatedBlocks: Object.keys(mainSection.blocks)
          });
        }
      } catch (parseError) {
        console.error('❌ Failed to parse Liquid template schema:', {
          error: parseError,
          message: parseError.message,
          stack: parseError.stack
        });
        // Fallback: add render statement
        const renderStatement = `{% render '${blockId}' %}\n`;
        const schemaIndex = content.indexOf('{% schema %}');
        if (schemaIndex !== -1) {
          updatedContent = content.slice(0, schemaIndex) + renderStatement + content.slice(schemaIndex);
        } else {
          updatedContent = content + '\n' + renderStatement;
        }
        console.log('⚠️ Used fallback: Added app block render statement');
      }
    }

    // 2. Update the template file using themeFilesUpsert mutation
    const updateMutation = `
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          job {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateVariables = {
      themeId: themeId,
      files: [
        {
          filename: templateFilename,
          body: {
            type: "TEXT",
            value: updatedContent
          }
        }
      ]
    };

    console.log('📝 Updating template file with app block using themeFilesUpsert...');

    const updateResponse = await admin.graphql(updateMutation, {
      variables: updateVariables
    });

    const updateJson = await updateResponse.json();
    console.log('📝 GraphQL update response:', JSON.stringify(updateJson, null, 2));

    if (updateJson.errors) {
      console.error('❌ GraphQL update errors:', updateJson.errors);
      return json({ error: `GraphQL update error: ${updateJson.errors[0]?.message || 'Unknown error'}` }, { status: 400 });
    }

    if (updateJson.data?.themeFilesUpsert?.userErrors?.length > 0) {
      console.error('❌ Theme upsert user errors:', updateJson.data.themeFilesUpsert.userErrors);
      return json({ error: `Theme update error: ${updateJson.data.themeFilesUpsert.userErrors[0]?.message || 'Unknown error'}` }, { status: 400 });
    }

    const updatedFiles = updateJson.data?.themeFilesUpsert?.upsertedThemeFiles || [];
    
    console.log('✅ Template updated successfully with app block:', {
      updatedFiles: updatedFiles.map(f => f.filename),
      templateFilename,
      blockId,
      appExtensionId
    });

    // 3. Always proceed with verification (no more async job polling)
    console.log('⏳ Verifying settings were saved...');
    // Wait longer for Shopify to process even synchronous operations
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Verify the settings were saved by reading the template back with retry logic
    if (templateFilename.endsWith('.json')) {
      console.log('🔍 Verifying settings were saved by reading template back...');
      
      let verificationSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second between retries
      
      while (!verificationSuccess && retryCount < maxRetries) {
        if (retryCount > 0) {
          console.log(`🔄 Retry ${retryCount}/${maxRetries - 1} - waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        try {
          const verifyRes = await admin.graphql(
            `query getFile($themeId: ID!, $filename: String!) {
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
            }`,
            { 
              variables: { 
                themeId: themeId, 
                filename: templateFilename 
              } 
            }
          );
          
          const verifyJson = await verifyRes.json();
          const verifyContent = verifyJson.data?.theme?.files?.nodes?.[0]?.body?.content;
          
          if (verifyContent) {
            try {
              const cleanedContent = stripJsonComments(verifyContent);
              const verifyTemplate = JSON.parse(cleanedContent);
              const mainSection = verifyTemplate.sections?.main;
              const blocks = mainSection?.blocks || {};
              
              // Log all blocks for debugging
              console.log('🔍 All blocks in template:', {
                totalBlocks: Object.keys(blocks).length,
                blockDetails: Object.entries(blocks).map(([id, block]) => ({
                  id,
                  type: block?.type,
                  hasSettings: !!block?.settings,
                  settingsKeys: block?.settings ? Object.keys(block.settings) : [],
                  settings: block?.settings
                }))
              });
              
              // Log what we're looking for
              console.log('🔍 Searching for app block:', {
                blockInstanceId,
                appBlockType,
                searchingFor: {
                  byType: 'shopify://apps or simple-text-badge',
                  byId: blockInstanceId
                }
              });
              
              // Find our app block - check for both the full shopify:// format and just the block handle
              const appBlock = Object.values(blocks).find(block => 
                typeof block === 'object' && 
                block.type && 
                (block.type.includes('simple-text-badge') || 
                 block.type.includes('shopify://apps') ||
                 block.type.startsWith('@'))
              );
              
              // Also try finding by block ID if we know it
              const appBlockById = blockInstanceId ? blocks[blockInstanceId] : null;
              
              console.log('🔍 Block search results:', {
                foundByType: !!appBlock,
                foundById: !!appBlockById,
                appBlockType: appBlock?.type,
                appBlockByIdType: appBlockById?.type
              });
              
              // Use whichever we found
              const foundBlock = appBlock || appBlockById;
              
              if (foundBlock) {
                const allSettings = foundBlock.settings || {};
                const settingsKeys = Object.keys(allSettings);
                
                console.log('✅ Verified app block settings in template:', {
                  blockType: foundBlock.type,
                  blockId: blockInstanceId,
                  foundBy: appBlock ? 'type search' : 'ID search',
                  settingsCount: settingsKeys.length,
                  settingsKeys: settingsKeys,
                  allSettings: JSON.stringify(allSettings, null, 2),
                  headerText: foundBlock.settings?.header_text,
                  headerTextType: typeof foundBlock.settings?.header_text,
                  headerTextLength: foundBlock.settings?.header_text?.length,
                  bodyText: foundBlock.settings?.body_text,
                  bodyTextType: typeof foundBlock.settings?.body_text,
                  textColor: foundBlock.settings?.text_color,
                  backgroundColor: foundBlock.settings?.background_color,
                  attempt: retryCount + 1
                });
                
                // Check if settings are actually present and have values
                if (foundBlock.settings && Object.keys(foundBlock.settings).length > 0) {
                  // Check if the specific settings we care about are present
                  const hasHeaderText = foundBlock.settings.hasOwnProperty('header_text');
                  const hasBodyText = foundBlock.settings.hasOwnProperty('body_text');
                  const hasTextColor = foundBlock.settings.hasOwnProperty('text_color');
                  const hasBackgroundColor = foundBlock.settings.hasOwnProperty('background_color');
                  
                  console.log('🔍 Settings presence check:', {
                    hasHeaderText,
                    hasBodyText,
                    hasTextColor,
                    hasBackgroundColor,
                    headerTextValue: foundBlock.settings.header_text,
                    bodyTextValue: foundBlock.settings.body_text,
                    textColorValue: foundBlock.settings.text_color,
                    backgroundColorValue: foundBlock.settings.background_color,
                    allSettingsInBlock: Object.keys(foundBlock.settings)
                  });
                  
                  if (hasHeaderText || hasBodyText || hasTextColor || hasBackgroundColor) {
                    verificationSuccess = true;
                  } else {
                    console.warn(`⚠️ Settings object exists but doesn't contain expected keys (attempt ${retryCount + 1})`);
                  }
                } else {
                  console.warn(`⚠️ Settings object exists but is empty (attempt ${retryCount + 1})`);
                }
              } else {
                console.warn(`⚠️ App block not found in verified template (attempt ${retryCount + 1})`);
                // Log all blocks to help debug
                console.log('🔍 All blocks in main section:', Object.keys(blocks).map(id => ({
                  id,
                  type: blocks[id]?.type,
                  hasSettings: !!blocks[id]?.settings,
                  settingsKeys: blocks[id]?.settings ? Object.keys(blocks[id].settings) : []
                })));
              }
            } catch (verifyError) {
              console.error(`❌ Error parsing verified template (attempt ${retryCount + 1}):`, verifyError);
            }
          } else {
            console.warn(`⚠️ No content found in verified template (attempt ${retryCount + 1})`);
          }
        } catch (verifyError) {
          console.error(`❌ Error verifying template (attempt ${retryCount + 1}):`, verifyError);
        }
        
        retryCount++;
      }
      
      if (!verificationSuccess) {
        console.error('❌ Failed to verify settings after all retries. Settings may not have been saved correctly.');
      }
    }
    
    return json({ 
      success: true, 
      message: `App block '${blockId}' added to template '${templateFilename}'`,
      templateFilename,
      updatedFiles
    });

  } catch (error) {
    console.error('❌ Error in addWidgetBlock:', error);
    return json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
};


