import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const { testId, variant, eventType, productId, value, metadata } = body;

    console.log("🔍 A/B Event received:", {
      testId,
      variant,
      eventType,
      productId,
      value,
      metadata
    });

    // Validate required fields
    if (!testId || !variant || !eventType || !productId) {
      console.log("❌ Missing required fields");
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the test exists and is active
    const test = await prisma.aBTest.findUnique({
      where: { id: testId }
    });

    if (!test) {
      console.log("❌ A/B test not found:", testId);
      return json({ error: "A/B test not found" }, { status: 404 });
    }

    if (test.status !== "running") {
      console.log("❌ A/B test is not running:", testId);
      return json({ error: "A/B test is not running" }, { status: 400 });
    }

    // Validate variant
    if (variant !== test.templateA && variant !== test.templateB) {
      console.log("❌ Invalid variant:", variant);
      return json({ error: "Invalid variant" }, { status: 400 });
    }

    // Create the event record
    const event = await prisma.aBEvent.create({
      data: {
        testId: testId,
        variant: variant,
        eventType: eventType,
        productId: String(productId),
        value: value || null,
        metadata: metadata || {}
      }
    });

    console.log("✅ A/B event logged successfully:", event.id);

    return json({ 
      success: true, 
      eventId: event.id,
      message: `${eventType} event logged for variant ${variant}`
    });

  } catch (error) {
    console.error("❌ Error logging A/B event:", error);
    return json({ error: "Failed to log A/B event" }, { status: 500 });
  }
}; 