import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

/**
 * API endpoint to check if a widget block already exists in a template.
 * This prevents duplicate blocks from being added when reopening the theme editor.
 */
export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.json();
    
    const {
      templateFilename,
      themeId,
      blockId, // e.g., "simple-text-badge"
      appExtensionId // API key
    } = body;

    if (!templateFilename || !themeId || !blockId || !appExtensionId) {
      return json({ 
        error: 'Missing required parameters: templateFilename, themeId, blockId, appExtensionId',
        exists: false
      }, { status: 400 });
    }

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
        exists: false,
        error: `Template file '${templateFilename}' not found or empty`
      });
    }

    // Parse JSON template
    const stripJsonComments = (str) => {
      let result = '';
      let inString = false;
      let escapeNext = false;
      let inComment = false;
      let commentType = null;
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
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          result += char;
          i++;
          continue;
        }
        
        if (!inString) {
          if (char === '/' && nextChar === '/') {
            inComment = true;
            commentType = '//';
            i += 2;
            continue;
          }
          
          if (char === '/' && nextChar === '*') {
            inComment = true;
            commentType = '/*';
            i += 2;
            continue;
          }
          
          if (inComment && commentType === '//') {
            if (char === '\n' || char === '\r') {
              inComment = false;
              commentType = null;
              result += char;
            }
            i++;
            continue;
          }
          
          if (inComment && commentType === '/*') {
            if (char === '*' && nextChar === '/') {
              inComment = false;
              commentType = null;
              i += 2;
              continue;
            }
            i++;
            continue;
          }
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
        exists: false,
        error: `Failed to parse JSON template: ${parseError.message}`
      });
    }

    // Find the main section
    const sections = templateJson.sections || {};
    const mainSectionKey = Object.keys(sections).find(key => 
      sections[key].type === 'main-product' || 
      sections[key].type?.includes('product')
    ) || Object.keys(sections)[0];

    if (!mainSectionKey) {
      return json({ 
        exists: false,
        error: 'Could not find main section in template'
      });
    }

    const mainSection = sections[mainSectionKey];
    const blocks = mainSection.blocks || {};

    // Check if an app block of this type already exists
    // Look for blocks with type containing the block handle or shopify://apps format
    const blockExists = Object.values(blocks).some(block => 
      typeof block === 'object' && 
      block.type && 
      (block.type.includes(blockId) || 
       block.type.includes(`blocks/${blockId}`) ||
       block.type.includes(`shopify://apps/${appExtensionId}/blocks/${blockId}`))
    );

    return json({ 
      exists: blockExists
    });

  } catch (error) {
    console.error('❌ Error in checkWidgetExists:', error);
    return json({ 
      exists: false,
      error: `Server error: ${error.message}` 
    }, { status: 500 });
  }
};

