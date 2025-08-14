import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ request }) {
  console.log("🔍 A/B Test Public API GET called:", request.url);
  return json({ 
    message: "A/B Test Public API is working", 
    timestamp: new Date().toISOString()
  });
}

export async function action({ request }) {
  console.log("🔍 A/B Test Public API called:", request.url);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const action = formData.get("action");
  const productId = formData.get("productId");
  const variant = formData.get("variant");
  const testId = formData.get("testId");
  const eventType = formData.get("eventType");

  console.log("📝 Public API Request data:", { action, productId, variant, testId, eventType });

  try {
    switch (action) {
      case "getTest":
        console.log("🔍 Getting test for product:", productId);
        
        // Validate product ID exists
        if (!productId) {
          return json({ error: "Product ID is required" }, { status: 400 });
        }
        
        // Get A/B test for a product (productId is stored as string in DB)
        const test = await prisma.aBTest.findFirst({
          where: {
            productId: productId.toString(), // Ensure it's a string
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
        
        console.log("📊 Found test:", test);
        
        if (!test) {
          return json({ test: null });
        }

        // Determine variant based on traffic split
        const random = Math.random() * 100;
        const variant = random <= test.trafficSplit ? "A" : "B";
        
        console.log("🎯 Selected variant:", variant);
        
        return json({ 
          test: {
            ...test,
            variant,
            template: variant === "A" ? test.templateA : test.templateB
          }
        });

      case "logEvent":
        console.log("📝 Logging event:", { testId, eventType, variant, productId });
        
        // Validate required fields
        if (!testId || !eventType) {
          return json({ error: "Test ID and event type are required" }, { status: 400 });
        }
        
        // Validate event type
        const validEventTypes = ['impression', 'add_to_cart', 'cart_update', 'checkout_initiated', 'purchase'];
        if (!validEventTypes.includes(eventType)) {
          return json({ error: "Invalid event type" }, { status: 400 });
        }
        
        // Log A/B test event
        await prisma.aBEvent.create({
          data: {
            testId: testId,
            eventType,
            variant: variant || "A",
            productId: productId ? productId.toString() : "", // Ensure it's a string
            timestamp: new Date()
          }
        });
        
        console.log("✅ Event logged successfully");
        return json({ success: true });

      case "getVariant":
        console.log("🎯 Getting variant for test:", testId);
        
        // Validate test ID exists
        if (!testId) {
          return json({ error: "Test ID is required" }, { status: 400 });
        }
        
        // Get variant for a specific test
        const variantTest = await prisma.aBTest.findUnique({
          where: { id: testId },
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
        
        console.log("🎯 Selected variant:", selectedVariant);
        
        return json({
          variant: selectedVariant,
          template: selectedVariant === "A" ? variantTest.templateA : variantTest.templateB
        });

      default:
        console.log("❌ Invalid action:", action);
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("❌ A/B Test Public API Error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
} 