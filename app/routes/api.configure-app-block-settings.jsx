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

    // Retry logic - Use GraphQL instead of REST for consistency
    let fileContent;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📖 Attempt ${attempts}/${maxAttempts} to read template via GraphQL`);
      
      try {
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
              themeId: themeId, // Use the full GID
              filename: assetKey 
            } 
          }
        );

        const fileJson = await fileRes.json();
        console.log(`📋 GraphQL response (attempt ${attempts}):`, {
          hasData: !!fileJson.data,
          hasTheme: !!fileJson.data?.theme,
          filesCount: fileJson.data?.theme?.files?.nodes?.length || 0,
          errors: fileJson.errors
        });

        if (fileJson.errors) {
          console.error('⚠️ GraphQL errors:', fileJson.errors);
        } else if (fileJson.data?.theme?.files?.nodes?.length > 0) {
          const fileNode = fileJson.data.theme.files.nodes[0];
          fileContent = fileNode?.body?.content;
          
          if (fileContent) {
            console.log('✅ Template file found via GraphQL!');
            break;
          } else {
            console.log('⚠️ File found but has no content');
          }
        } else {
          console.log('⚠️ File not found in theme');
        }
      } catch (error) {
        console.log(`⚠️ Attempt ${attempts} failed:`, error.message);
      }

      if (attempts < maxAttempts) {
        console.log('⏳ Waiting 2 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!fileContent) {
      console.error('❌ Failed to read template file after all retries');
      return json({ 
        error: "Failed to read template file after multiple attempts",
        assetKey,
        themeId,
        attempts
      }, { status: 500 });
    }

    console.log('✅ Template file read successfully via GraphQL');

    // Step 2: Parse the JSON
    let templateData;
    try {
      templateData = JSON.parse(fileContent);
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

    // Step 5: Write the updated JSON back to the theme using GraphQL
    const updatedJson = JSON.stringify(templateData, null, 2);
    
    console.log(`💾 Writing updated template back to ${assetKey} via GraphQL`);

    const upsertMutation = `
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

    const upsertVariables = {
      themeId: themeId,
      files: [
        {
          filename: assetKey,
          body: {
            type: "TEXT",
            value: updatedJson
          }
        }
      ]
    };

    const upsertResponse = await admin.graphql(upsertMutation, {
      variables: upsertVariables
    });

    const upsertJson = await upsertResponse.json();
    console.log('📋 GraphQL upsert response:', {
      hasData: !!upsertJson.data,
      upsertedFiles: upsertJson.data?.themeFilesUpsert?.upsertedThemeFiles?.length || 0,
      errors: upsertJson.errors,
      userErrors: upsertJson.data?.themeFilesUpsert?.userErrors
    });

    if (upsertJson.errors) {
      console.error('❌ GraphQL upsert errors:', upsertJson.errors);
      return json({ error: `GraphQL error: ${upsertJson.errors[0]?.message}` }, { status: 500 });
    }

    if (upsertJson.data?.themeFilesUpsert?.userErrors?.length > 0) {
      console.error('❌ Theme upsert user errors:', upsertJson.data.themeFilesUpsert.userErrors);
      return json({ error: `Theme upsert error: ${upsertJson.data.themeFilesUpsert.userErrors[0]?.message}` }, { status: 500 });
    }

    if (!upsertJson.data?.themeFilesUpsert?.upsertedThemeFiles?.length) {
      console.error('❌ No files were upserted');
      return json({ error: "Failed to update template file" }, { status: 500 });
    }

    console.log('✅ Template updated successfully via GraphQL!');

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

