import { json } from "@remix-run/node";
import prisma from "../db.server";

// Add loader to handle OPTIONS requests (CORS preflight)
export const loader = async ({ request }) => {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // For GET requests, return a simple response
  return json({ message: "A/B Event endpoint - use POST to log events" }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};

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
      metadata,
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin')
    });

    // Validate required fields
    if (!testId || !variant || !eventType || !productId) {
      console.log("❌ Missing required fields");
      return json({ error: "Missing required fields" }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Verify the test exists and is active
    const test = await prisma.aBTest.findUnique({
      where: { id: testId }
    });

    if (!test) {
      console.log("❌ A/B test not found:", testId);
      return json({ error: "A/B test not found" }, { 
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (test.status !== "running") {
      console.log("❌ A/B test is not running:", testId);
      return json({ error: "A/B test is not running" }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Validate variant - accept both template names and generic A/B variants
    let validVariant = false;
    let actualVariant = variant;
    
    // Check if it's a generic A/B variant (A or B)
    if (variant === 'A' || variant === 'B') {
      // Convert generic variant to actual template name
      actualVariant = variant === 'A' ? test.templateA : test.templateB;
      console.log(`🔄 Converted generic variant '${variant}' to template name '${actualVariant}'`);
      validVariant = true;
    } else {
      // Check if it's an actual template name
      if (variant === test.templateA || variant === test.templateB) {
        validVariant = true;
      }
    }
    
    if (!validVariant) {
      console.log("❌ Invalid variant:", variant, "Expected:", test.templateA, "or", test.templateB, "or 'A' or 'B'");
      return json({ error: "Invalid variant" }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Create the event record
    const event = await prisma.aBEvent.create({
      data: {
        testId: testId,
        variant: actualVariant, // Use the actual variant name
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
      message: `${eventType} event logged for variant ${actualVariant}`
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("❌ Error logging A/B event:", error);
    return json({ error: "Failed to log A/B event" }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}; 