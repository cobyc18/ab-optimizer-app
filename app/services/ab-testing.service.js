import prisma from "../db.server.js";

class ABTestingService {
  /**
   * Log an A/B test event to the database
   */
  async logEvent({ testId, variant, eventType, productId, value, metadata = {} }) {
    try {
      console.log("🔍 ABTestingService: Logging event:", {
        testId,
        variant,
        eventType,
        productId,
        value
      });

      // Validate required fields
      if (!testId || !variant || !eventType || !productId) {
        throw new Error("Missing required fields: testId, variant, eventType, productId");
      }

      // Verify the test exists and is active
      const test = await prisma.aBTest.findUnique({
        where: { id: testId }
      });

      if (!test) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      if (test.status !== "running") {
        throw new Error(`A/B test is not running: ${testId}`);
      }

      // Validate and normalize variant
      const actualVariant = this.normalizeVariant(variant, test);
      
      // Create the event record
      const event = await prisma.aBEvent.create({
        data: {
          testId: testId,
          variant: actualVariant,
          eventType: eventType,
          productId: String(productId),
          value: value || null,
          metadata: {
            ...metadata,
            loggedAt: new Date().toISOString(),
            source: metadata.source || 'service'
          }
        }
      });

      console.log("✅ ABTestingService: Event logged successfully:", event.id);
      return event;

    } catch (error) {
      console.error("❌ ABTestingService: Error logging event:", error);
      throw error;
    }
  }

  /**
   * Normalize variant names (convert A/B to actual template names)
   */
  normalizeVariant(variant, test) {
    // Check if it's a generic A/B variant (A or B)
    if (variant === 'A' || variant === 'B') {
      const actualVariant = variant === 'A' ? test.templateA : test.templateB;
      console.log(`🔄 Converted generic variant '${variant}' to template name '${actualVariant}'`);
      return actualVariant;
    }
    
    // Check if it's an actual template name
    if (variant === test.templateA || variant === test.templateB) {
      return variant;
    }
    
    throw new Error(`Invalid variant: ${variant}. Expected: ${test.templateA}, ${test.templateB}, 'A', or 'B'`);
  }

  /**
   * Get active A/B test for a product
   */
  async getActiveTestForProduct(productId) {
    try {
      const activeTest = await prisma.aBTest.findFirst({
        where: {
          productId: String(productId),
          status: "running"
        }
      });

      return activeTest;
    } catch (error) {
      console.error("❌ ABTestingService: Error getting active test:", error);
      return null;
    }
  }

  /**
   * Process purchase event from webhook
   */
  async processPurchaseEvent({ orderData, shop }) {
    try {
      console.log("💰 ABTestingService: Processing purchase event");

      const { line_items, id: orderId, total_price, customer } = orderData;
      
      if (!line_items || line_items.length === 0) {
        console.log("⚠️ No line items found in order");
        return;
      }

      // Process each line item
      for (const lineItem of line_items) {
        const productId = String(lineItem.product_id);
        const quantity = lineItem.quantity || 1;
        const price = parseFloat(lineItem.price || 0);
        const totalPrice = price * quantity;

        console.log(`📦 Processing line item: Product ${productId}, Quantity ${quantity}, Price $${totalPrice}`);

        // Get active A/B test for this product
        const activeTest = await this.getActiveTestForProduct(productId);
        
        if (!activeTest) {
          console.log(`⏭️ No active A/B test found for product ${productId}`);
          continue;
        }

        // Check if we already logged a purchase event for this order/product combination
        const existingEvent = await prisma.aBEvent.findFirst({
          where: {
            testId: activeTest.id,
            eventType: "purchase",
            productId: productId,
            metadata: {
              path: ["orderId"],
              equals: orderId
            }
          }
        });

        if (existingEvent) {
          console.log(`🔄 Purchase event already logged for order ${orderId}, product ${productId}`);
          continue;
        }

        // Determine which variant the customer saw
        const variant = this.determineVariantFromOrder(orderData, activeTest);

        // Log the purchase event
        await this.logEvent({
          testId: activeTest.id,
          eventType: "purchase",
          productId: productId,
          variant: variant,
          value: totalPrice,
          metadata: {
            orderId: orderId,
            orderName: orderData.name,
            lineItemId: lineItem.id,
            variantId: lineItem.variant_id,
            quantity: quantity,
            unitPrice: price,
            totalPrice: totalPrice,
            customerEmail: customer?.email,
            customerId: customer?.id,
            financialStatus: orderData.financial_status,
            fulfillmentStatus: orderData.fulfillment_status,
            source: "webhook_purchase",
            shop: shop
          }
        });
      }

    } catch (error) {
      console.error("❌ ABTestingService: Error processing purchase event:", error);
      throw error;
    }
  }

  /**
   * Determine variant from order data
   */
  determineVariantFromOrder(orderData, activeTest) {
    console.log("🔍 Determining variant from order data...");
    console.log("Order note:", orderData.note);
    console.log("Order tags:", orderData.tags);
    console.log("Order note_attributes:", orderData.note_attributes);
    console.log("Active test templates:", activeTest.templateA, "vs", activeTest.templateB);

    // Method 1: Check order note for variant information
    if (orderData.note) {
      const variantMatch = orderData.note.match(/ab_variant:([AB])/i);
      if (variantMatch) {
        const variant = variantMatch[1].toUpperCase();
        console.log("✅ Found variant in order note:", variant);
        return variant;
      }
      
      // Check for template names in the note
      if (orderData.note.includes(activeTest.templateA)) {
        console.log("✅ Found template A in order note:", activeTest.templateA);
        return "A";
      } else if (orderData.note.includes(activeTest.templateB)) {
        console.log("✅ Found template B in order note:", activeTest.templateB);
        return "B";
      }
    }

    // Method 2: Check order tags for variant information
    if (orderData.tags) {
      const variantMatch = orderData.tags.match(/ab_variant:([AB])/i);
      if (variantMatch) {
        const variant = variantMatch[1].toUpperCase();
        console.log("✅ Found variant in order tags:", variant);
        return variant;
      }
      
      // Check for template names in tags
      if (orderData.tags.includes(activeTest.templateA)) {
        console.log("✅ Found template A in order tags:", activeTest.templateA);
        return "A";
      } else if (orderData.tags.includes(activeTest.templateB)) {
        console.log("✅ Found template B in order tags:", activeTest.templateB);
        return "B";
      }
    }

    // Method 3: Check order attributes for variant information
    if (orderData.note_attributes) {
      const variantAttr = orderData.note_attributes.find(attr => 
        attr.name && attr.name.toLowerCase().includes('ab_variant')
      );
      if (variantAttr && variantAttr.value) {
        const variant = variantAttr.value.toUpperCase();
        console.log("✅ Found variant in order attributes:", variant);
        return variant;
      }
      
      // Check for template names in attributes
      const templateAAttr = orderData.note_attributes.find(attr => 
        attr.value && attr.value.includes(activeTest.templateA)
      );
      if (templateAAttr) {
        console.log("✅ Found template A in order attributes:", activeTest.templateA);
        return "A";
      }
      
      const templateBAttr = orderData.note_attributes.find(attr => 
        attr.value && attr.value.includes(activeTest.templateB)
      );
      if (templateBAttr) {
        console.log("✅ Found template B in order attributes:", activeTest.templateB);
        return "B";
      }
    }

    // Method 4: Check for any other metadata that might contain variant info
    if (orderData.metadata) {
      console.log("Checking order metadata for variant info:", orderData.metadata);
      // Add any additional metadata checks here
    }

    // Method 5: Check for form fields that might have been added during checkout
    if (orderData.note_attributes) {
      const abVariantAttr = orderData.note_attributes.find(attr => 
        attr.name && attr.name.toLowerCase() === 'ab_variant'
      );
      if (abVariantAttr && abVariantAttr.value) {
        console.log("✅ Found ab_variant in note attributes:", abVariantAttr.value);
        return abVariantAttr.value.toUpperCase();
      }
      
      const abTestIdAttr = orderData.note_attributes.find(attr => 
        attr.name && attr.name.toLowerCase() === 'ab_test_id'
      );
      if (abTestIdAttr) {
        console.log("✅ Found ab_test_id in note attributes:", abTestIdAttr.value);
      }
    }

    // Method 6: Check for any custom fields that might contain variant info
    if (orderData.note) {
      // Look for any mention of the template names
      const templateAMatch = orderData.note.match(new RegExp(activeTest.templateA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      if (templateAMatch) {
        console.log("✅ Found template A in order note:", activeTest.templateA);
        return "A";
      }
      
      const templateBMatch = orderData.note.match(new RegExp(activeTest.templateB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      if (templateBMatch) {
        console.log("✅ Found template B in order note:", activeTest.templateB);
        return "B";
      }
    }

    // Default to variant A with warning
    console.log("⚠️ Could not determine variant from order, defaulting to A");
    console.log("Available order data:", {
      note: orderData.note,
      tags: orderData.tags,
      note_attributes: orderData.note_attributes,
      metadata: orderData.metadata
    });
    return "A";
  }

  /**
   * Get analytics data for a test
   */
  async getTestAnalytics(testId) {
    try {
      const [impressions, addToCart, checkoutInitiated, purchases, cartUpdates] = await Promise.all([
        prisma.aBEvent.count({
          where: { testId, eventType: "impression" }
        }),
        prisma.aBEvent.count({
          where: { testId, eventType: "add_to_cart" }
        }),
        prisma.aBEvent.count({
          where: { testId, eventType: "checkout_initiated" }
        }),
        prisma.aBEvent.count({
          where: { testId, eventType: "purchase" }
        }),
        prisma.aBEvent.count({
          where: { testId, eventType: "cart_updated" }
        })
      ]);

      const variantBreakdown = await prisma.aBEvent.groupBy({
        by: ["variant", "eventType"],
        where: { testId },
        _count: { id: true }
      });

      return {
        impressions,
        addToCart,
        checkoutInitiated,
        purchases,
        cartUpdates,
        variantBreakdown
      };
    } catch (error) {
      console.error("❌ ABTestingService: Error getting analytics:", error);
      throw error;
    }
  }
}

export default new ABTestingService(); 