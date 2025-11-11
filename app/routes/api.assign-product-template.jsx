import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const { productId, templateSuffix } = await request.json();

    if (!productId || (templateSuffix !== null && typeof templateSuffix !== "string")) {
      return json(
        {
          success: false,
          error: "Missing productId or templateSuffix.",
        },
        { status: 400 }
      );
    }

    const mutation = `
      mutation assignTemplate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            templateSuffix
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: productId,
        templateSuffix: templateSuffix === null ? null : templateSuffix,
      },
    };

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.errors?.length) {
      console.error("GraphQL errors assigning product template:", result.errors);
      return json(
        {
          success: false,
          error: result.errors[0]?.message || "GraphQL error while assigning template.",
        },
        { status: 500 }
      );
    }

    const userErrors = result.data?.productUpdate?.userErrors || [];
    if (userErrors.length > 0) {
      console.error("User errors assigning product template:", userErrors);
      return json(
        {
          success: false,
          error: userErrors[0]?.message || "Shopify returned a user error while assigning template.",
        },
        { status: 400 }
      );
    }

    return json({
      success: true,
      product: result.data?.productUpdate?.product,
    });
  } catch (error) {
    console.error("Unexpected error assigning product template:", error);
    return json(
      {
        success: false,
        error: error.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
};

