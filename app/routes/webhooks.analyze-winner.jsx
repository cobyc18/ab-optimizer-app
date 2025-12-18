import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
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
    
    const { session, admin } = await authenticate.admin(request);
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
          winner: winner
        }
      });

      console.log(`🎉 WINNER DECLARED for test ${testId}: Variant ${winner}`);
      console.log(`Decision: ${analysis.decision}`);
      console.log(`Purchase win probability: ${(analysis.purchases.probB * 100).toFixed(1)}%`);
      console.log(`Expected lift: ${(analysis.purchases.expectedRelLift * 100).toFixed(1)}%`);

      // If variant wins, assign product to variant template
      // If control wins, do nothing (product is already on control template)
      if (winner === 'B') {
        try {
          const variantTemplateSuffix = test.templateB === "default" ? null : test.templateB;
          
          // Handle productId format - could be numeric or GID
          const productGid = test.productId.startsWith('gid://')
            ? test.productId
            : `gid://shopify/Product/${test.productId}`;
          
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
            console.error("⚠️ GraphQL errors assigning product template to variant:", result.errors);
          } else {
            const userErrors = result.data?.productUpdate?.userErrors || [];
            if (userErrors.length > 0) {
              console.error("⚠️ User errors assigning product template to variant:", userErrors);
            } else {
              console.log(`✅ Product ${test.productId} assigned to variant template: ${test.templateB}`);
            }
          }
        } catch (error) {
          console.error("⚠️ Failed to assign product template to variant:", error);
          // Don't fail the webhook if template assignment fails - winner is already recorded
        }
      } else {
        console.log(`ℹ️ Control won - product remains on control template (no assignment needed)`);
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
