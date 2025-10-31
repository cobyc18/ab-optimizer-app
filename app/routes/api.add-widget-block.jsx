import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    console.log('🔧 Add widget block API called');
    const { admin } = await authenticate.admin(request);
    const requestBody = await request.json();
    const { templateFilename, themeId, blockId, appExtensionId } = requestBody;

    console.log('🔧 Add widget block request details:', { 
      templateFilename, 
      themeId, 
      blockId, 
      appExtensionId,
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
    const appBlockType = `@shopify/theme-app-extension/${blockId}`;
    const appBlockId = `${appExtensionId}/${blockId}`;

    if (templateFilename.endsWith('.json')) {
      // Handle JSON templates (OS 2.0)
      try {
        // Strip comments from JSON (Shopify allows comments in JSON templates)
        // Need to be careful not to remove // or /* inside strings
        let cleanedContent = content;
        
        // Remove single-line comments (//) - but not inside strings
        // This regex matches // followed by anything except newline, but only outside quotes
        cleanedContent = cleanedContent.replace(/\/\/[^\n\r]*/g, '');
        
        // Remove multi-line comments (/* */) - but not inside strings
        // This regex matches /* ... */ across multiple lines
        cleanedContent = cleanedContent.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Trim whitespace that might be left
        cleanedContent = cleanedContent.trim();
        
        // Clean up any trailing commas that might be left after comment removal
        cleanedContent = cleanedContent.replace(/,\s*}/g, '}');
        cleanedContent = cleanedContent.replace(/,\s*]/g, ']');
        
        console.log('📄 Cleaned JSON content (removed comments):', {
          originalLength: content.length,
          cleanedLength: cleanedContent.length,
          preview: cleanedContent.substring(0, 200)
        });
        
        const templateJson = JSON.parse(cleanedContent);
        
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
        const blockInstanceId = `app_block_${Date.now()}`;

        // Add the app block
        mainSection.blocks[blockInstanceId] = {
          type: appBlockType,
          settings: {}
        };

        // Add to block_order if not already there
        if (!mainSection.block_order.includes(blockInstanceId)) {
          mainSection.block_order.push(blockInstanceId);
        }

        templateJson.sections[mainSectionKey] = mainSection;

        updatedContent = JSON.stringify(templateJson, null, 2);
        console.log('✅ Added app block to JSON template:', { 
          blockInstanceId, 
          appBlockType,
          mainSectionKey,
          updatedBlockOrder: mainSection.block_order,
          updatedBlocks: Object.keys(mainSection.blocks)
        });

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
          const blockInstanceId = `app_block_${Date.now()}`;

          // Add the app block
          mainSection.blocks[blockInstanceId] = {
            type: appBlockType,
            settings: {}
          };

          // Add to block_order if not already there
          if (!mainSection.block_order.includes(blockInstanceId)) {
            mainSection.block_order.push(blockInstanceId);
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

    // 2. Update the template file using themeFileUpdate mutation
    const updateMutation = `
      mutation themeFileUpdate($themeId: ID!, $files: [OnlineStoreThemeFileInput!]!) {
        themeFileUpdate(themeId: $themeId, files: $files) {
          updatedThemeFiles {
            filename
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
          content: updatedContent
        }
      ]
    };

    console.log('📝 Updating template file with app block...');

    const updateResponse = await admin.graphql(updateMutation, {
      variables: updateVariables
    });

    const updateJson = await updateResponse.json();
    console.log('📝 GraphQL update response:', JSON.stringify(updateJson, null, 2));

    if (updateJson.errors) {
      console.error('❌ GraphQL update errors:', updateJson.errors);
      return json({ error: `GraphQL update error: ${updateJson.errors[0]?.message || 'Unknown error'}` }, { status: 400 });
    }

    if (updateJson.data?.themeFileUpdate?.userErrors?.length > 0) {
      console.error('❌ Theme update user errors:', updateJson.data.themeFileUpdate.userErrors);
      return json({ error: `Theme update error: ${updateJson.data.themeFileUpdate.userErrors[0]?.message || 'Unknown error'}` }, { status: 400 });
    }

    const updatedFiles = updateJson.data?.themeFileUpdate?.updatedThemeFiles || [];
    console.log('✅ Template updated successfully with app block:', {
      updatedFiles: updatedFiles.map(f => f.filename),
      templateFilename,
      blockId,
      appExtensionId
    });
    
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

