import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    console.log('🎨 Fetching theme ID via API route...');

    // Get the active theme ID using GraphQL
    const response = await admin.graphql(`
      query GetActiveTheme {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
            name
            role
          }
        }
      }
    `);

    const data = await response.json();
    console.log('🎨 Theme API response:', data);

    if (data.data?.themes?.nodes?.[0]) {
      const activeTheme = data.data.themes.nodes[0];
      const themeId = activeTheme.id.replace('gid://shopify/OnlineStoreTheme/', '');
      
      console.log('✅ Theme ID extracted:', {
        originalId: activeTheme.id,
        extractedId: themeId,
        name: activeTheme.name,
        role: activeTheme.role
      });

      return new Response(JSON.stringify({
        success: true,
        themeId: themeId,
        themeName: activeTheme.name,
        themeRole: activeTheme.role
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    } else {
      console.error('❌ No active theme found');
      return new Response(JSON.stringify({
        success: false,
        error: 'No active theme found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('❌ Error fetching theme ID:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
