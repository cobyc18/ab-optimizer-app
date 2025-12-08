import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const { productId, expectedTemplateSuffix } = await request.json();

    if (!productId) {
      return json(
        {
          success: false,
          error: "Missing productId.",
        },
        { status: 400 }
      );
    }

    // Query the product to get its current templateSuffix
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          templateSuffix
        }
      }
    `;

    const variables = {
      id: productId,
    };

    const response = await admin.graphql(query, { variables });
    const result = await response.json();

    if (result.errors?.length) {
      console.error("GraphQL errors querying product:", result.errors);
      return json(
        {
          success: false,
          error: result.errors[0]?.message || "GraphQL error while querying product.",
        },
        { status: 500 }
      );
    }

    const product = result.data?.product;
    if (!product) {
      return json(
        {
          success: false,
          error: "Product not found.",
        },
        { status: 404 }
      );
    }

    const actualTemplateSuffix = product.templateSuffix;
    const matches = actualTemplateSuffix === expectedTemplateSuffix;

    return json({
      success: true,
      matches,
      actualTemplateSuffix,
      expectedTemplateSuffix,
    });
  } catch (error) {
    console.error("Unexpected error verifying product template:", error);
    return json(
      {
        success: false,
        error: error.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
};

