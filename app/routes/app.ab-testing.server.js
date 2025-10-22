import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Get shop info
  const shopRes = await admin.graphql(`query { shop { myshopifyDomain } }`);
  const shopJson = await shopRes.json();
  const shopDomain = shopJson.data.shop.myshopifyDomain;

  // Get main theme
  const themeRes = await admin.graphql(`query { themes(first: 5) { nodes { id name role } } }`);
  const themeJson = await themeRes.json();
  const mainTheme = themeJson.data.themes.nodes.find(t => t.role === "MAIN");
  if (!mainTheme) throw new Error("No main theme found");
  const themeId = mainTheme.id.replace("gid://shopify/OnlineStoreTheme/", "");
  const themeGid = mainTheme.id; // Keep the full GID for GraphQL queries

  // Get product templates
  const restRes = await fetch(
    `https://${shopDomain}/admin/api/2024-01/themes/${themeId}/assets.json`,
    {
      headers: {
        "X-Shopify-Access-Token": session.accessToken,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    }
  );
  const restJson = await restRes.json();
  const assets = restJson.assets || [];
  const productTemplates = assets
    .map(a => a.key)
    .filter(key =>
      (key.startsWith("templates/product") && (key.endsWith(".liquid") || key.endsWith(".json"))) ||
      (key === "templates/product.liquid" || key === "templates/product.json")
    );

  // Get products
  const productsRes = await admin.graphql(`
    query {
      products(first: 50) {
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
  const products = productsJson.data.products.nodes;

  return json({ shopDomain, themeId, themeGid, productTemplates, products });
};

export const action = async ({ request }) => {
  const form = await request.formData();
  const actionType = form.get("actionType");

  if (actionType === "getProductForTemplate") {
    const { session, admin } = await authenticate.admin(request);
    const template = form.get("template");
    
    // Handle both suffixed templates and default product template
    let templateSuffix = null;
    
    if (template === "templates/product.liquid" || template === "templates/product.json") {
      // Default product template - no suffix
      templateSuffix = null;
    } else {
      // Extract template suffix from template filename
      const match = template.match(/^templates\/product\.([^.]+)\.(liquid|json)$/);
      if (!match) return json({ error: "Invalid template selected" }, { status: 400 });
      templateSuffix = match[1];
    }

    // Query all products to find which one has this template suffix
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
    const products = productsJson.data.products.nodes;

    // Find product with matching template suffix
    const matchingProduct = products.find(p => p.templateSuffix === templateSuffix);
    
    if (matchingProduct) {
      return json({ 
        success: true, 
        productHandle: matchingProduct.handle,
        productTitle: matchingProduct.title 
      });
    } else {
      // If no product has this template suffix, return the first product as fallback
      return json({ 
        success: true, 
        productHandle: products[0]?.handle || "example-product",
        productTitle: products[0]?.title || "Example Product",
        fallback: true
      });
    }
  }

  if (actionType === "duplicateTemplate") {
    try {
      // Duplicate template logic from set-variant-a.server.js
      const { session, admin } = await authenticate.admin(request);
      const template = form.get("template");
      const newName = form.get("newName");
      const themeId = form.get("themeId");
      const shop = session.shop;
      const accessToken = session.accessToken;

      console.log("Duplicate template request:", { template, newName, themeId, shop });

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
      console.log("GraphQL response:", JSON.stringify(fileJson, null, 2));
      
      if (fileJson.errors) {
        console.error("GraphQL errors:", fileJson.errors);
        return json({ error: `GraphQL error: ${fileJson.errors[0]?.message}` }, { status: 400 });
      }
      
      const fileNode = fileJson.data.theme.files.nodes[0];
      const content = fileNode?.body?.content;
      
      if (!content) {
        console.error("No content found in file node:", fileNode);
        return json({ error: "Could not read template content" }, { status: 400 });
      }

      // 2. Create new template file using GraphQL themeFilesCopy mutation
      const ext = template.endsWith(".json") ? ".json" : ".liquid";
      const newFilename = `templates/product.${newName}${ext}`;

      console.log("Creating new template:", newFilename);

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

      console.log("GraphQL copy mutation variables:", JSON.stringify(copyVariables, null, 2));

      const copyResponse = await admin.graphql(copyMutation, {
        variables: copyVariables
      });

      const copyJson = await copyResponse.json();
      console.log("GraphQL copy response:", JSON.stringify(copyJson, null, 2));

      if (copyJson.errors) {
        console.error("GraphQL copy errors:", copyJson.errors);
        return json({ error: `GraphQL copy error: ${copyJson.errors[0]?.message || 'Unknown error'}` }, { status: 400 });
      }

      if (copyJson.data?.themeFilesCopy?.userErrors?.length > 0) {
        console.error("Theme copy user errors:", copyJson.data.themeFilesCopy.userErrors);
        return json({ error: `Theme copy error: ${copyJson.data.themeFilesCopy.userErrors[0]?.message || 'Unknown error'}` }, { status: 400 });
      }

      if (!copyJson.data?.themeFilesCopy?.copiedThemeFiles?.length) {
        return json({ error: "No files were copied" }, { status: 400 });
      }
      
      return json({ success: true, newFilename });
    } catch (error) {
      console.error("Error in duplicateTemplate:", error);
      return json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
  }

  // Existing A/B test creation logic
  const shop = form.get("shop");
  const testName = form.get("testName");
  let productId = form.get("productId");

  // Validate test name
  if (!testName || testName.trim() === "") {
    return json({ error: "Test name is required" }, { status: 400 });
  }

  // Check if test name already exists
  const existingTest = await prisma.aBTest.findUnique({
    where: { name: testName.trim() }
  });

  if (existingTest) {
    return json({ error: "A test with this name already exists. Please choose a different name." }, { status: 400 });
  }

  // If no productId provided, use the first product as fallback
  if (!productId) {
    const { session, admin } = await authenticate.admin(request);
    const productsRes = await admin.graphql(`
      query {
        products(first: 1) {
          nodes {
            id
          }
        }
      }
    `);
    const productsJson = await productsRes.json();
    productId = productsJson.data.products.nodes[0]?.id;
    if (!productId) {
      return json({ error: "No products found" }, { status: 400 });
    }
  }

  // If productId is a global ID, extract the numeric part
  if (typeof productId === "string" && productId.startsWith("gid://")) {
    const match = productId.match(/Product\/(\d+)/);
    if (match) productId = match[1];
  }

  // Extract template suffixes
  function getTemplateSuffix(template) {
    // Handle default product template (no suffix)
    if (template === "templates/product.liquid" || template === "templates/product.json") {
      return "default"; // Use "default" as the suffix for the default template
    }
    // Handle suffixed templates
    const match = template.match(/product\.([^.]+)\.(json|liquid)$/);
    return match ? match[1] : "";
  }

  const templateA = getTemplateSuffix(form.get("templateA"));
  const templateB = getTemplateSuffix(form.get("templateB"));
  const trafficSplit = parseInt(form.get("trafficSplit"), 10);

  // Validate that we have valid template suffixes
  if (!templateA) {
    return json({ error: "Invalid Template A selected" }, { status: 400 });
  }
  if (!templateB) {
    return json({ error: "Invalid Template B selected" }, { status: 400 });
  }

  const abTest = await prisma.aBTest.create({
    data: {
      shop,
      name: testName.trim(),
      productId,
      templateA,
      templateB,
      trafficSplit,
    },
  });

  return json({ success: true, abTest });
};
