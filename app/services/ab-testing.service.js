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
    // Method 1: Check order note for variant information
    if (orderData.note) {
      const variantMatch = orderData.note.match(/ab_variant:([AB])/i);
      if (variantMatch) {
        return variantMatch[1].toUpperCase();
      }
    }

    // Method 2: Check order tags for variant information
    if (orderData.tags) {
      const variantMatch = orderData.tags.match(/ab_variant:([AB])/i);
      if (variantMatch) {
        return variantMatch[1].toUpperCase();
      }
    }

    // Method 3: Check order attributes for variant information
    if (orderData.note_attributes) {
      const variantAttr = orderData.note_attributes.find(attr => 
        attr.name && attr.name.toLowerCase().includes('ab_variant')
      );
      if (variantAttr && variantAttr.value) {
        return variantAttr.value.toUpperCase();
      }
    }

    // Default to variant A
    console.log("⚠️ Could not determine variant from order, defaulting to A");
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