import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

const getTemplateSuffixFromFilename = (filename) => {
  if (!filename) return "default";
  if (filename === "templates/product.liquid" || filename === "templates/product.json") {
    return "default";
  }
  const match = filename.match(/product\.([^.]+)\.(json|liquid)$/);
  return match ? match[1] : "default";
};

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      shop: shopFromClient,
      testName,
      productId,
      controlTemplateFilename,
      variantTemplateFilename,
      controlTemplateSuffix,
      variantTemplateSuffix,
      trafficSplit = "50",
      widgetType,
      widgetSettings,
      endResultType = "manual",
      endDate = null,
      autopilotMode = null
    } = body;

    if (!productId) {
      return json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    if (!variantTemplateSuffix) {
      return json({ success: false, error: "Variant template suffix is required." }, { status: 400 });
    }

    const { session, admin } = await authenticate.admin(request);
    const shop = shopFromClient || session.shop;
    const accessToken = session.accessToken;

    if (!shop) {
      return json({ success: false, error: "Unable to determine shop." }, { status: 400 });
    }

    const finalTestName =
      (typeof testName === "string" && testName.trim().length > 0)
        ? testName.trim()
        : `Widget Test ${new Date().toISOString()}`;

    const trafficSplitInt = Number.parseInt(trafficSplit, 10) || 50;

    const variantSuffix = variantTemplateSuffix;
    const controlSuffixFromFilename = getTemplateSuffixFromFilename(controlTemplateFilename);
    const controlSuffix = controlTemplateSuffix ?? (controlSuffixFromFilename === "default" ? null : controlSuffixFromFilename);
    const controlSuffixForDb = controlSuffix === null ? "default" : controlSuffix;

    const productNumericId = typeof productId === "string"
      ? (productId.match(/Product\/(\d+)/)?.[1] || productId)
      : productId;

    const existingTest = await prisma.aBTest.findUnique({
      where: { name: finalTestName }
    });
    if (existingTest) {
      return json({ success: false, error: "A test with this name already exists. Please choose a different name." }, { status: 400 });
    }

    // Check if there's a running test for this product - SCOPED BY SHOP
    // Different shops can use the same product ID for different tests
    const existingRunningTest = await prisma.aBTest.findFirst({
      where: {
        shop: shop,
        productId: productNumericId,
        status: "running"
      }
    });
    if (existingRunningTest) {
      return json({
        success: false,
        error: `This product is already part of a running test called "${existingRunningTest.name}". Please wait for it to complete or pause it first.`
      }, { status: 400 });
    }

    let shopRecord = await prisma.shop.findUnique({
      where: { shop }
    });

    if (!shopRecord) {
      shopRecord = await prisma.shop.create({
        data: {
          shop,
          accessToken,
          scope: session.scope || '',
          isActive: true,
          installedAt: new Date(),
          settings: {},
          metadata: {}
        }
      });
    }

    let normalizedWidgetSettings = null;
    if (widgetSettings) {
      if (typeof widgetSettings === "string") {
        try {
          normalizedWidgetSettings = JSON.parse(widgetSettings);
        } catch (parseError) {
          console.error("⚠️ Failed to parse widget settings JSON:", parseError);
          normalizedWidgetSettings = null;
        }
      } else {
        normalizedWidgetSettings = widgetSettings;
      }
    }

    const createData = {
      shop,
      name: finalTestName,
      productId: productNumericId,
      templateA: controlSuffixForDb,
      templateB: variantSuffix,
      trafficSplit: trafficSplitInt,
      endResultType: endResultType || "manual",
      widgetType: widgetType || null
    };

    // Add endDate if provided (manual mode)
    if (endDate) {
      createData.endDate = new Date(endDate);
    }

    if (normalizedWidgetSettings && Object.keys(normalizedWidgetSettings).length > 0) {
      createData.widgetSettings = normalizedWidgetSettings;
    }

    const abTest = await prisma.aBTest.create({
      data: createData
    });

    try {
      const mutation = `
        mutation assignTemplate($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors {
              field
              message
            }
          }
        }
      `;
      await admin.graphql(mutation, {
        variables: {
          input: {
            id: productId,
            templateSuffix: controlSuffixForDb === "default" ? null : controlSuffixForDb
          }
        }
      });
    } catch (error) {
      console.error("⚠️ Failed to revert product template to control:", error);
    }

    return json({ success: true, abTest });
  } catch (error) {
    console.error("❌ Error launching A/B test:", error);
    return json({ success: false, error: error.message || "Server error launching test." }, { status: 500 });
  }
};

