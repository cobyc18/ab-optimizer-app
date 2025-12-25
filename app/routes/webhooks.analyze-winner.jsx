import { json } from "@remix-run/node";
import { authenticate, sessionStorage } from "../shopify.server.js";
import shopify from "../shopify.server.js";
import prisma from "../db.server.js";

// ---------- Statistical Analysis Functions ----------
function betaSample(alpha, beta) {
  function gammaSample(k) {
    if (k < 1) {
      const d = gammaSample(k + 1);
      return d * Math.pow(Math.random(), 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x = 0;
      const u1 = Math.random();
      const u2 = Math.random();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const v = 1 + c * x;
      if (v <= 0) continue;
      const v3 = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.331 * (x * x * x * x)) return d * v3;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v3 + Math.log(v3))) return d * v3;
    }
  }
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

function samplePosteriors(bsA, btA, bsB, btB, samples = 10000) {
  const pA = new Array(samples);
  const pB = new Array(samples);
  for (let i = 0; i < samples; i++) {
    pA[i] = betaSample(bsA, btA);
    pB[i] = betaSample(bsB, btB);
  }
  return { pA, pB };
}

function summarizeSamples(pA, pB) {
  const samples = pA.length;
  let winsB = 0, winsA = 0;
  let sumRelLift = 0;
  let sumAbsLift = 0;
  for (let i = 0; i < samples; i++) {
    const a = pA[i], b = pB[i];
    if (b > a) winsB++;
    if (a > b) winsA++;
    const abs = b - a;
    const rel = a === 0 ? null : abs / a;
    sumAbsLift += abs;
    sumRelLift += (rel === null ? 0 : rel);
  }
  const probB = winsB / samples;
  const probA = winsA / samples;
  const expAbsLift = sumAbsLift / samples;
  const expRelLift = sumRelLift / samples;

  const absSamples = new Array(samples);
  for (let i = 0; i < samples; i++) absSamples[i] = pB[i] - pA[i];
  absSamples.sort((x, y) => x - y);
  const ciLow = absSamples[Math.floor(samples * 0.025)];
  const ciHigh = absSamples[Math.floor(samples * 0.975)];

  return {
    probB,
    probA,
    expectedAbsLift: expAbsLift,
    expectedRelLift: expRelLift,
    ci95: [ciLow, ciHigh],
  };
}

function analyzeABDualMetric(input) {
  const { control, variant, mode = 'standard', daysRunning = 0, samples = 10000, businessMDE = 0.0 } = input;

  const MODE = {
    fast: { threshold: 0.70, minN: 1, minDays: 0 }, // Lowered for testing
    standard: { threshold: 0.75, minN: 1, minDays: 0 }, // Lowered for testing
    careful: { threshold: 0.80, minN: 1, minDays: 0 } // Lowered for testing
  }[mode];

  const atcA_alpha = control.atcSuccesses + 1;
  const atcA_beta = (control.visits - control.atcSuccesses) + 1;
  const atcB_alpha = variant.atcSuccesses + 1;
  const atcB_beta = (variant.visits - variant.atcSuccesses) + 1;

  const purA_alpha = control.purchaseSuccesses + 1;
  const purA_beta = (control.visits - control.purchaseSuccesses) + 1;
  const purB_alpha = variant.purchaseSuccesses + 1;
  const purB_beta = (variant.visits - variant.purchaseSuccesses) + 1;

  const atcSamples = samplePosteriors(atcA_alpha, atcA_beta, atcB_alpha, atcB_beta, samples);
  const purSamples = samplePosteriors(purA_alpha, purA_beta, purB_alpha, purB_beta, samples);

  const atcSummary = summarizeSamples(atcSamples.pA, atcSamples.pB);
  const purSummary = summarizeSamples(purSamples.pA, purSamples.pB);

  let jointWins = 0;
  for (let i = 0; i < samples; i++) {
    if (purSamples.pB[i] > purSamples.pA[i] || atcSamples.pB[i] > atcSamples.pA[i]) jointWins++;
  }
  const probJoint = jointWins / samples;

  const perVariantMinN = MODE.minN;
  const haveMinN = (control.visits >= perVariantMinN && variant.visits >= perVariantMinN);
  const haveMinDays = (daysRunning >= MODE.minDays);

  let decision = 'no_clear_winner';
  const t = MODE.threshold;

  if (haveMinN && haveMinDays) {
    if (purSummary.probB >= t && purSummary.expectedRelLift >= businessMDE) {
      decision = 'variant_wins_on_purchases';
    } else if (purSummary.probA >= t) {
      decision = 'control_wins_on_purchases';
    } else {
      if (atcSummary.probB >= t && atcSummary.expectedRelLift >= businessMDE) {
        decision = 'variant_likely_on_atc_but_purchases_inconclusive';
      }
    }
  } else {
    const lowerThreshold = Math.max(0.80, t - 0.05);
    if (purSummary.probB >= lowerThreshold && atcSummary.probB >= t) {
      decision = 'variant_probable_based_on_purchases_and_strong_atc';
    } else if (probJoint >= t) {
      decision = 'variant_probable_by_joint_metric';
    }
  }

  return {
    mode,
    daysRunning,
    control,
    variant,
    atc: {
      probB: atcSummary.probB,
      expectedAbsLift: atcSummary.expectedAbsLift,
      expectedRelLift: atcSummary.expectedRelLift,
      ci95: atcSummary.ci95,
      totals: { control_visits: control.visits, variant_visits: variant.visits }
    },
    purchases: {
      probB: purSummary.probB,
      expectedAbsLift: purSummary.expectedAbsLift,
      expectedRelLift: purSummary.expectedRelLift,
      ci95: purSummary.ci95,
      totals: { control_visits: control.visits, variant_visits: variant.visits }
    },
    joint: {
      probJoint
    },
    decision,
    haveMinN,
    haveMinDays
  };
}

export const action = async ({ request }) => {
  try {
    console.log("🔍 ANALYZE WINNER WEBHOOK TRIGGERED");
    
    let session, admin;
    try {
      const authResult = await authenticate.admin(request);
      session = authResult.session;
      admin = authResult.admin;
    } catch (authError) {
      // If admin auth fails (e.g., called via fetch without proper session),
      // we'll get the shop from the test record and use that
      console.log("⚠️ Admin authentication failed, will use shop from test record:", authError.message);
    }
    
    const { testId } = await request.json();

    if (!testId) {
      return json({ error: "testId is required" }, { status: 400 });
    }

    // Get the test
    const test = await prisma.aBTest.findUnique({
      where: { id: testId }
    });

    if (!test || test.status !== 'active') {
      console.log(`Test ${testId} not found or not active`);
      return json({ status: "skipped", reason: "test_not_active" });
    }

    // Get events for this test
    const events = await prisma.aBEvent.findMany({
      where: { testId: test.id },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate metrics for each variant
    const controlEvents = events.filter(e => e.variant === 'A');
    const variantEvents = events.filter(e => e.variant === 'B');

    const controlVisits = controlEvents.filter(e => e.eventType === 'impression').length;
    const variantVisits = variantEvents.filter(e => e.eventType === 'impression').length;
    
    const controlAtc = controlEvents.filter(e => e.eventType === 'add_to_cart').length;
    const variantAtc = variantEvents.filter(e => e.eventType === 'add_to_cart').length;
    
    const controlPurchases = controlEvents.filter(e => e.eventType === 'purchase').length;
    const variantPurchases = variantEvents.filter(e => e.eventType === 'purchase').length;

    // Only analyze if we have minimum data (lowered for testing)
    if (controlVisits < 1 || variantVisits < 1) {
      console.log(`Insufficient data for test ${testId}: ${controlVisits} vs ${variantVisits} visits`);
      return json({ status: "skipped", reason: "insufficient_data" });
    }

    // Calculate days running
    const daysRunning = test.createdAt ? 
      Math.floor((new Date() - new Date(test.createdAt)) / (1000 * 60 * 60 * 24)) : 0;

    // Analyze for winner
    const testData = {
      control: {
        visits: controlVisits,
        atcSuccesses: controlAtc,
        purchaseSuccesses: controlPurchases
      },
      variant: {
        visits: variantVisits,
        atcSuccesses: variantAtc,
        purchaseSuccesses: variantPurchases
      },
      mode: 'standard',
      daysRunning: daysRunning,
      businessMDE: 0.05
    };

    const analysis = analyzeABDualMetric(testData);
    
    console.log(`Analysis for test ${testId}:`, {
      decision: analysis.decision,
      purchaseProbB: analysis.purchases.probB,
      atcProbB: analysis.atc.probB,
      haveMinN: analysis.haveMinN,
      haveMinDays: analysis.haveMinDays
    });

    // Check if we have a clear winner
    if (analysis.decision !== 'no_clear_winner') {
      const winner = analysis.decision.includes('variant') ? 'B' : 'A';
      
      // Update test status to completed with winner
      await prisma.aBTest.update({
        where: { id: test.id },
        data: { 
          status: 'completed',
          winner: winner,
          endDate: new Date()
        }
      });

      console.log(`🎉 WINNER DECLARED for test ${testId}: Variant ${winner}`);
      console.log(`Decision: ${analysis.decision}`);
      console.log(`Purchase win probability: ${(analysis.purchases.probB * 100).toFixed(1)}%`);
      console.log(`Expected lift: ${(analysis.purchases.expectedRelLift * 100).toFixed(1)}%`);

      // If variant (B) wins, assign the product to the variant template
      // If control (A) wins, no assignment needed - product is already on control template
      if (winner === 'B') {
        try {
          // If we don't have admin client from authentication, get it from the shop's session
          if (!admin) {
            console.log(`⚠️ No admin client from auth, loading session for shop: ${test.shop}`);
            
            // Try to get session from database (Session table)
            const dbSession = await prisma.session.findFirst({
              where: { shop: test.shop },
              orderBy: { expires: 'desc' }
            });
            
            if (dbSession && dbSession.accessToken) {
              // Create session object from database record
              const sessionData = {
                id: dbSession.id,
                shop: dbSession.shop,
                state: dbSession.state,
                isOnline: dbSession.isOnline || false,
                accessToken: dbSession.accessToken,
                scope: dbSession.scope || "",
              };
              
              admin = shopify.clients.graphql({ session: sessionData });
              console.log(`✅ Created admin client from database session for shop: ${test.shop}`);
            } else {
              // Fallback: get shop record and create session manually
              const shopRecord = await prisma.shop.findUnique({
                where: { shop: test.shop }
              });
              
              if (!shopRecord || !shopRecord.accessToken) {
                throw new Error(`No session or shop record found for shop: ${test.shop}`);
              }
              
              // Create a session object from shop record
              const sessionData = {
                id: `offline_${test.shop}`,
                shop: test.shop,
                state: "",
                isOnline: false,
                accessToken: shopRecord.accessToken,
                scope: shopRecord.scope || "",
              };
              
              admin = shopify.clients.graphql({ session: sessionData });
              console.log(`✅ Created admin client from shop record for shop: ${test.shop}`);
            }
          }
          
          // Convert numeric productId to GraphQL GID format
          // Database stores productId as numeric (e.g., "123456789")
          // GraphQL needs GID format (e.g., "gid://shopify/Product/123456789")
          let productGid = test.productId;
          if (!productGid.startsWith('gid://')) {
            // Extract numeric ID if it's in format like "gid://shopify/Product/123456789" or just "123456789"
            const numericId = productGid.match(/Product\/(\d+)/)?.[1] || productGid.match(/^(\d+)$/)?.[1] || productGid;
            productGid = `gid://shopify/Product/${numericId}`;
          }
          
          // Get the variant template suffix (templateB)
          // Handle "default" template suffix - convert to null for GraphQL
          const variantTemplateSuffix = test.templateB === 'default' ? null : test.templateB;
          
          console.log(`🔄 Attempting to assign variant template to product:`, {
            productId: test.productId,
            productGid: productGid,
            templateB: test.templateB,
            variantTemplateSuffix: variantTemplateSuffix,
            testId: test.id,
            testName: test.name
          });
          
          const mutation = `
            mutation assignTemplate($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                  templateSuffix
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          const response = await admin.graphql(mutation, {
            variables: {
              input: {
                id: productGid,
                templateSuffix: variantTemplateSuffix
              }
            }
          });

          const result = await response.json();

          if (result.errors?.length) {
            console.error("❌ GraphQL errors assigning variant template to product:", result.errors);
            console.error("❌ Full GraphQL response:", JSON.stringify(result, null, 2));
            } else {
              const userErrors = result.data?.productUpdate?.userErrors || [];
              if (userErrors.length > 0) {
                console.error("❌ User errors assigning variant template to product:", userErrors);
                console.error("❌ Full GraphQL response:", JSON.stringify(result, null, 2));
              } else {
                const updatedProduct = result.data?.productUpdate?.product;
                console.log(`✅ Successfully assigned product to variant template:`, {
                  templateB: test.templateB,
                  productId: updatedProduct?.id,
                  newTemplateSuffix: updatedProduct?.templateSuffix
                });
                
                // Keep the metafield set to true so widget remains visible on live storefront
                // since the variant template (with widget) is now the live template
                try {
                  const metafieldMutation = `
                    mutation productUpdateMetafield($metafields: [MetafieldsSetInput!]!) {
                      metafieldsSet(metafields: $metafields) {
                        metafields {
                          id
                          namespace
                          key
                          value
                        }
                        userErrors {
                          field
                          message
                        }
                      }
                    }
                  `;
                  
                  const metafieldResponse = await admin.graphql(metafieldMutation, {
                    variables: {
                      metafields: [
                        {
                          ownerId: productGid,
                          namespace: "ab_optimizer",
                          key: "test_running",
                          type: "boolean",
                          value: "true"
                        }
                      ]
                    }
                  });
                  
                  const metafieldResult = await metafieldResponse.json();
                  if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
                    console.error("⚠️ Metafield user errors:", metafieldResult.data.metafieldsSet.userErrors);
                  } else {
                    console.log("✅ Kept product metafield: ab_optimizer.test_running = true (variant won, widget now live)");
                  }
                } catch (metafieldError) {
                  console.error("⚠️ Failed to update metafield after variant win:", metafieldError);
                }
              }
            }
          } catch (assignError) {
            console.error("❌ Error assigning variant template to product after winner declaration:", assignError);
            console.error("❌ Error stack:", assignError.stack);
            // Don't fail the webhook if assignment fails - log and continue
          }
      } else {
        console.log(`ℹ️ Control (A) won - product remains on control template (no assignment needed)`);
      }

      return json({ 
        status: "winner_declared", 
        winner: winner,
        decision: analysis.decision,
        analysis: analysis
      });
    } else {
      console.log(`No clear winner yet for test ${testId}`);
      return json({ 
        status: "no_winner", 
        analysis: analysis 
      });
    }

  } catch (error) {
    console.error("Error in analyze-winner webhook:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
};
