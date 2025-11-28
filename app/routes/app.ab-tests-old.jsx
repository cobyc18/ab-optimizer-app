import { json } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
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
    console.error("❌ Error in ab-tests loader:", error);
    throw error;
  }
};

export const action = async ({ request }) => {
  try {
    const form = await request.formData();
    const actionType = form.get("actionType");

    console.log("🔍 Action called with actionType:", actionType);

    // Handle checkProductAvailability first
    if (actionType === "checkProductAvailability") {
      try {
        const productId = form.get("productId");
        
        console.log("🔍 Checking product availability for productId:", productId);
        
        if (!productId) {
          return json({ error: "Product ID is required" }, { status: 400 });
        }

        // Extract numeric ID from Shopify GID
        const numericProductId = productId.replace("gid://shopify/Product/", "");
        console.log("🔍 Extracted numeric product ID:", numericProductId);

        // Check if product is already part of a running test
        console.log("🔍 Querying database for running tests with productId:", numericProductId);
        const existingRunningTest = await prisma.aBTest.findFirst({
          where: { 
            productId: numericProductId,
            status: "running"
          }
        });

        console.log("🔍 Database query result:", existingRunningTest);

        // Also check all tests for this product to debug
        const allTestsForProduct = await prisma.aBTest.findMany({
          where: { 
            productId: numericProductId
          }
        });
        console.log("🔍 All tests for this product:", allTestsForProduct);

        if (existingRunningTest) {
          console.log("❌ Found existing running test:", existingRunningTest.name);
          return json({ 
            error: `This product is already part of a running test called "${existingRunningTest.name}". Please select a different product.` 
          }, { status: 400 });
        }

        console.log("✅ Product is available for testing");
        const response = { success: true, message: "Product is available for testing" };
        console.log("🔍 Sending response:", response);
        return json(response);
      } catch (error) {
        console.error("❌ Error in checkProductAvailability:", error);
        return json({ error: "Database error occurred. Please try again." }, { status: 500 });
      }
    }

    // Handle other action types...
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

    // Get end result configuration
    const endResultType = form.get("endResultType");
    const endDate = form.get("endDate");
    const impressionThreshold = form.get("impressionThreshold");
    const conversionThreshold = form.get("conversionThreshold");

    console.log("🔍 Creating A/B test with data:", {
      shop,
      testName,
      productId,
      templateA: form.get("templateA"),
      templateB: form.get("templateB"),
      trafficSplit: form.get("trafficSplit"),
      endResultType,
      endDate,
      impressionThreshold,
      conversionThreshold
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

    // Check if product is already part of a running test
    console.log("🔍 Checking if product is already part of a running test:", productId);
    
    // Extract numeric ID from Shopify GID for database query
    let numericProductId = productId;
    if (typeof productId === "string" && productId.startsWith("gid://")) {
      const match = productId.match(/Product\/(\d+)/);
      if (match) numericProductId = match[1];
    }
    console.log("🔍 Using numeric product ID for database query:", numericProductId);
    
    const existingRunningTest = await prisma.aBTest.findFirst({
      where: { 
        productId: numericProductId,
        status: "running"
      }
    });

    if (existingRunningTest) {
      console.log("❌ Product is already part of a running test");
      return json({ 
        error: `This product is already part of a running test called "${existingRunningTest.name}". Please select a different product or wait for the current test to complete.` 
      }, { status: 400 });
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
    
    // Prepare end result data based on type
    const endResultData = {
      endResultType,
      endDate: endResultType === "date" && endDate ? new Date(endDate) : null,
      impressionThreshold: endResultType === "impressions" && impressionThreshold ? parseInt(impressionThreshold, 10) : null,
      conversionThreshold: endResultType === "conversions" && conversionThreshold ? parseInt(conversionThreshold, 10) : null,
      winner: null // No winner initially
    };

    const abTest = await prisma.aBTest.create({
      data: {
        shop,
        name: testName.trim(),
        productId,
        templateA,
        templateB,
        trafficSplit,
        ...endResultData
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
  
  // Form state with proper defaults
  const [templateA, setTemplateA] = useState("");
  const [templateB, setTemplateB] = useState("");
  const [trafficSplit, setTrafficSplit] = useState("50");
  const [testName, setTestName] = useState("");
  const [error, setError] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [successMessage, setSuccessMessage] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // End result options state
  const [endResultType, setEndResultType] = useState("manual");
  const [endDate, setEndDate] = useState("");
  const [impressionThreshold, setImpressionThreshold] = useState("1000");
  const [conversionThreshold, setConversionThreshold] = useState("100");

  // Product validation state
  const [isCheckingProduct, setIsCheckingProduct] = useState(false);
  const [productValidationError, setProductValidationError] = useState(null);

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

  // Function to reset form fields
  const resetForm = () => {
    setTestName("");
    setTemplateA("");
    setTemplateB("");
    setTrafficSplit("50");
    setSelectedProductId("");
    setEndResultType("manual");
    setEndDate("");
    setImpressionThreshold("1000");
    setConversionThreshold("100");
    setError(null);
    setSuccessMessage(null);
    setValidationErrors({});
    setProductValidationError(null);
  };

  // Function to validate form
  const validateForm = () => {
    const errors = {};

    if (!testName.trim()) {
      errors.testName = "Test name is required";
    }

    if (!selectedProductId) {
      errors.product = "Please select a product";
    }

    if (productValidationError) {
      errors.product = productValidationError;
    }

    if (!templateA) {
      errors.templateA = "Please select Template A";
    }

    if (!templateB) {
      errors.templateB = "Please select Template B";
    }

    if (templateA && templateB && templateA === templateB) {
      errors.templateB = "Template A and Template B must be different";
    }

    if (!trafficSplit || trafficSplit < 1 || trafficSplit > 99) {
      errors.trafficSplit = "Traffic split must be between 1 and 99";
    }

    // Validate end result options based on selected type
    if (endResultType === "date" && !endDate) {
      errors.endDate = "Please select an end date";
    }

    if (endResultType === "impressions" && (!impressionThreshold || impressionThreshold < 100)) {
      errors.impressionThreshold = "Impression threshold must be at least 100";
    }

    if (endResultType === "conversions" && (!conversionThreshold || conversionThreshold < 10)) {
      errors.conversionThreshold = "Conversion threshold must be at least 10";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

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

  const checkProductAvailability = async (productId) => {
    if (!productId) {
      setProductValidationError(null);
      return;
    }

    console.log("🔍 Client-side: Checking product availability for productId:", productId);
    setIsCheckingProduct(true);
    setProductValidationError(null);

    try {
      const formData = new FormData();
      formData.append("actionType", "checkProductAvailability");
      formData.append("productId", productId);

      const response = await fetch("", {
        method: "POST",
        body: formData
      });

      const responseText = await response.text();
      console.log("🔍 Client-side: Response text:", responseText);

      // Simple check: if server response contains "already part of a running test", show error
      if (responseText.includes("already part of a running test")) {
        console.log("❌ Client-side: Product is in running test - showing error");
        setProductValidationError("This product is already part of a running test. Please select a different product.");
      } else {
        console.log("✅ Client-side: Product is available");
        setProductValidationError(null);
      }
    } catch (error) {
      console.error("❌ Client-side: Error checking product availability:", error);
      setProductValidationError("Error checking product availability. Please try again.");
    } finally {
      setIsCheckingProduct(false);
    }
  };

  // Remove the fetcher useEffect since we're going back to manual fetch

  // Check product availability when product selection changes
  useEffect(() => {
    if (selectedProductId) {
      checkProductAvailability(selectedProductId);
    } else {
      setProductValidationError(null);
    }
  }, [selectedProductId]);

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
    setValidationErrors({});

    // Client-side validation
    if (!validateForm()) {
      return;
    }

    console.log("🔍 Submitting A/B test form with data:", {
      shop: shopDomain,
      testName,
      productId: selectedProductId,
      templateA,
      templateB,
      trafficSplit,
      endResultType,
      endDate,
      impressionThreshold,
      conversionThreshold
    });

    const formData = new FormData();
    formData.append("shop", shopDomain);
    formData.append("testName", testName);
    formData.append("productId", selectedProductId);
    formData.append("templateA", templateA);
    formData.append("templateB", templateB);
    formData.append("trafficSplit", trafficSplit);
    formData.append("endResultType", endResultType);
    formData.append("endDate", endDate);
    formData.append("impressionThreshold", impressionThreshold);
    formData.append("conversionThreshold", conversionThreshold);

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
        // Response is not JSON, but check if it was successful
        if (response.status === 200) {
          // Even though we got HTML, the status is 200, which means the A/B test was likely created
          console.log("✅ A/B test created successfully (received HTML but status 200)");
          
          // Show success message but DON'T reset form
          const successMessage = `✅ A/B test "${testName}" created successfully!`;
          setSuccessMessage(successMessage);
          setTimeout(() => setSuccessMessage(null), 5000);
          return;
        } else {
          // Response is not JSON and status is not 200, likely a real error
          const text = await response.text();
          console.error("❌ Server returned non-JSON response:", text.substring(0, 500));
          setError("Server error: Received HTML instead of JSON response. Check server logs.");
          return;
        }
      }

      const data = await response.json();
      console.log("🔍 Response data:", data);

      if (data.success) {
        console.log("✅ A/B test created successfully");
        // Show success message but DON'T reset form
        setError(null);
        
        // Show success message in the UI
        const successMessage = `✅ A/B test "${data.abTest.name}" created successfully!`;
        setSuccessMessage(successMessage);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        console.log("❌ A/B test creation failed:", data.error);
        setError(data.error || "Failed to create A/B test");
      }
    } catch (error) {
      console.error("❌ Error submitting form:", error);
      setError("Network error: Failed to submit form");
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #32cd32 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
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
          border: '1px solid rgba(50, 205, 50, 0.2)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', marginBottom: '24px' }}>
            📝 Create Duplicate Template
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Base Product Template */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
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
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
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
                background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                border: '1px solid #32cd32',
                borderRadius: '8px',
                color: 'white'
              }}>
                🔍 Finding associated product...
              </div>
            )}

            {associatedProduct && (
              <div style={{
                padding: '12px',
                background: associatedProduct.isFallback 
                  ? 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)'
                  : 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                border: associatedProduct.isFallback ? '1px solid #9acd32' : '1px solid #32cd32',
                borderRadius: '8px',
                color: 'white'
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
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                border: '1px solid #dc2626',
                borderRadius: '8px',
                color: 'white'
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
                  : 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
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
          border: '1px solid rgba(50, 205, 50, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', marginBottom: '8px' }}>
                🧪 Create A/B Test
              </h2>
              <p style={{ fontSize: '14px', color: '#374151' }}>
                Select two different templates to compare their performance. All fields marked with <span style={{ color: '#dc2626' }}>*</span> are required.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(50, 205, 50, 0.3)',
                minWidth: '140px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #228b22 0%, #006400 100%)';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(50, 205, 50, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(50, 205, 50, 0.3)';
              }}
            >
              <span style={{ fontSize: '16px' }}>🚀</span> Create New Test
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="hidden" name="shop" value={shopDomain} />

            {/* Test Name */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                Test Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                name="testName"
                placeholder="Enter a unique name for this A/B test"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: validationErrors.testName ? '1px solid #dc2626' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              {validationErrors.testName && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  {validationErrors.testName}
                </p>
              )}
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Enter a unique name for this A/B test
              </p>
            </div>

            {/* Product */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                Product <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  name="productId"
                  style={{
                    width: '100%',
                    padding: '12px',
                    paddingRight: isCheckingProduct ? '40px' : '12px',
                    border: (validationErrors.product || productValidationError) ? '1px solid #dc2626' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="">Select Product</option>
                  {productOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {isCheckingProduct && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#32cd32'
                  }}>
                    🔄
                  </div>
                )}
              </div>
              {(validationErrors.product || productValidationError) && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  {validationErrors.product || productValidationError}
                </p>
              )}
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Select the product to run the A/B test on
              </p>
            </div>

            {/* Template A */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                Template A (First Variant) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={templateA}
                onChange={(e) => setTemplateA(e.target.value)}
                name="templateA"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: validationErrors.templateA ? '1px solid #dc2626' : '1px solid #d1d5db',
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
              {validationErrors.templateA && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  {validationErrors.templateA}
                </p>
              )}
            </div>

            {/* Template B */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                Template B (Second Variant) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={templateB}
                onChange={(e) => setTemplateB(e.target.value)}
                name="templateB"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: validationErrors.templateB ? '1px solid #dc2626' : '1px solid #d1d5db',
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
              {validationErrors.templateB && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  {validationErrors.templateB}
                </p>
              )}
            </div>

            {/* Traffic Split */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                Traffic Split (A %) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                value={trafficSplit}
                onChange={(e) => setTrafficSplit(e.target.value)}
                name="trafficSplit"
                min="1"
                max="99"
                placeholder="50"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: validationErrors.trafficSplit ? '1px solid #dc2626' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              {validationErrors.trafficSplit && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  {validationErrors.trafficSplit}
                </p>
              )}
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Percentage of traffic to show Template A (1-99)
              </p>
            </div>

            {/* End Result Options */}
            <div style={{
              padding: '20px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '16px' }}>
                🎯 End Result Configuration
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
                Choose how the test will determine a winner or when it should end.
              </p>

              {/* End Result Type Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '12px' }}>
                  End Result Type
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Manual Option */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    background: endResultType === 'manual' ? '#f0fdf4' : 'white',
                    border: endResultType === 'manual' ? '2px solid #22c55e' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="endResultType"
                      value="manual"
                      checked={endResultType === 'manual'}
                      onChange={(e) => setEndResultType(e.target.value)}
                      style={{ marginRight: '12px' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#000000', marginBottom: '4px' }}>
                        Manual Control
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        You decide when to end the test and declare a winner
                      </div>
                    </div>
                  </label>

                  {/* Date Option */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    background: endResultType === 'date' ? '#f0fdf4' : 'white',
                    border: endResultType === 'date' ? '2px solid #22c55e' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="endResultType"
                      value="date"
                      checked={endResultType === 'date'}
                      onChange={(e) => setEndResultType(e.target.value)}
                      style={{ marginRight: '12px' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#000000', marginBottom: '4px' }}>
                        End Date
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Test ends on a specific date and winner is determined
                      </div>
                    </div>
                  </label>

                  {/* Impressions Option */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    background: endResultType === 'impressions' ? '#f0fdf4' : 'white',
                    border: endResultType === 'impressions' ? '2px solid #22c55e' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="endResultType"
                      value="impressions"
                      checked={endResultType === 'impressions'}
                      onChange={(e) => setEndResultType(e.target.value)}
                      style={{ marginRight: '12px' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#000000', marginBottom: '4px' }}>
                        Impression Count
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Test ends when one variant reaches target impressions
                      </div>
                    </div>
                  </label>

                  {/* Conversions Option */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    background: endResultType === 'conversions' ? '#f0fdf4' : 'white',
                    border: endResultType === 'conversions' ? '2px solid #22c55e' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="endResultType"
                      value="conversions"
                      checked={endResultType === 'conversions'}
                      onChange={(e) => setEndResultType(e.target.value)}
                      style={{ marginRight: '12px' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#000000', marginBottom: '4px' }}>
                        Conversion Count
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Test ends when one variant reaches target conversions
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Conditional Fields Based on Selection */}
              {endResultType === 'date' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                    End Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input
                      type="date"
                      value={endDate.split('T')[0] || ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        const time = endDate.split('T')[1] || '23:59';
                        setEndDate(`${date}T${time}`);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 40px',
                        border: validationErrors.endDate ? '1px solid #dc2626' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      left: '12px',
                      color: '#6b7280',
                      pointerEvents: 'none'
                    }}>
                      📅
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                      End Time
                    </label>
                    <div style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <input
                        type="time"
                        value={endDate.split('T')[1] || '23:59'}
                        onChange={(e) => {
                          const date = endDate.split('T')[0] || '';
                          const time = e.target.value;
                          setEndDate(`${date}T${time}`);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 40px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        left: '12px',
                        color: '#6b7280',
                        pointerEvents: 'none'
                      }}>
                        🕐
                      </div>
                    </div>
                  </div>
                  
                  {validationErrors.endDate && (
                    <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                      {validationErrors.endDate}
                    </p>
                  )}
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    When the test should end and winner be determined
                  </p>
                </div>
              )}

              {endResultType === 'impressions' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                    Impression Threshold <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={impressionThreshold}
                    onChange={(e) => setImpressionThreshold(e.target.value)}
                    name="impressionThreshold"
                    min="100"
                    placeholder="1000"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: validationErrors.impressionThreshold ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  {validationErrors.impressionThreshold && (
                    <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                      {validationErrors.impressionThreshold}
                    </p>
                  )}
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Number of impressions needed for one variant to win (minimum 100)
                  </p>
                </div>
              )}

              {endResultType === 'conversions' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                    Conversion Threshold <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={conversionThreshold}
                    onChange={(e) => setConversionThreshold(e.target.value)}
                    name="conversionThreshold"
                    min="10"
                    placeholder="100"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: validationErrors.conversionThreshold ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  {validationErrors.conversionThreshold && (
                    <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                      {validationErrors.conversionThreshold}
                    </p>
                  )}
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Number of conversions needed for one variant to win (minimum 10)
                  </p>
                </div>
              )}
            </div>

            {/* Error Messages */}
            {error && (
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                border: '1px solid #dc2626',
                borderRadius: '8px',
                color: 'white'
              }}>
                ❌ {error}
              </div>
            )}

            {successMessage && (
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                border: '1px solid #32cd32',
                borderRadius: '8px',
                color: 'white'
              }}>
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #228b22 0%, #006400 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)';
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