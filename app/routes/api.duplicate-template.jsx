import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const { template, newName, themeId, productHandle } = await request.json();

    console.log('🔧 Duplicate template request:', { template, newName, themeId, productHandle });

    // 1. Get the file content (GraphQL)
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
          filename: template 
        } 
      }
    );
    
    const fileJson = await fileRes.json();
    console.log('GraphQL response:', JSON.stringify(fileJson, null, 2));
    
    if (fileJson.errors) {
      console.error('GraphQL errors:', fileJson.errors);
      return json({ error: `GraphQL error: ${fileJson.errors[0]?.message}` }, { status: 400 });
    }
    
    const fileNode = fileJson.data.theme.files.nodes[0];
    const content = fileNode?.body?.content;
    
    if (!content) {
      console.error('No content found in file node:', fileNode);
      return json({ error: "Could not read template content" }, { status: 400 });
    }

    // 2. Create new template file using GraphQL themeFilesCopy mutation
    const ext = template.endsWith(".json") ? ".json" : ".liquid";
    const newFilename = `templates/product.${newName}${ext}`;

    console.log('Creating new template:', newFilename);

    // Use GraphQL themeFilesCopy mutation for proper file duplication
    const copyMutation = `
      mutation themeFilesCopy($themeId: ID!, $files: [ThemeFilesCopyFileInput!]!) {
        themeFilesCopy(themeId: $themeId, files: $files) {
          copiedThemeFiles {
            filename
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const copyVariables = {
      themeId: themeId,
      files: [
        {
          srcFilename: template,
          dstFilename: newFilename
        }
      ]
    };

    console.log('GraphQL copy mutation variables:', JSON.stringify(copyVariables, null, 2));

    const copyResponse = await admin.graphql(copyMutation, {
      variables: copyVariables
    });

    const copyJson = await copyResponse.json();
    console.log('GraphQL copy response:', JSON.stringify(copyJson, null, 2));

    if (copyJson.errors) {
      console.error('GraphQL copy errors:', copyJson.errors);
      return json({ error: `GraphQL copy error: ${copyJson.errors[0]?.message || 'Unknown error'}` }, { status: 400 });
    }

    if (copyJson.data?.themeFilesCopy?.userErrors?.length > 0) {
      console.error('Theme copy user errors:', copyJson.data.themeFilesCopy.userErrors);
      return json({ error: `Theme copy error: ${copyJson.data.themeFilesCopy.userErrors[0]?.message || 'Unknown error'}` }, { status: 400 });
    }

    if (!copyJson.data?.themeFilesCopy?.copiedThemeFiles?.length) {
      return json({ error: "No files were copied" }, { status: 400 });
    }
    
    return json({ success: true, newFilename });
  } catch (error) {
    console.error('Error in duplicateTemplate:', error);
    return json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
};
