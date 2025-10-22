import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { Page, Layout, Card, Button, Select, TextField, InlineStack, BlockStack, Banner } from "@shopify/polaris";
import { useState, useEffect } from "react";
export { loader, action } from "./app.ab-testing.server.js";

export default function ABTesting() {
  const { shopDomain, themeId, themeGid, productTemplates, products } = useLoaderData();
  const actionData = useActionData();
  const [templateA, setTemplateA] = useState(productTemplates[0] || "");
  const [templateB, setTemplateB] = useState("");
  const [trafficSplit, setTrafficSplit] = useState("50");
  const [testName, setTestName] = useState("");
  const [error, setError] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");

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
      
      fetch("/app/ab-testing", {
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

      const response = await fetch("/app/ab-testing", {
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

  return (
    <Page title="Create A/B Test">
      <Layout>
        <Layout.Section>
          <Card title="Create Duplicate Template">
            <BlockStack gap="400">
              <Select
                label="Base Product Template"
                options={templateOptions}
                value={selectedTemplate}
                onChange={setSelectedTemplate}
                name="template"
                helpText="Select the template you want to duplicate"
              />
              
              <TextField
                label="Duplicate Template Name"
                value={duplicateTemplateName}
                onChange={setDuplicateTemplateName}
                placeholder="e.g., variant-a, hero-version, etc."
                helpText="Enter a unique name for your duplicate template (no spaces, use hyphens)"
                required
              />
              
              {isLoadingProduct && (
                <Banner status="info">Finding associated product...</Banner>
              )}
              
              {associatedProduct && (
                <Banner status={associatedProduct.isFallback ? "warning" : "success"}>
                  {associatedProduct.isFallback 
                    ? `No specific product found for this template. Will use "${associatedProduct.title}" as fallback.`
                    : `Associated Product: ${associatedProduct.title} (${associatedProduct.handle})`
                  }
                </Banner>
              )}
              
              {previewError && <Banner status="critical">{previewError}</Banner>}
              <Button
                primary
                disabled={!selectedTemplate || !duplicateTemplateName.trim() || isCreatingTemplate}
                onClick={handleOk}
                loading={isCreatingTemplate}
              >
                {isCreatingTemplate ? "Creating Template..." : "Create & Open in Theme Editor"}
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Form method="post">
              <BlockStack gap="400">
                <input type="hidden" name="shop" value={shopDomain} />
                <TextField
                  label="Test Name"
                  value={testName}
                  onChange={setTestName}
                  name="testName"
                  helpText="Enter a unique name for this A/B test"
                  required
                />
                <Select
                  label="Product"
                  options={productOptions}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  name="productId"
                  helpText="Select the product to run the A/B test on"
                />
                <Select
                  label="Template A (First Variant)"
                  options={templateOptions}
                  value={templateA}
                  onChange={setTemplateA}
                  name="templateA"
                />
                <Select
                  label="Template B (Second Variant)"
                  options={templateOptions}
                  value={templateB}
                  onChange={setTemplateB}
                  name="templateB"
                />
                <TextField
                  label="Traffic Split (A %)"
                  type="number"
                  value={trafficSplit}
                  onChange={setTrafficSplit}
                  name="trafficSplit"
                  min={1}
                  max={99}
                />
                {error && <Banner status="critical">{error}</Banner>}
                <Button primary submit>
                  Create A/B Test
                </Button>
                {actionData?.success && <Banner status="success">A/B Test created!</Banner>}
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
