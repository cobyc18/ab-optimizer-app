import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const action = async ({ request }) => {
  try {
    console.log("🔔 ORDERS_CREATE WEBHOOK RECEIVED - START");
    
    // Clone the request to avoid "Body has already been read" error
    const clonedRequest = request.clone();
    const { topic, shop, session, admin } = await authenticate.webhook(request);

    if (!topic || !shop || !session) {
      console.error("❌ Webhook authentication failed");
      console.error("Topic:", topic);
      console.error("Shop:", shop);
      console.error("Session:", !!session);
      return json({ status: "error", message: "Authentication failed" }, { status: 401 });
    }

    console.log("✅ Webhook authentication successful");
    console.log("Shop:", shop);
    console.log("Topic:", topic);

    const payload = await clonedRequest.json();
    console.log("📦 Order payload received:");
    console.log("- Order ID:", payload.id);
    console.log("- Order Name:", payload.name);
    console.log("- Total Price:", payload.total_price);
    console.log("- Financial Status:", payload.financial_status);
    console.log("- Fulfillment Status:", payload.fulfillment_status);
    console.log("- Line Items Count:", payload.line_items?.length || 0);
    console.log("- Customer Email:", payload.email);
    console.log("- Customer ID:", payload.customer?.id);

    // Only process paid orders
    if (payload.financial_status !== "paid") {
      console.log("⏭️ Order not paid, skipping A/B test tracking");
      console.log("Financial status:", payload.financial_status);
      return json({ status: "skipped", reason: "order_not_paid" });
    }

    console.log("💰 Order is paid, processing line items...");

    // Process each line item in the order
    if (payload.line_items && payload.line_items.length > 0) {
      console.log(`📋 Processing ${payload.line_items.length} line items...`);
      
      for (const lineItem of payload.line_items) {
        const productId = lineItem.product_id;
        const variantId = lineItem.variant_id;
        const quantity = lineItem.quantity;
        const price = parseFloat(lineItem.price) || 0;
        const totalPrice = price * quantity;

        console.log(`\n🛍️ Processing line item:`);
        console.log("- Product ID:", productId);
        console.log("- Variant ID:", variantId);
        console.log("- Quantity:", quantity);
        console.log("- Unit Price:", price);
        console.log("- Total Price:", totalPrice);

        // Check if this product has an active A/B test
        let activeTest = null;
        try {
          console.log(`🔍 Checking for active A/B test for product ${productId}...`);
          activeTest = await prisma.aBTest.findFirst({
            where: {
              productId: String(productId),
              status: "running",
              startDate: { lte: new Date() },
              OR: [
                { endDate: null },
                { endDate: { gte: new Date() } }
              ]
            }
          });
          
          if (activeTest) {
            console.log(`✅ Found active A/B test:`, {
              testId: activeTest.id,
              testName: activeTest.name,
              templateA: activeTest.templateA,
              templateB: activeTest.templateB,
              status: activeTest.status
            });
          } else {
            console.log(`❌ No active A/B test found for product ${productId}`);
          }
        } catch (prismaError) {
          console.error(`❌ Error querying A/B test for product ${productId}:`, prismaError);
          continue; // Skip this line item if we can't query the database
        }

        if (activeTest) {
          console.log(`Found active A/B test for product ${productId}:`, activeTest.id);

          // Determine which variant the customer saw
          // We'll need to use a fallback method since we don't have direct access to the customer's session
          // For now, we'll use a simple heuristic or store this information in the order metadata
          
          let variant = activeTest.templateA; // Default to template A
          
          // Check if there's any metadata or note that indicates which variant was shown
          if (payload.note) {
            // Look for template names in the note
            if (payload.note.includes(activeTest.templateA)) {
              variant = activeTest.templateA;
            } else if (payload.note.includes(activeTest.templateB)) {
              variant = activeTest.templateB;
            } else {
              // Fallback to generic A/B detection
              const variantMatch = payload.note.match(/ab_variant[:\s]+([AB])/i);
              if (variantMatch) {
                variant = variantMatch[1].toUpperCase() === 'A' ? activeTest.templateA : activeTest.templateB;
              }
            }
          }

          // Check note attributes for variant information
          if (payload.note_attributes) {
            const variantAttr = payload.note_attributes.find(attr => 
              attr.name && attr.name.toLowerCase().includes('ab_variant')
            );
            if (variantAttr && variantAttr.value) {
              if (variantAttr.value.includes(activeTest.templateA)) {
                variant = activeTest.templateA;
              } else if (variantAttr.value.includes(activeTest.templateB)) {
                variant = activeTest.templateB;
              } else {
                // Fallback to generic A/B detection
                variant = variantAttr.value.toUpperCase() === 'A' ? activeTest.templateA : activeTest.templateB;
              }
            }
          }

          // Check tags for variant information
          if (payload.tags) {
            const variantTag = payload.tags.split(',').find(tag => 
              tag.trim().toLowerCase().includes('ab_variant')
            );
            if (variantTag) {
              if (variantTag.includes(activeTest.templateA)) {
                variant = activeTest.templateA;
              } else if (variantTag.includes(activeTest.templateB)) {
                variant = activeTest.templateB;
              } else {
                // Fallback to generic A/B detection
                const variantMatch = variantTag.match(/ab_variant[:\s]+([AB])/i);
                if (variantMatch) {
                  variant = variantMatch[1].toUpperCase() === 'A' ? activeTest.templateA : activeTest.templateB;
                }
              }
            }
          }

          console.log(`🎯 Determined variant: ${variant}`);

          // Log the purchase event
          try {
            console.log(`💾 Creating purchase event in database...`);
            const purchaseEvent = await prisma.aBEvent.create({
              data: {
                testId: activeTest.id,
                eventType: "purchase",
                productId: String(productId),
                variant: variant,
                value: totalPrice,
                metadata: {
                  orderId: payload.id,
                  orderName: payload.name,
                  lineItemId: lineItem.id,
                  variantId: variantId,
                  quantity: quantity,
                  unitPrice: price,
                  totalPrice: totalPrice,
                  customerEmail: payload.email,
                  customerId: payload.customer?.id,
                  financialStatus: payload.financial_status,
                  fulfillmentStatus: payload.fulfillment_status,
                  source: "webhook_orders_create",
                  webhookReceivedAt: new Date().toISOString()
                }
              }
            });

            console.log(`✅ Successfully logged purchase event:`, {
              eventId: purchaseEvent.id,
              testId: activeTest.id,
              productId: productId,
              variant: variant,
              value: totalPrice
            });

            // Trigger winner analysis after purchase event
            try {
              console.log(`🔍 Triggering winner analysis for test ${activeTest.id}`);
              const analysisResponse = await fetch(`${process.env.APPLICATION_URL || 'https://ab-optimizer-app.onrender.com'}/webhooks/analyze-winner`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.accessToken}`
                },
                body: JSON.stringify({ testId: activeTest.id })
              });
              
              if (analysisResponse.ok) {
                const analysisResult = await analysisResponse.json();
                if (analysisResult.status === 'winner_declared') {
                  console.log(`🎉 WINNER DECLARED: ${analysisResult.winner} for test ${activeTest.id}`);
                }
              }
            } catch (analysisError) {
              console.error(`❌ Error triggering winner analysis:`, analysisError);
            }
          } catch (purchaseError) {
            console.error(`❌ Error logging purchase event for product ${productId}:`, purchaseError);
            console.error("Error details:", {
              message: purchaseError.message,
              code: purchaseError.code,
              meta: purchaseError.meta
            });
          }
        } else {
          console.log(`⏭️ No active A/B test found for product ${productId}, skipping purchase tracking`);
        }
      }
    } else {
      console.log("⚠️ No line items found in order, skipping A/B test tracking");
    }

    console.log("🎉 ORDERS_CREATE WEBHOOK PROCESSING COMPLETE");
    return json({ status: "success" });

  } catch (error) {
    console.error("💥 Error processing ORDERS_CREATE webhook:", error);
    console.error("Error stack:", error.stack);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}; 