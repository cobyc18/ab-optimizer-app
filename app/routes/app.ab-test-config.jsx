import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    
    if (!productId) {
      return json({ error: "Product ID is required" }, { status: 400 });
    }

    console.log("🔍 Fetching A/B test config for product:", productId);

    // Extract numeric product ID if it's a Shopify GID
    let numericProductId = productId;
    if (typeof productId === "string" && productId.startsWith("gid://")) {
      const match = productId.match(/Product\/(\d+)/);
      if (match) {
        numericProductId = match[1];
      }
    }

    // Find active A/B tests for this product
    const activeTests = await prisma.aBTest.findMany({
      where: {
        productId: numericProductId,
        status: "running"
      },
      orderBy: {
        startDate: 'desc'
      },
      take: 1 // Get the most recent active test
    });

    if (activeTests.length === 0) {
      console.log("❌ No active A/B tests found for product:", numericProductId);
      return json({ testId: null });
    }

    const test = activeTests[0];
    console.log("✅ Found active A/B test:", test.id);

    // Return test configuration
    const config = {
      testId: test.id,
      templateA: test.templateA,
      templateB: test.templateB,
      trafficSplit: test.trafficSplit,
      status: test.status
    };

    console.log("📊 Returning A/B test config:", config);
    return json(config);

  } catch (error) {
    console.error("❌ Error fetching A/B test config:", error);
    return json({ error: "Failed to fetch A/B test configuration" }, { status: 500 });
  }
}; 