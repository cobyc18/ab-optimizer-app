import { useLoaderData, Form, useActionData, useFetcher } from "@remix-run/react";
import { 
  AppProvider as PolarisAppProvider,
  Page, 
  Layout, 
  Card, 
  Button, 
  Select, 
  TextField, 
  InlineStack, 
  BlockStack, 
  Banner,
  Text
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { useState, useEffect } from "react";
export { loader, action } from "./app.ab-testing.server.js";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// ---------- Utilities ----------
function betaSample(alpha, beta) {
  // Gamma sampler (Marsaglia-Tsang) for alpha >= 0. Note: works okay for integer+1 priors.
  function gammaSample(k) {
    if (k < 1) {
      // use boost for shape < 1
      const d = gammaSample(k + 1);
      return d * Math.pow(Math.random(), 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x = 0;
      // Normal(0,1) approx using Box-Muller
      const u1 = Math.random();
      const u2 = Math.random();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const v = 1 + c * x;
      if (v <= 0) continue;
      const v3 = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.331 * (x * x * x * x)) return d * v3;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v3 + Math.log(v3))) return d * v3;
    }
  }
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

function samplePosteriors(bsA, btA, bsB, btB, samples = 10000) {
  const pA = new Array(samples);
  const pB = new Array(samples);
  for (let i = 0; i < samples; i++) {
    pA[i] = betaSample(bsA, btA);
    pB[i] = betaSample(bsB, btB);
  }
  return { pA, pB };
}

function summarizeSamples(pA, pB) {
  const samples = pA.length;
  let winsB = 0, winsA = 0;
  let sumRelLift = 0; // (B - A) / A
  let sumAbsLift = 0; // (B - A)
  const relLifts = [];
  for (let i = 0; i < samples; i++) {
    const a = pA[i], b = pB[i];
    if (b > a) winsB++;
    if (a > b) winsA++;
    const abs = b - a;
    const rel = a === 0 ? null : abs / a;
    sumAbsLift += abs;
    sumRelLift += (rel === null ? 0 : rel);
    relLifts.push(rel);
  }
  const probB = winsB / samples;
  const probA = winsA / samples;
  const expAbsLift = sumAbsLift / samples;
  const expRelLift = sumRelLift / samples;

  // credible intervals for absolute lift
  const absSamples = new Array(samples);
  for (let i = 0; i < samples; i++) absSamples[i] = pB[i] - pA[i];
  absSamples.sort((x, y) => x - y);
  const ciLow = absSamples[Math.floor(samples * 0.025)];
  const ciHigh = absSamples[Math.floor(samples * 0.975)];

  return {
    probB,
    probA,
    expectedAbsLift: expAbsLift,
    expectedRelLift: expRelLift,
    ci95: [ciLow, ciHigh],
  };
}

// ---------- Main Bayesian summary & decision ----------
/**
 * Inputs object:
 * {
 *  control: {visits, atcSuccesses, purchaseSuccesses},
 *  variant: {visits, atcSuccesses, purchaseSuccesses},
 *  mode: 'fast'|'standard'|'careful',
 *  minDays: {fast:3, standard:7, careful:10} optional,
 *  daysRunning: number,
 *  samples: 10000,
 *  businessMDE: 0.05 (5%) optional
 * }
 */
function analyzeABDualMetric(input) {
  const { control, variant, mode = 'standard', daysRunning = 0, samples = 10000, businessMDE = 0.0 } = input;

  // thresholds and minima per your notes
  const MODE = {
    fast: { threshold: 0.90, minN: 500, minDays: 3 },
    standard: { threshold: 0.95, minN: 1500, minDays: 7 },
    careful: { threshold: 0.975, minN: 3000, minDays: 10 }
  }[mode];

  // Build posteriors for both metrics: Beta(success+1, failures+1)
  const atcA_alpha = control.atcSuccesses + 1;
  const atcA_beta = (control.visits - control.atcSuccesses) + 1;
  const atcB_alpha = variant.atcSuccesses + 1;
  const atcB_beta = (variant.visits - variant.atcSuccesses) + 1;

  const purA_alpha = control.purchaseSuccesses + 1;
  const purA_beta = (control.visits - control.purchaseSuccesses) + 1;
  const purB_alpha = variant.purchaseSuccesses + 1;
  const purB_beta = (variant.visits - variant.purchaseSuccesses) + 1;

  // sample posteriors
  const atcSamples = samplePosteriors(atcA_alpha, atcA_beta, atcB_alpha, atcB_beta, samples);
  const purSamples = samplePosteriors(purA_alpha, purA_beta, purB_alpha, purB_beta, samples);

  const atcSummary = summarizeSamples(atcSamples.pA, atcSamples.pB);
  const purSummary = summarizeSamples(purSamples.pA, purSamples.pB);

  // combined / joint probability: fraction where EITHER purchase sample OR atc sample shows B > A
  let jointWins = 0;
  for (let i = 0; i < samples; i++) {
    if (purSamples.pB[i] > purSamples.pA[i] || atcSamples.pB[i] > atcSamples.pA[i]) jointWins++;
  }
  const probJoint = jointWins / samples;

  // Decide using the rules described earlier:
  const perVariantMinN = MODE.minN;
  const haveMinN = (control.visits >= perVariantMinN && variant.visits >= perVariantMinN);
  const haveMinDays = (daysRunning >= MODE.minDays);

  // Simple decision logic: prefer purchases. If purchases sparse, rely on ATC as fallback.
  let decision = 'no_clear_winner';
  const t = MODE.threshold;

  // Primary purchase-based rule
  if (haveMinN && haveMinDays) {
    if (purSummary.probB >= t && purSummary.expectedRelLift >= businessMDE) {
      decision = 'variant_wins_on_purchases';
    } else if (purSummary.probA >= t) {
      decision = 'control_wins_on_purchases';
    } else {
      // fallback: if purchases inconclusive but ATC strong
      if (atcSummary.probB >= t && atcSummary.expectedRelLift >= businessMDE) {
        decision = 'variant_likely_on_atc_but_purchases_inconclusive';
      }
    }
  } else {
    // insufficient purchases; use hybrid approach
    const lowerThreshold = Math.max(0.80, t - 0.05); // allow small relaxation
    if (purSummary.probB >= lowerThreshold && atcSummary.probB >= t) {
      decision = 'variant_probable_based_on_purchases_and_strong_atc';
    } else if (probJoint >= t) {
      decision = 'variant_probable_by_joint_metric';
    }
  }

  // build result object
  return {
    mode,
    daysRunning,
    control,
    variant,
    atc: {
      probB: atcSummary.probB,
      expectedAbsLift: atcSummary.expectedAbsLift,
      expectedRelLift: atcSummary.expectedRelLift,
      ci95: atcSummary.ci95,
      totals: { control_visits: control.visits, variant_visits: variant.visits }
    },
    purchases: {
      probB: purSummary.probB,
      expectedAbsLift: purSummary.expectedAbsLift,
      expectedRelLift: purSummary.expectedRelLift,
      ci95: purSummary.ci95,
      totals: { control_visits: control.visits, variant_visits: variant.visits }
    },
    joint: {
      probJoint
    },
    decision,
    haveMinN,
    haveMinDays
  };
}

export default function ABTesting() {
  const { shopDomain, themeId, themeGid, productTemplates, products } = useLoaderData();
  const actionData = useActionData();
  const fetcher = useFetcher();
  const duplicateFetcher = useFetcher();
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

  // Winner declaration state
  const [testResults, setTestResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('standard');
  const [businessMDE, setBusinessMDE] = useState(0.05);

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
      
      fetcher.submit(formData, { method: "post" });
    }
  }, [selectedTemplate]);

  // Handle fetcher response for product lookup
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      setIsLoadingProduct(false);
      if (fetcher.data.success) {
        setAssociatedProduct({
          handle: fetcher.data.productHandle,
          title: fetcher.data.productTitle,
          isFallback: fetcher.data.fallback || false
        });
      }
    }
  }, [fetcher.data, fetcher.state]);

  // Handler for OK button (create duplicate template and open in theme editor)
  const handleOk = () => {
    if (!duplicateTemplateName.trim()) {
      setPreviewError("Please enter a name for the duplicate template");
      return;
    }

    setIsCreatingTemplate(true);
    setPreviewError(null);

    // Create duplicate template
    const formData = new FormData();
    formData.append("actionType", "duplicateTemplate");
    formData.append("template", selectedTemplate);
    formData.append("newName", duplicateTemplateName.trim());
    formData.append("themeId", themeGid);

    duplicateFetcher.submit(formData, { method: "post" });
  };

  // Handle duplicate fetcher response
  useEffect(() => {
    if (duplicateFetcher.data && duplicateFetcher.state === "idle") {
      setIsCreatingTemplate(false);
      if (duplicateFetcher.data.success) {
        // Open the duplicated template in theme editor
        const productHandle = associatedProduct?.handle || inferredProductHandle;
        const previewPath = `/products/${productHandle}?view=${duplicateTemplateName.trim()}`;
        
        const shopShort = shopDomain.replace('.myshopify.com', '');
        const themeIdNum = themeId.replace('gid://shopify/Theme/', '');
        const url = `https://admin.shopify.com/store/${shopShort}/themes/${themeIdNum}/editor?previewPath=${encodeURIComponent(previewPath)}`;
        window.open(url, "_blank");
      } else {
        setPreviewError(duplicateFetcher.data.error || "Failed to create duplicate template");
      }
    }
  }, [duplicateFetcher.data, duplicateFetcher.state, associatedProduct, inferredProductHandle, duplicateTemplateName, shopDomain, themeId]);

  // Winner declaration handler
  const handleAnalyzeTest = () => {
    setIsAnalyzing(true);
    
    // Mock data for demonstration - in real implementation, this would come from your database
    const mockTestData = {
      control: {
        visits: 1500,
        atcSuccesses: 150,
        purchaseSuccesses: 75
      },
      variant: {
        visits: 1500,
        atcSuccesses: 180,
        purchaseSuccesses: 90
      },
      mode: analysisMode,
      daysRunning: 7,
      businessMDE: businessMDE
    };

    try {
      const results = analyzeABDualMetric(mockTestData);
      setTestResults(results);
    } catch (error) {
      console.error("Error analyzing test:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getDecisionColor = (decision) => {
    if (decision.includes('variant_wins') || decision.includes('variant_probable')) {
      return 'success';
    } else if (decision.includes('control_wins')) {
      return 'warning';
    } else {
      return 'info';
    }
  };

  const getDecisionText = (decision) => {
    const decisions = {
      'variant_wins_on_purchases': 'Variant wins on purchases!',
      'control_wins_on_purchases': 'Control wins on purchases',
      'variant_likely_on_atc_but_purchases_inconclusive': 'Variant likely on ATC, purchases inconclusive',
      'variant_probable_based_on_purchases_and_strong_atc': 'Variant probable based on purchases and strong ATC',
      'variant_probable_by_joint_metric': 'Variant probable by joint metric',
      'no_clear_winner': 'No clear winner yet'
    };
    return decisions[decision] || decision;
  };

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
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
                disabled={!selectedTemplate || !duplicateTemplateName.trim() || duplicateFetcher.state === "submitting"}
                onClick={handleOk}
                loading={duplicateFetcher.state === "submitting"}
              >
                {duplicateFetcher.state === "submitting" ? "Creating Template..." : "Create & Open in Theme Editor"}
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
          <Layout.Section>
            <Card title="Declare A/B Test Winner">
              <BlockStack gap="400">
                <Select
                  label="Analysis Mode"
                  options={[
                    { label: "Fast (3 days, 500 visitors)", value: "fast" },
                    { label: "Standard (7 days, 1500 visitors)", value: "standard" },
                    { label: "Careful (10 days, 3000 visitors)", value: "careful" }
                  ]}
                  value={analysisMode}
                  onChange={setAnalysisMode}
                />
                
                <TextField
                  label="Business MDE (Minimum Detectable Effect)"
                  type="number"
                  value={businessMDE.toString()}
                  onChange={(value) => setBusinessMDE(parseFloat(value))}
                  suffix="%"
                  helpText="Minimum relative improvement to consider significant (e.g., 5% = 0.05)"
                />
                
                <Button
                  primary
                  onClick={handleAnalyzeTest}
                  loading={isAnalyzing}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Analyzing Test..." : "Analyze Test Results"}
                </Button>
                
                {testResults && (
                  <BlockStack gap="300">
                    <Banner status={getDecisionColor(testResults.decision)}>
                      <strong>Decision: {getDecisionText(testResults.decision)}</strong>
                    </Banner>
                    
                    <Card sectioned>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">Purchase Analysis</Text>
                        <Text variant="bodyMd">
                          <strong>Variant Win Probability:</strong> {(testResults.purchases.probB * 100).toFixed(1)}%
                        </Text>
                        <Text variant="bodyMd">
                          <strong>Expected Relative Lift:</strong> {(testResults.purchases.expectedRelLift * 100).toFixed(1)}%
                        </Text>
                        <Text variant="bodyMd">
                          <strong>95% Credible Interval:</strong> {(testResults.purchases.ci95[0] * 100).toFixed(1)}% to {(testResults.purchases.ci95[1] * 100).toFixed(1)}%
                        </Text>
                      </BlockStack>
                    </Card>
                    
                    <Card sectioned>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">Add to Cart Analysis</Text>
                        <Text variant="bodyMd">
                          <strong>Variant Win Probability:</strong> {(testResults.atc.probB * 100).toFixed(1)}%
                        </Text>
                        <Text variant="bodyMd">
                          <strong>Expected Relative Lift:</strong> {(testResults.atc.expectedRelLift * 100).toFixed(1)}%
                        </Text>
                        <Text variant="bodyMd">
                          <strong>95% Credible Interval:</strong> {(testResults.atc.ci95[0] * 100).toFixed(1)}% to {(testResults.atc.ci95[1] * 100).toFixed(1)}%
                        </Text>
                      </BlockStack>
                    </Card>
                    
                    <Card sectioned>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">Test Status</Text>
                        <Text variant="bodyMd">
                          <strong>Days Running:</strong> {testResults.daysRunning}
                        </Text>
                        <Text variant="bodyMd">
                          <strong>Has Minimum Sample Size:</strong> {testResults.haveMinN ? "Yes" : "No"}
                        </Text>
                        <Text variant="bodyMd">
                          <strong>Has Minimum Days:</strong> {testResults.haveMinDays ? "Yes" : "No"}
                        </Text>
                        <Text variant="bodyMd">
                          <strong>Control Visits:</strong> {testResults.control.visits}
                        </Text>
                        <Text variant="bodyMd">
                          <strong>Variant Visits:</strong> {testResults.variant.visits}
                        </Text>
                      </BlockStack>
                    </Card>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </PolarisAppProvider>
  );
}
