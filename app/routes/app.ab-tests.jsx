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
  const { user } = useOutletContext();
  
  // Flow state management
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAction, setSelectedAction] = useState(null);
  const [flowData, setFlowData] = useState({
    action: null,
    testName: "",
    selectedProductId: "",
    templateA: "",
    templateB: "",
    trafficSplit: "50",
    endResultType: "manual",
    endDate: "",
    impressionThreshold: "1000",
    conversionThreshold: "100",
    duplicateTemplateName: "",
    selectedTemplate: productTemplates[0] || ""
  });

  // Form state
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isCheckingProduct, setIsCheckingProduct] = useState(false);
  const [productValidationError, setProductValidationError] = useState(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [associatedProduct, setAssociatedProduct] = useState(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const templateOptions = productTemplates.map(f => ({ label: f, value: f }));
  const productOptions = products.map(p => ({ label: p.title, value: p.id }));

  // Flow steps configuration
  const flowSteps = [
    {
      id: 'action-selection',
      title: 'Choose Your Action',
      description: 'What would you like to do?',
      component: 'ActionSelection'
    },
    {
      id: 'test-setup',
      title: 'Create A/B Test',
      description: 'Set up your experiment',
      component: 'TestSetup',
      condition: () => selectedAction === 'create-test'
    },
    {
      id: 'template-duplication',
      title: 'Duplicate Template',
      description: 'Create a copy of your template',
      component: 'TemplateDuplication',
      condition: () => selectedAction === 'duplicate-template'
    }
  ];

  // Helper functions
  const updateFlowData = (key, value) => {
    setFlowData(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const resetFlow = () => {
    setCurrentStep(0);
    setSelectedAction(null);
    setFlowData({
      action: null,
      testName: "",
      selectedProductId: "",
      templateA: "",
      templateB: "",
      trafficSplit: "50",
      endResultType: "manual",
      endDate: "",
      impressionThreshold: "1000",
      conversionThreshold: "100",
      duplicateTemplateName: "",
      selectedTemplate: productTemplates[0] || ""
    });
    setError(null);
    setSuccessMessage(null);
    setValidationErrors({});
    setProductValidationError(null);
  };

  // Function to validate form
  const validateForm = () => {
    const errors = {};

    if (!flowData.testName.trim()) {
      errors.testName = "Test name is required";
    }

    if (!flowData.selectedProductId) {
      errors.product = "Please select a product";
    }

    if (productValidationError) {
      errors.product = productValidationError;
    }

    if (!flowData.templateA) {
      errors.templateA = "Please select Template A";
    }

    if (!flowData.templateB) {
      errors.templateB = "Please select Template B";
    }

    if (flowData.templateA && flowData.templateB && flowData.templateA === flowData.templateB) {
      errors.templateB = "Template A and Template B must be different";
    }

    if (!flowData.trafficSplit || flowData.trafficSplit < 1 || flowData.trafficSplit > 99) {
      errors.trafficSplit = "Traffic split must be between 1 and 99";
    }

    // Validate end result options based on selected type
    if (flowData.endResultType === "date" && !flowData.endDate) {
      errors.endDate = "Please select an end date";
    }

    if (flowData.endResultType === "impressions" && (!flowData.impressionThreshold || flowData.impressionThreshold < 100)) {
      errors.impressionThreshold = "Impression threshold must be at least 100";
    }

    if (flowData.endResultType === "conversions" && (!flowData.conversionThreshold || flowData.conversionThreshold < 10)) {
      errors.conversionThreshold = "Conversion threshold must be at least 10";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // When template selection changes, fetch the associated product
  useEffect(() => {
    if (flowData.selectedTemplate) {
      setIsLoadingProduct(true);
      setAssociatedProduct(null);
      
      const formData = new FormData();
      formData.append("actionType", "getProductForTemplate");
      formData.append("template", flowData.selectedTemplate);
      
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
  }, [flowData.selectedTemplate]);

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

  // Check product availability when product selection changes
  useEffect(() => {
    if (flowData.selectedProductId) {
      checkProductAvailability(flowData.selectedProductId);
    } else {
      setProductValidationError(null);
    }
  }, [flowData.selectedProductId]);

  // Handler for OK button (create duplicate template and open in theme editor)
  const handleOk = async () => {
    if (!flowData.duplicateTemplateName.trim()) {
      setPreviewError("Please enter a name for the duplicate template");
      return;
    }

    setIsCreatingTemplate(true);
    setPreviewError(null);

    try {
      // Create duplicate template
      const formData = new FormData();
      formData.append("actionType", "duplicateTemplate");
      formData.append("template", flowData.selectedTemplate);
      formData.append("newName", flowData.duplicateTemplateName.trim());
      formData.append("themeId", themeGid);

      const response = await fetch("/app/ab-tests", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Open the duplicated template in theme editor
        const productHandle = associatedProduct?.handle || "example-product"; // Fallback to example-product if no handle
        const previewPath = `/products/${productHandle}?view=${flowData.duplicateTemplateName.trim()}`;
        
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
      testName: flowData.testName,
      productId: flowData.selectedProductId,
      templateA: flowData.templateA,
      templateB: flowData.templateB,
      trafficSplit: flowData.trafficSplit,
      endResultType: flowData.endResultType,
      endDate: flowData.endDate,
      impressionThreshold: flowData.impressionThreshold,
      conversionThreshold: flowData.conversionThreshold
    });

    const formData = new FormData();
    formData.append("shop", shopDomain);
    formData.append("testName", flowData.testName);
    formData.append("productId", flowData.selectedProductId);
    formData.append("templateA", flowData.templateA);
    formData.append("templateB", flowData.templateB);
    formData.append("trafficSplit", flowData.trafficSplit);
    formData.append("endResultType", flowData.endResultType);
    formData.append("endDate", flowData.endDate);
    formData.append("impressionThreshold", flowData.impressionThreshold);
    formData.append("conversionThreshold", flowData.conversionThreshold);

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
          const successMessage = `✅ A/B test "${flowData.testName}" created successfully!`;
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

  // Action Selection Component
  const ActionSelection = () => (
    <div style={{
      background: 'white',
      padding: '40px',
      borderRadius: '20px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      border: '1px solid rgba(50, 205, 50, 0.2)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#000000', marginBottom: '12px' }}>
          🚀 A/B Testing Setup
        </h2>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          Choose how you'd like to get started with A/B testing
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Create A/B Test Option */}
        <button
          onClick={() => {
            setSelectedAction('create-test');
            updateFlowData('action', 'create-test');
            nextStep();
          }}
          style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-4px)';
            e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          <div style={{ fontSize: '24px' }}>🧪</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
              Create New A/B Test
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Set up an experiment to compare two different product page versions
            </div>
          </div>
        </button>

        {/* Duplicate Template Option */}
        <button
          onClick={() => {
            setSelectedAction('duplicate-template');
            updateFlowData('action', 'duplicate-template');
            nextStep();
          }}
          style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-4px)';
            e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          <div style={{ fontSize: '24px' }}>📝</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
              Duplicate Product Template
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Create a copy of your existing product template for customization
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  // Test Setup Component
  const TestSetup = () => (
    <div style={{
      background: 'white',
      padding: '40px',
      borderRadius: '20px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      border: '1px solid rgba(50, 205, 50, 0.2)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <button
          onClick={prevStep}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            marginRight: '16px',
            color: '#6b7280'
          }}
        >
          ←
        </button>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#000000', marginBottom: '4px' }}>
            Create A/B Test
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Step {currentStep + 1} of {flowSteps.length}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            style={{
              width: '40px',
              height: '4px',
              background: step <= currentStep + 1 ? '#32cd32' : '#e5e7eb',
              borderRadius: '2px',
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>

      {/* Form fields - show progressively */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Step 1: Test Name */}
        <div style={{ opacity: currentStep >= 0 ? 1 : 0.5, transition: 'opacity 0.3s ease' }}>
          <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
            Test Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            value={flowData.testName}
            onChange={(e) => updateFlowData('testName', e.target.value)}
            placeholder="Enter a unique name for this A/B test"
            style={{
              width: '100%',
              padding: '16px',
              border: validationErrors.testName ? '2px solid #dc2626' : '2px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '16px',
              transition: 'all 0.3s ease'
            }}
          />
          {validationErrors.testName && (
            <p style={{ fontSize: '14px', color: '#dc2626', marginTop: '8px' }}>
              {validationErrors.testName}
            </p>
          )}
        </div>

        {/* Step 2: Product Selection */}
        {flowData.testName && (
          <div style={{ opacity: currentStep >= 1 ? 1 : 0.5, transition: 'opacity 0.3s ease' }}>
            <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
              Product <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={flowData.selectedProductId}
              onChange={(e) => updateFlowData('selectedProductId', e.target.value)}
              style={{
                width: '100%',
                padding: '16px',
                border: (validationErrors.product || productValidationError) ? '2px solid #dc2626' : '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                background: 'white',
                transition: 'all 0.3s ease'
              }}
            >
              <option value="">Select Product</option>
              {productOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {(validationErrors.product || productValidationError) && (
              <p style={{ fontSize: '14px', color: '#dc2626', marginTop: '8px' }}>
                {validationErrors.product || productValidationError}
              </p>
            )}
          </div>
        )}

        {/* Step 3: Template A */}
        {flowData.selectedProductId && (
          <div style={{ opacity: currentStep >= 2 ? 1 : 0.5, transition: 'opacity 0.3s ease' }}>
            <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
              Template A (First Variant) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={flowData.templateA}
              onChange={(e) => updateFlowData('templateA', e.target.value)}
              style={{
                width: '100%',
                padding: '16px',
                border: validationErrors.templateA ? '2px solid #dc2626' : '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                background: 'white',
                transition: 'all 0.3s ease'
              }}
            >
              <option value="">Select Template A</option>
              {templateOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {validationErrors.templateA && (
              <p style={{ fontSize: '14px', color: '#dc2626', marginTop: '8px' }}>
                {validationErrors.templateA}
              </p>
            )}
          </div>
        )}

        {/* Step 4: Template B */}
        {flowData.templateA && (
          <div style={{ opacity: currentStep >= 3 ? 1 : 0.5, transition: 'opacity 0.3s ease' }}>
            <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
              Template B (Second Variant) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={flowData.templateB}
              onChange={(e) => updateFlowData('templateB', e.target.value)}
              style={{
                width: '100%',
                padding: '16px',
                border: validationErrors.templateB ? '2px solid #dc2626' : '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                background: 'white',
                transition: 'all 0.3s ease'
              }}
            >
              <option value="">Select Template B</option>
              {templateOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {validationErrors.templateB && (
              <p style={{ fontSize: '14px', color: '#dc2626', marginTop: '8px' }}>
                {validationErrors.templateB}
              </p>
            )}
          </div>
        )}

        {/* Step 5: Traffic Split */}
        {flowData.templateB && (
          <div style={{ opacity: currentStep >= 4 ? 1 : 0.5, transition: 'opacity 0.3s ease' }}>
            <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
              Traffic Split (A %) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="number"
              value={flowData.trafficSplit}
              onChange={(e) => updateFlowData('trafficSplit', e.target.value)}
              min="1"
              max="99"
              placeholder="50"
              style={{
                width: '100%',
                padding: '16px',
                border: validationErrors.trafficSplit ? '2px solid #dc2626' : '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                transition: 'all 0.3s ease'
              }}
            />
            {validationErrors.trafficSplit && (
              <p style={{ fontSize: '14px', color: '#dc2626', marginTop: '8px' }}>
                {validationErrors.trafficSplit}
              </p>
            )}
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
              Percentage of traffic to show Template A (1-99)
            </p>
          </div>
        )}

        {/* Create Test Button */}
        {flowData.trafficSplit && (
          <button
            onClick={handleSubmit}
            style={{
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              marginTop: '16px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 10px 20px rgba(50, 205, 50, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            🚀 Create A/B Test
          </button>
        )}
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div style={{
          padding: '16px',
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          border: '1px solid #dc2626',
          borderRadius: '12px',
          color: 'white',
          marginTop: '24px'
        }}>
          ❌ {error}
        </div>
      )}

      {successMessage && (
        <div style={{
          padding: '16px',
          background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
          border: '1px solid #32cd32',
          borderRadius: '12px',
          color: 'white',
          marginTop: '24px'
        }}>
          {successMessage}
        </div>
      )}
    </div>
  );

  // Template Duplication Component
  const TemplateDuplication = () => (
    <div style={{
      background: 'white',
      padding: '40px',
      borderRadius: '20px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      border: '1px solid rgba(50, 205, 50, 0.2)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <button
          onClick={prevStep}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            marginRight: '16px',
            color: '#6b7280'
          }}
        >
          ←
        </button>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#000000', marginBottom: '4px' }}>
            Duplicate Template
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Create a copy of your product template
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Template Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
            Base Product Template
          </label>
          <select
            value={flowData.selectedTemplate}
            onChange={(e) => updateFlowData('selectedTemplate', e.target.value)}
            style={{
              width: '100%',
              padding: '16px',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '16px',
              background: 'white',
              transition: 'all 0.3s ease'
            }}
          >
            {templateOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* Template Name */}
        {flowData.selectedTemplate && (
          <div>
            <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
              Duplicate Template Name
            </label>
            <input
              type="text"
              value={flowData.duplicateTemplateName}
              onChange={(e) => updateFlowData('duplicateTemplateName', e.target.value)}
              placeholder="e.g., variant-a, hero-version, etc."
              style={{
                width: '100%',
                padding: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                transition: 'all 0.3s ease'
              }}
            />
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
              Enter a unique name for your duplicate template (no spaces, use hyphens)
            </p>
          </div>
        )}

        {/* Create Template Button */}
        {flowData.duplicateTemplateName && (
          <button
            onClick={handleOk}
            disabled={isCreatingTemplate}
            style={{
              padding: '16px 32px',
              background: isCreatingTemplate 
                ? '#9ca3af' 
                : 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isCreatingTemplate ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              marginTop: '16px'
            }}
            onMouseEnter={(e) => {
              if (!isCreatingTemplate) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreatingTemplate) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            {isCreatingTemplate ? "Creating Template..." : "📝 Create & Open in Theme Editor"}
          </button>
        )}
      </div>
    </div>
  );

  // Main render
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Inter, system-ui, sans-serif',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #32cd32 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>🧪 A/B Testing</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>Create experiments to optimize your product pages</p>
      </div>

      {/* Flow Content */}
      {currentStep === 0 && <ActionSelection />}
      {currentStep === 1 && selectedAction === 'create-test' && <TestSetup />}
      {currentStep === 1 && selectedAction === 'duplicate-template' && <TemplateDuplication />}
    </div>
  );
} 