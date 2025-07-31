import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useOutletContext } from "@remix-run/react";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    console.log("🔍 Loader called for A/B tests page");
    const { session, admin } = await authenticate.admin(request);

    // Get shop info
    console.log("🔍 Fetching shop info");
    const shopRes = await admin.graphql(`query { shop { myshopifyDomain } }`);
    const shopJson = await shopRes.json();
    const shopDomain = shopJson.data.shop.myshopifyDomain;
    console.log("✅ Shop domain:", shopDomain);

    // Get main theme
    console.log("🔍 Fetching theme info");
    const themeRes = await admin.graphql(`query { themes(first: 5) { nodes { id name role } } }`);
    const themeJson = await themeRes.json();
    const mainTheme = themeJson.data.themes.nodes.find(t => t.role === "MAIN");
    if (!mainTheme) throw new Error("No main theme found");
    const themeId = mainTheme.id.replace("gid://shopify/OnlineStoreTheme/", "");
    const themeGid = mainTheme.id; // Keep the full GID for GraphQL queries
    console.log("✅ Theme ID:", themeId);

    // Get product templates
    console.log("🔍 Fetching product templates");
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
    console.log("✅ Product templates found:", productTemplates.length);

    // Get products
    console.log("🔍 Fetching products");
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
    console.log("✅ Products found:", products.length);

    const result = { shopDomain, themeId, themeGid, productTemplates, products };
    console.log("✅ Loader completed successfully");
    return json(result);
  } catch (error) {
    console.error("❌ Error in loader:", error);
    throw error;
  }
};

export const action = async ({ request }) => {
  try {
    const form = await request.formData();
    const actionType = form.get("actionType");

    console.log("🔍 Action called with actionType:", actionType);

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

    console.log("🔍 Creating A/B test with data:", {
      shop,
      testName,
      productId,
      templateA: form.get("templateA"),
      templateB: form.get("templateB"),
      trafficSplit: form.get("trafficSplit")
    });

    // Validate test name
    if (!testName || testName.trim() === "") {
      console.log("❌ Test name validation failed");
      return json({ error: "Test name is required" }, { status: 400 });
    }

    // Check if test name already exists
    console.log("🔍 Checking for existing test with name:", testName.trim());
    const existingTest = await prisma.aBTest.findUnique({
      where: { name: testName.trim() }
    });

    if (existingTest) {
      console.log("❌ Test name already exists");
      return json({ error: "A test with this name already exists. Please choose a different name." }, { status: 400 });
    }

    // If no productId provided, use the first product as fallback
    if (!productId) {
      console.log("🔍 No productId provided, fetching first product");
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
        console.log("❌ No products found");
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

    console.log("🔍 Processed template data:", { templateA, templateB, trafficSplit });

    // Validate that we have valid template suffixes
    if (!templateA) {
      console.log("❌ Invalid Template A selected");
      return json({ error: "Invalid Template A selected" }, { status: 400 });
    }
    if (!templateB) {
      console.log("❌ Invalid Template B selected");
      return json({ error: "Invalid Template B selected" }, { status: 400 });
    }

    // First, ensure the shop exists in our database
    console.log("🔍 Checking if shop exists in database:", shop);
    let shopRecord = await prisma.shop.findUnique({
      where: { shop }
    });

    if (!shopRecord) {
      console.log("🔍 Shop not found, creating new shop record");
      // Create shop record if it doesn't exist
      const { session } = await authenticate.admin(request);
      shopRecord = await prisma.shop.create({
        data: {
          shop,
          accessToken: session.accessToken,
          scope: session.scope || '',
          isActive: true,
          installedAt: new Date(),
          settings: {},
          metadata: {}
        }
      });
      console.log("✅ Shop record created:", shopRecord.id);
    } else {
      console.log("✅ Shop record found:", shopRecord.id);
    }

    // Now create the A/B test
    console.log("🔍 Creating A/B test record...");
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
    console.log("✅ A/B test created successfully:", abTest.id);

    return json({ 
      success: true, 
      abTest: {
        id: abTest.id,
        name: abTest.name,
        shop: abTest.shop,
        productId: abTest.productId,
        templateA: abTest.templateA,
        templateB: abTest.templateB,
        trafficSplit: abTest.trafficSplit,
        status: abTest.status,
        startDate: abTest.startDate
      }
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in action:", error);
    return json({ 
      error: `Server error: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
};

export default function ABTesting() {
  const { shopDomain, themeId, themeGid, productTemplates, products } = useLoaderData();
  const actionData = useActionData();
  const { user } = useOutletContext();
  
  const [templateA, setTemplateA] = useState(productTemplates[0] || "");
  const [templateB, setTemplateB] = useState("");
  const [trafficSplit, setTrafficSplit] = useState("50");
  const [testName, setTestName] = useState("");
  const [error, setError] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [successMessage, setSuccessMessage] = useState(null);

  // Template preview state
  const [selectedTemplate, setSelectedTemplate] = useState(productTemplates[0] || "");
  const [duplicateTemplateName, setDuplicateTemplateName] = useState("");
  const [previewError, setPreviewError] = useState(null);
  const [associatedProduct, setAssociatedProduct] = useState(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Automatically infer product handle from first product or use default (fallback)
  const inferredProductHandle = products[0]?.handle || "example-product";

  const templateOptions = productTemplates.map(f => ({ label: f, value: f }));
  const productOptions = products.map(p => ({ label: p.title, value: p.id }));

  // Reset Template B if templates list changes and B is not in the list
  useEffect(() => {
    if (templateB && !productTemplates.includes(templateB)) {
      setTemplateB("");
    }
  }, [productTemplates, templateB]);

  // When template selection changes, fetch the associated product
  useEffect(() => {
    if (selectedTemplate) {
      setIsLoadingProduct(true);
      setAssociatedProduct(null);
      
      const formData = new FormData();
      formData.append("actionType", "getProductForTemplate");
      formData.append("template", selectedTemplate);
      
      fetch("/app/ab-tests", {
        method: "POST",
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setAssociatedProduct({
            handle: data.productHandle,
            title: data.productTitle,
            isFallback: data.fallback || false
          });
        }
        setIsLoadingProduct(false);
      })
      .catch(error => {
        console.error("Error fetching associated product:", error);
        setIsLoadingProduct(false);
      });
    }
  }, [selectedTemplate]);

  // Handler for OK button (create duplicate template and open in theme editor)
  const handleOk = async () => {
    if (!duplicateTemplateName.trim()) {
      setPreviewError("Please enter a name for the duplicate template");
      return;
    }

    setIsCreatingTemplate(true);
    setPreviewError(null);

    try {
      // Create duplicate template
      const formData = new FormData();
      formData.append("actionType", "duplicateTemplate");
      formData.append("template", selectedTemplate);
      formData.append("newName", duplicateTemplateName.trim());
      formData.append("themeId", themeGid);

      const response = await fetch("/app/ab-tests", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Open the duplicated template in theme editor
        const productHandle = associatedProduct?.handle || inferredProductHandle;
        const previewPath = `/products/${productHandle}?view=${duplicateTemplateName.trim()}`;
        
        const shopShort = shopDomain.replace('.myshopify.com', '');
        const themeIdNum = themeId.replace('gid://shopify/Theme/', '');
        const url = `https://admin.shopify.com/store/${shopShort}/themes/${themeIdNum}/editor?previewPath=${encodeURIComponent(previewPath)}`;
        window.open(url, "_blank");
      } else {
        setPreviewError(data.error || "Failed to create duplicate template");
      }
    } catch (error) {
      console.error("Error creating duplicate template:", error);
      setPreviewError("Failed to create duplicate template");
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Client-side validation
    if (!testName.trim()) {
      setError("Test name is required");
      return;
    }

    if (!templateA) {
      setError("Please select Template A");
      return;
    }

    if (!templateB) {
      setError("Please select Template B (Second Variant)");
      return;
    }

    if (templateA === templateB) {
      setError("Template A and Template B must be different");
      return;
    }

    console.log("🔍 Submitting A/B test form with data:", {
      shop: shopDomain,
      testName,
      productId: selectedProductId,
      templateA,
      templateB,
      trafficSplit
    });

    const formData = new FormData();
    formData.append("shop", shopDomain);
    formData.append("testName", testName);
    formData.append("productId", selectedProductId);
    formData.append("templateA", templateA);
    formData.append("templateB", templateB);
    formData.append("trafficSplit", trafficSplit);

    try {
      console.log("🔍 Sending POST request to /app/ab-tests");
      const response = await fetch("/app/ab-tests", {
        method: "POST",
        body: formData
      });

      console.log("🔍 Response status:", response.status);
      console.log("🔍 Response headers:", Object.fromEntries(response.headers.entries()));

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Response is not JSON, likely an HTML error page
        const text = await response.text();
        console.error("❌ Server returned non-JSON response:", text.substring(0, 500));
        setError("Server error: Received HTML instead of JSON response. Check server logs.");
        return;
      }

      const data = await response.json();
      console.log("🔍 Response data:", data);

      if (data.success) {
        console.log("✅ A/B test created successfully");
        // Show success message
        setError(null);
        // Reset form on success
        setTestName("");
        setTemplateA(productTemplates[0] || "");
        setTemplateB("");
        setTrafficSplit("50");
        setSelectedProductId(products[0]?.id || "");
        
        // Show success message in the UI
        const successMessage = `✅ A/B test "${data.abTest.name}" created successfully!`;
        setSuccessMessage(successMessage); // Use successMessage state for success
        setTimeout(() => setSuccessMessage(null), 5000); // Clear after 5 seconds
      } else {
        console.log("❌ A/B test creation failed:", data.error);
        setError(data.error || "Failed to create A/B test");
      }
    } catch (error) {
      console.error("❌ Error creating A/B test:", error);
      setError(`Failed to create A/B test: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 0%, #ec4899 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>🧪 Create A/B Test</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>Set up experiments to optimize your product pages</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Create Duplicate Template */}
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '24px' }}>
            📝 Create Duplicate Template
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Base Product Template */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Base Product Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white'
                }}
              >
                {templateOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Select the template you want to duplicate
              </p>
            </div>

            {/* Duplicate Template Name */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Duplicate Template Name
              </label>
              <input
                type="text"
                value={duplicateTemplateName}
                onChange={(e) => setDuplicateTemplateName(e.target.value)}
                placeholder="e.g., variant-a, hero-version, etc."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Enter a unique name for your duplicate template (no spaces, use hyphens)
              </p>
            </div>

            {/* Status Messages */}
            {isLoadingProduct && (
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                color: '#1e40af'
              }}>
                🔍 Finding associated product...
              </div>
            )}

            {associatedProduct && (
              <div style={{
                padding: '12px',
                background: associatedProduct.isFallback 
                  ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                  : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                border: associatedProduct.isFallback ? '1px solid #fcd34d' : '1px solid #6ee7b7',
                borderRadius: '8px',
                color: associatedProduct.isFallback ? '#92400e' : '#065f46'
              }}>
                {associatedProduct.isFallback 
                  ? `⚠️ No specific product found for this template. Will use "${associatedProduct.title}" as fallback.`
                  : `✅ Associated Product: ${associatedProduct.title} (${associatedProduct.handle})`
                }
              </div>
            )}

            {previewError && (
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                border: '1px solid #f87171',
                borderRadius: '8px',
                color: '#991b1b'
              }}>
                ❌ {previewError}
              </div>
            )}

            <button
              onClick={handleOk}
              disabled={!selectedTemplate || !duplicateTemplateName.trim() || isCreatingTemplate}
              style={{
                padding: '12px 24px',
                background: isCreatingTemplate || !selectedTemplate || !duplicateTemplateName.trim()
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: isCreatingTemplate || !selectedTemplate || !duplicateTemplateName.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {isCreatingTemplate ? "Creating Template..." : "Create & Open in Theme Editor"}
            </button>
          </div>
        </div>

        {/* Create A/B Test */}
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            🧪 Create A/B Test
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
            Select two different templates to compare their performance. Both templates are required.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="hidden" name="shop" value={shopDomain} />

            {/* Test Name */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Test Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                name="testName"
                placeholder="Enter a unique name for this A/B test"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Enter a unique name for this A/B test
              </p>
            </div>

            {/* Product */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                name="productId"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white'
                }}
              >
                {productOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Select the product to run the A/B test on
              </p>
            </div>

            {/* Template A */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Template A (First Variant) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={templateA}
                onChange={(e) => setTemplateA(e.target.value)}
                name="templateA"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white'
                }}
              >
                <option value="">Select Template A</option>
                {templateOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {/* Template B */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Template B (Second Variant) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={templateB}
                onChange={(e) => setTemplateB(e.target.value)}
                name="templateB"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: templateB ? '1px solid #d1d5db' : '1px solid #ef4444',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white'
                }}
              >
                <option value="">Select Template B</option>
                {templateOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {!templateB && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                  Template B is required for A/B testing
                </p>
              )}
            </div>

            {/* Traffic Split */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Traffic Split (A %)
              </label>
              <input
                type="number"
                value={trafficSplit}
                onChange={(e) => setTrafficSplit(e.target.value)}
                name="trafficSplit"
                min="1"
                max="99"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Error Messages */}
            {error && (
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                border: '1px solid #f87171',
                borderRadius: '8px',
                color: '#991b1b'
              }}>
                ❌ {error}
              </div>
            )}

            {successMessage && (
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                border: '1px solid #6ee7b7',
                borderRadius: '8px',
                color: '#065f46'
              }}>
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Create A/B Test
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 