import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const { templateSuffix, excludeProductId } = await request.json();

    if (!templateSuffix || typeof templateSuffix !== "string") {
      return json(
        {
          success: false,
          error: "Missing or invalid templateSuffix.",
        },
        { status: 400 }
      );
    }

    // Query products to find which ones have this template suffix
    const productsRes = await admin.graphql(`
      query {
        products(first: 250) {
          nodes {
            id
            handle
            title
            templateSuffix
          }
        }
      }
    `);
    
    const productsJson = await productsRes.json();
    const products = productsJson.data?.products?.nodes || [];

    // Find products with matching template suffix (excluding our product)
    const conflictingProducts = products.filter(
      p => p.templateSuffix === templateSuffix && 
           p.id !== excludeProductId
    );

    console.log('🔍 Template conflict check:', {
      templateSuffix,
      excludeProductId,
      totalProducts: products.length,
      conflictingProducts: conflictingProducts.map(p => ({
        id: p.id,
        handle: p.handle,
        title: p.title
      }))
    });

    return json({
      success: true,
      hasConflicts: conflictingProducts.length > 0,
      conflictingProducts: conflictingProducts.map(p => ({
        id: p.id,
        handle: p.handle,
        title: p.title,
        templateSuffix: p.templateSuffix
      }))
    });
  } catch (error) {
    console.error("Unexpected error checking template conflicts:", error);
    return json(
      {
        success: false,
        error: error.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
};
