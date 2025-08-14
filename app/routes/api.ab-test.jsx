import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const action = formData.get("action");
  const productId = formData.get("productId");
  const variant = formData.get("variant");
  const testId = formData.get("testId");
  const eventType = formData.get("eventType");

  try {
    switch (action) {
      case "getTest":
        // Get A/B test for a product
        const test = await prisma.aBTest.findFirst({
          where: {
            productId: parseInt(productId),
            status: "running"
          },
          select: {
            id: true,
            name: true,
            templateA: true,
            templateB: true,
            trafficSplit: true,
            endResultType: true,
            endDate: true,
            impressionThreshold: true,
            conversionThreshold: true
          }
        });
        
        if (!test) {
          return json({ test: null });
        }

        // Determine variant based on traffic split
        const random = Math.random() * 100;
        const variant = random <= test.trafficSplit ? "A" : "B";
        
        return json({ 
          test: {
            ...test,
            variant,
            template: variant === "A" ? test.templateA : test.templateB
          }
        });

      case "logEvent":
        // Log A/B test event
        await prisma.aBEvent.create({
          data: {
            testId: parseInt(testId),
            eventType,
            variant,
            productId: parseInt(productId),
            timestamp: new Date()
          }
        });
        
        return json({ success: true });

      case "getVariant":
        // Get variant for a specific test
        const variantTest = await prisma.aBTest.findUnique({
          where: { id: parseInt(testId) },
          select: {
            id: true,
            templateA: true,
            templateB: true,
            trafficSplit: true
          }
        });

        if (!variantTest) {
          return json({ error: "Test not found" }, { status: 404 });
        }

        const variantRandom = Math.random() * 100;
        const selectedVariant = variantRandom <= variantTest.trafficSplit ? "A" : "B";
        
        return json({
          variant: selectedVariant,
          template: selectedVariant === "A" ? variantTest.templateA : variantTest.templateB
        });

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("A/B Test API Error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
} 