import { json } from "@remix-run/node";
import abTestingService from "../services/ab-testing.service.js";

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

    // Use the centralized service to log the event
    const event = await abTestingService.logEvent({
      testId,
      variant,
      eventType,
      productId,
      value,
      metadata: {
        ...metadata,
        source: 'client_api',
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin')
      }
    });

    return json({ 
      success: true, 
      eventId: event.id,
      message: `${eventType} event logged for variant ${event.variant}`
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("❌ Error logging A/B event:", error);
    return json({ 
      error: error.message || "Failed to log A/B event" 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}; 