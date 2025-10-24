import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import React, { useState, useEffect } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

// ---------- Statistical Analysis Functions ----------
function betaSample(alpha, beta) {
  // Gamma sampler (Marsaglia-Tsang) for alpha >= 0. Note: works okay for integer+1 priors.
  function gammaSample(k) {
    if (k < 1) {
      // use boost for shape < 1
      const d = gammaSample(k + 1);
      return d * Math.pow(Math.random(), 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x = 0;
      // Normal(0,1) approx using Box-Muller
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
  let sumRelLift = 0; // (B - A) / A
  let sumAbsLift = 0; // (B - A)
  const relLifts = [];
  for (let i = 0; i < samples; i++) {
    const a = pA[i], b = pB[i];
    if (b > a) winsB++;
    if (a > b) winsA++;
    const abs = b - a;
    const rel = a === 0 ? null : abs / a;
    sumAbsLift += abs;
    sumRelLift += (rel === null ? 0 : rel);
    relLifts.push(rel);
  }
  const probB = winsB / samples;
  const probA = winsA / samples;
  const expAbsLift = sumAbsLift / samples;
  const expRelLift = sumRelLift / samples;

  // credible intervals for absolute lift
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

  // thresholds and minima per your notes
  const MODE = {
    fast: { threshold: 0.70, minN: 1, minDays: 0 }, // Lowered for testing
    standard: { threshold: 0.75, minN: 1, minDays: 0 }, // Lowered for testing
    careful: { threshold: 0.80, minN: 1, minDays: 0 } // Lowered for testing
  }[mode];

  // Build posteriors for both metrics: Beta(success+1, failures+1)
  const atcA_alpha = control.atcSuccesses + 1;
  const atcA_beta = (control.visits - control.atcSuccesses) + 1;
  const atcB_alpha = variant.atcSuccesses + 1;
  const atcB_beta = (variant.visits - variant.atcSuccesses) + 1;

  const purA_alpha = control.purchaseSuccesses + 1;
  const purA_beta = (control.visits - control.purchaseSuccesses) + 1;
  const purB_alpha = variant.purchaseSuccesses + 1;
  const purB_beta = (variant.visits - variant.purchaseSuccesses) + 1;

  // sample posteriors
  const atcSamples = samplePosteriors(atcA_alpha, atcA_beta, atcB_alpha, atcB_beta, samples);
  const purSamples = samplePosteriors(purA_alpha, purA_beta, purB_alpha, purB_beta, samples);

  const atcSummary = summarizeSamples(atcSamples.pA, atcSamples.pB);
  const purSummary = summarizeSamples(purSamples.pA, purSamples.pB);

  // combined / joint probability: fraction where EITHER purchase sample OR atc sample shows B > A
  let jointWins = 0;
  for (let i = 0; i < samples; i++) {
    if (purSamples.pB[i] > purSamples.pA[i] || atcSamples.pB[i] > atcSamples.pA[i]) jointWins++;
  }
  const probJoint = jointWins / samples;

  // Decide using the rules described earlier:
  const perVariantMinN = MODE.minN;
  const haveMinN = (control.visits >= perVariantMinN && variant.visits >= perVariantMinN);
  const haveMinDays = (daysRunning >= MODE.minDays);

  // Simple decision logic: prefer purchases. If purchases sparse, rely on ATC as fallback.
  let decision = 'no_clear_winner';
  const t = MODE.threshold;

  // Primary purchase-based rule
  if (haveMinN && haveMinDays) {
    if (purSummary.probB >= t && purSummary.expectedRelLift >= businessMDE) {
      decision = 'variant_wins_on_purchases';
    } else if (purSummary.probA >= t) {
      decision = 'control_wins_on_purchases';
    } else {
      // fallback: if purchases inconclusive but ATC strong
      if (atcSummary.probB >= t && atcSummary.expectedRelLift >= businessMDE) {
        decision = 'variant_likely_on_atc_but_purchases_inconclusive';
      }
    }
  } else {
    // insufficient purchases; use hybrid approach
    const lowerThreshold = Math.max(0.80, t - 0.05); // allow small relaxation
    if (purSummary.probB >= lowerThreshold && atcSummary.probB >= t) {
      decision = 'variant_probable_based_on_purchases_and_strong_atc';
    } else if (probJoint >= t) {
      decision = 'variant_probable_by_joint_metric';
    }
  }

  // build result object
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

// Figma Design Assets - Dashboard specific assets
const imgPlaceholder = "http://localhost:3845/assets/c9fc7d6b793322789590ccef37f7182244140e0c.png";
const imgLine59 = "http://localhost:3845/assets/e6acbfb8fe84220030b4f382c623d290af131b73.svg";
const imgLine60 = "http://localhost:3845/assets/6fdefdaad07bd3176f051dff8664b72fd8565c7f.svg";
const imgChart = "http://localhost:3845/assets/baf7e28d166b5b283321a852774ef1bdd14f27a6.svg";
const imgGraph = "http://localhost:3845/assets/9b9af956aa583e2a99412e20df5a9e75bf80fdde.svg";
const imgVector = "http://localhost:3845/assets/da7df0a45c49be40bfd8767d7103c37efb03f0d6.svg";
const imgVector1 = "http://localhost:3845/assets/7fe5008c9a6b1cdaf9549ca56f945723f1c85e3e.svg";
const imgVector2 = "http://localhost:3845/assets/5d87a99546af2943d8d4e590bffe963d4ba1d7d5.svg";
const imgVector3 = "http://localhost:3845/assets/8aeda563b5d07bb246e3269201982a2bf0695893.svg";
const imgVector4 = "http://localhost:3845/assets/2ae20abf3ffb8c7432949e47b2eddc72bfe88a95.svg";
const imgVector5 = "http://localhost:3845/assets/c2fb7636bba790f8abc5759046d31f9ff97d4089.svg";
const imgVector6 = "http://localhost:3845/assets/e31598c7df06d3cb5a36f62a3bdd510d4b822902.svg";
const imgFrame2147224432 = "http://localhost:3845/assets/ca4a9b03e163123f65241c5ace3845bafc2a1c4e.svg";
const imgLayer2 = "http://localhost:3845/assets/a9d2b4484df880300053ddc291d4b1508de9f48f.svg";
const imgFrame2147224435 = "http://localhost:3845/assets/452785d63818a5c8e8198f86e2110ab26729a23a.svg";
const img1 = "http://localhost:3845/assets/37f6433eecfe4bba5b55652b996eea8eaa31c272.svg";
const img2 = "http://localhost:3845/assets/aefdaaf09d8161efbb1ad9e2e4ead3a58332e535.svg";
const imgVector7 = "http://localhost:3845/assets/b1a8dd9dcb2f9bc57c5aee95b80168b4fe14075d.svg";
const imgVector8 = "http://localhost:3845/assets/df7e41cc4bc8037fa1f6aaf47c08634a8d8a9f77.svg";
const imgVector9 = "http://localhost:3845/assets/6b645facef47ae73e16a70930d235fb4da42ee2d.svg";
const imgAward = "http://localhost:3845/assets/ba2a64095bc32a278cda21c35ac6bfc74c380c27.svg";
const imgArrowDown2 = "http://localhost:3845/assets/7b59df041cbdc8736eebfca56f0496ca2e5e0b89.svg";
const imgLine62 = "http://localhost:3845/assets/bf7975f6f2b4c3943998210f73b65bf83b77b6df.svg";
const imgLine63 = "http://localhost:3845/assets/276e1036c5497ca9ab217e45810a262790fc3fbd.svg";
const img01IconsLineArrowCircleDownCopy = "http://localhost:3845/assets/70f910ecaf96baffa20bd5afa6db3cbfe4bbe132.svg";
const img01IconsLineArrowCircleDownCopy2 = "http://localhost:3845/assets/a937be020ad68012fc33358c50294cd0b9cca41c.svg";

// Figma Design Variables
const figmaColors = {
  black: "#202226",
  themeDark: "#464255",
  basicFill: "#C5CEE0",
  white: "#ffffff",
  blue: "#0038ff",
  lightBlue: "#97cdff",
  orange: "#ef9362",
  green: "#29ad00",
  yellow: "#f4b207",
  gray: "#e6e6e6",
  lightGray: "#84818a",
  darkGray: "#151515"
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    // Fetch all A/B tests to see what statuses exist
    const allTests = await prisma.aBTest.findMany({
      where: { shop: session.shop },
      orderBy: { startDate: 'desc' }
    });

    console.log(`🔍 Dashboard: Found ${allTests.length} total tests for shop ${session.shop}`);
    allTests.forEach(test => {
      console.log(`  Test: ${test.name}, Status: ${test.status}, Winner: ${test.winner}`);
    });

    // Fetch all A/B tests (both active and completed with winners)
    const allTests = await prisma.aBTest.findMany({
      where: { 
        shop: session.shop,
        status: { in: ['active', 'running', 'live', 'completed'] }
      },
      orderBy: { startDate: 'desc' }
    });

    console.log(`🔍 Dashboard: Found ${allTests.length} tests (active + completed)`);

    // For each test, get event data and analyze for winners
    const experimentsWithAnalysis = await Promise.all(
      allTests.map(async (test) => {
        // Get events for this test
        const events = await prisma.aBEvent.findMany({
          where: { testId: test.id },
          orderBy: { timestamp: 'asc' }
        });

        // Calculate metrics for each variant
        // Use the actual template names from the test configuration
        const controlEvents = events.filter(e => e.variant === test.templateA);
        const variantEvents = events.filter(e => e.variant === test.templateB);

        const controlVisits = controlEvents.filter(e => e.eventType === 'impression').length;
        const variantVisits = variantEvents.filter(e => e.eventType === 'impression').length;
        
        const controlAtc = controlEvents.filter(e => e.eventType === 'add_to_cart').length;
        const variantAtc = variantEvents.filter(e => e.eventType === 'add_to_cart').length;
        
        const controlPurchases = controlEvents.filter(e => e.eventType === 'purchase').length;
        const variantPurchases = variantEvents.filter(e => e.eventType === 'purchase').length;

        console.log(`🔍 Test ${test.id} (${test.name}):`);
        console.log(`  Template A: ${test.templateA}`);
        console.log(`  Template B: ${test.templateB}`);
        console.log(`  Total events: ${events.length}`);
        console.log(`  Control events: ${controlEvents.length} (variant: ${test.templateA})`);
        console.log(`  Variant events: ${variantEvents.length} (variant: ${test.templateB})`);
        console.log(`  Control: ${controlVisits} visits, ${controlAtc} ATC, ${controlPurchases} purchases`);
        console.log(`  Variant: ${variantVisits} visits, ${variantAtc} ATC, ${variantPurchases} purchases`);

        // Calculate days running
        const daysRunning = test.startDate ? 
          Math.floor((new Date() - new Date(test.startDate)) / (1000 * 60 * 60 * 24)) : 0;

        // Handle completed tests vs active tests
        let analysis = null;
        let winnerDeclared = false;
        
        if (test.status === 'completed' && test.winner) {
          // Test is already completed with a winner
          winnerDeclared = true;
          console.log(`✅ Test ${test.id} already completed with winner: ${test.winner}`);
          
          // Create a mock analysis for display purposes
          analysis = {
            decision: test.winner === 'A' ? 'control_winner' : 'variant_winner',
            purchases: {
              probB: test.winner === 'B' ? 0.95 : 0.05,
              expectedLift: test.winner === 'B' ? 0.15 : -0.15
            },
            atc: {
              probB: test.winner === 'B' ? 0.90 : 0.10,
              expectedLift: test.winner === 'B' ? 0.10 : -0.10
            }
          };
        } else if (controlVisits >= 1 && variantVisits >= 1) { // Lowered threshold for testing
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

          analysis = analyzeABDualMetric(testData);
          
          console.log(`🔍 Analysis for test ${test.id}:`);
          console.log(`  Decision: ${analysis.decision}`);
          console.log(`  Purchase prob B: ${(analysis.purchases.probB * 100).toFixed(1)}%`);
          console.log(`  ATC prob B: ${(analysis.atc.probB * 100).toFixed(1)}%`);
          
          // Check if we have a clear winner
          if (analysis.decision !== 'no_clear_winner') {
            winnerDeclared = true;
            console.log(`🎉 WINNER DECLARED for test ${test.id}: ${analysis.decision}`);
            
            // Update test status to completed with winner
            await prisma.aBTest.update({
              where: { id: test.id },
              data: { 
                status: 'completed',
                winner: analysis.decision.includes('variant') ? 'B' : 'A',
                endDate: new Date()
              }
            });
          } else {
            console.log(`⏳ No clear winner yet for test ${test.id}`);
          }
        }

        return {
          id: test.id,
          name: test.name,
          status: test.status,
          variantA: controlVisits,
          variantB: variantVisits,
          runtime: `${daysRunning}d`,
          goal: "95%",
          analysis: analysis,
          winnerDeclared: winnerDeclared,
          winner: test.winner || (winnerDeclared ? (analysis.decision.includes('variant') ? 'B' : 'A') : null)
        };
      })
    );

    // Get recent activities from database
    const recentActivities = await prisma.aBTest.findMany({
      where: { shop: session.shop },
      orderBy: { startDate: 'desc' },
      take: 6
    }).then(tests => {
      const activities = tests.map(test => ({
        action: test.status === 'completed' ? 
          `Winner Found: ${test.name}` : 
          test.status === 'active' ? 
          `Test Launched: ${test.name}` : 
          `Test ${test.status}: ${test.name}`,
        date: test.startDate.toLocaleDateString()
      }));
      
      // If no activities from database, add some default ones
      if (activities.length === 0) {
        return [
          { action: "Welcome to A/B Optimizer!", date: new Date().toLocaleDateString() },
          { action: "Ready to start your first test", date: new Date().toLocaleDateString() }
        ];
      }
      
      return activities;
    });

    return json({
      user: {
        name: "Zac",
        level: "Legend Scientist", 
        xp: 2100,
        maxXp: 3000
      },
      experiments: experimentsWithAnalysis,
      testCards: [
        { id: 1, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
        { id: 2, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
        { id: 3, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
        { id: 4, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" }
      ],
      queuedTests: [
        { name: "Shipping badge Design Test" },
        { name: "Feature Bullet Points Test" },
        { name: "Fomo Badge Test!" },
        { name: "Scarcity signals Test" },
        { name: "Shipping badge Design Test" },
        { name: "Shipping badge Design Test" }
      ],
      recentActivities: recentActivities,
      shop: session.shop
    });
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    return json({
      user: { name: "Zac", level: "Legend Scientist", xp: 2100, maxXp: 3000 },
      experiments: [],
      testCards: [
        { id: 1, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
        { id: 2, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
        { id: 3, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
        { id: 4, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" }
      ],
      queuedTests: [
        { name: "Shipping badge Design Test" },
        { name: "Feature Bullet Points Test" },
        { name: "Fomo Badge Test!" },
        { name: "Scarcity signals Test" },
        { name: "Shipping badge Design Test" },
        { name: "Shipping badge Design Test" }
      ],
      recentActivities: [
        { action: "Welcome to A/B Optimizer!", date: new Date().toLocaleDateString() },
        { action: "Ready to start your first test", date: new Date().toLocaleDateString() }
      ],
      shop: session.shop,
      error: "Failed to load dashboard data"
    });
  }
};

export default function Dashboard() {
  const { user, experiments, testCards, queuedTests, recentActivities, shop } = useLoaderData();
  const [expandedTests, setExpandedTests] = useState(new Set());

  const toggleTestExpansion = (testName) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testName)) {
      newExpanded.delete(testName);
    } else {
      newExpanded.add(testName);
    }
    setExpandedTests(newExpanded);
  };

  return (
    <div style={{ 
      padding: '40px 60px', 
      fontFamily: 'Inter, sans-serif', 
      backgroundColor: figmaColors.gray, 
      minHeight: 'calc(100vh - 80px)',
      maxWidth: '1400px',
      marginLeft: '60px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <p style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 400,
            fontSize: '44px',
            color: figmaColors.darkGray,
            margin: '0 0 10px 0'
          }}>
            Welcome Back, {user.name}
          </p>
          <p style={{
            fontSize: '16px',
            color: '#202020',
            margin: 0,
            lineHeight: '26px'
          }}>
            Ready to test and grow your business
          </p>
        </div>
        
        {/* New Experiment Button */}
        <button style={{
          backgroundColor: '#3e3bf3',
          border: 'none',
          borderRadius: '5px',
          padding: '12px 24px',
          cursor: 'pointer'
        }}>
          <p style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 500,
            fontSize: '14px',
            color: figmaColors.white,
            margin: 0
          }}>
            + New Experiment
          </p>
        </button>
      </div>

      {/* Winner Declaration Section - Only show when winners are declared */}
      {experiments.some(exp => exp.winnerDeclared) && (
        <div style={{
          backgroundColor: figmaColors.green,
          borderRadius: '20px',
          padding: '30px',
          marginBottom: '40px',
          border: '2px solid #1a7f1a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <img alt="Award" src={imgAward} style={{ width: '32px', height: '32px' }} />
            <h2 style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.white,
              margin: 0
            }}>
              🎉 Winners Declared!
            </h2>
          </div>
          
          {experiments.filter(exp => exp.winnerDeclared).map((experiment, index) => (
            <div key={index} style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: index < experiments.filter(exp => exp.winnerDeclared).length - 1 ? '15px' : '0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px',
                  color: figmaColors.white,
                  margin: 0
                }}>
                  {experiment.name}
                </h3>
                <div style={{
                  backgroundColor: figmaColors.white,
                  color: figmaColors.green,
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 600
                }}>
                  Winner: Variant {experiment.winner}
                </div>
              </div>
              
              {experiment.analysis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ color: figmaColors.white, margin: '0 0 5px 0', fontSize: '12px', opacity: 0.8 }}>Purchase Win Probability</p>
                    <p style={{ color: figmaColors.white, margin: 0, fontSize: '16px', fontWeight: 600 }}>
                      {(experiment.analysis.purchases.probB * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ color: figmaColors.white, margin: '0 0 5px 0', fontSize: '12px', opacity: 0.8 }}>Expected Lift</p>
                    <p style={{ color: figmaColors.white, margin: 0, fontSize: '16px', fontWeight: 600 }}>
                      +{(experiment.analysis.purchases.expectedRelLift * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ color: figmaColors.white, margin: '0 0 5px 0', fontSize: '12px', opacity: 0.8 }}>Total Visitors</p>
                    <p style={{ color: figmaColors.white, margin: 0, fontSize: '16px', fontWeight: 600 }}>
                      {experiment.analysis.control.visits + experiment.analysis.variant.visits}
                    </p>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ color: figmaColors.white, margin: '0 0 5px 0', fontSize: '12px', opacity: 0.8 }}>Decision</p>
                    <p style={{ color: figmaColors.white, margin: 0, fontSize: '14px', fontWeight: 500 }}>
                      {experiment.analysis.decision.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Experiment Overview Section */}
      <div style={{
        backgroundColor: figmaColors.lightBlue,
        borderRadius: '20px',
        padding: '40px',
        marginBottom: '40px',
        position: 'relative'
      }}>
        {/* Experiment Overview Text */}
        <div style={{ marginBottom: '30px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '24px',
            color: figmaColors.blue,
            margin: '0 0 15px 0',
            lineHeight: '32px'
          }}>
            Experiment Overview
          </p>
          <div>
            <span style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 500,
              fontSize: '20px',
              color: figmaColors.darkGray,
              lineHeight: '28px'
            }}>
              Returns badge is leading 7.4% ATC with 70% certainty.
            </span>
            <span style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              color: figmaColors.darkGray,
              lineHeight: '24px'
            }}>
              We suggest keeping the test active for a few more days to reach a more certain conclusion
            </span>
          </div>
        </div>

        {/* Chart Area with X/Y Axes */}
        <div style={{ marginBottom: '30px', position: 'relative' }}>
          {/* Chart Image */}
          <img alt="Chart" src={imgChart} style={{ width: '100%', maxWidth: '800px' }} />
          
          {/* Y-Axis Labels */}
          <div style={{
            position: 'absolute',
            left: '0px',
            top: '0px',
            display: 'flex',
            flexDirection: 'column',
            gap: '55px',
            alignItems: 'center',
            fontSize: '18px',
            color: 'rgba(21,21,21,0.7)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400
          }}>
            <p style={{ margin: 0 }}>5</p>
            <p style={{ margin: 0 }}>4</p>
            <p style={{ margin: 0 }}>3</p>
            <p style={{ margin: 0 }}>2</p>
            <p style={{ margin: 0 }}>1</p>
            <p style={{ margin: 0 }}>0</p>
          </div>
          
          {/* X-Axis Labels */}
          <div style={{
            position: 'absolute',
            bottom: '0px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '70px',
            alignItems: 'center',
            fontSize: '18px',
            color: 'rgba(21,21,21,0.7)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400
          }}>
            <p style={{ margin: 0 }}>JAN</p>
            <p style={{ margin: 0 }}>FEB</p>
            <p style={{ margin: 0 }}>MAR</p>
            <p style={{ margin: 0 }}>APR</p>
            <p style={{ margin: 0 }}>MAY</p>
            <p style={{ margin: 0 }}>JUN</p>
            <p style={{ margin: 0 }}>JUL</p>
            <p style={{ margin: 0 }}>AUG</p>
            <p style={{ margin: 0 }}>SEP</p>
            <p style={{ margin: 0 }}>OCT</p>
            <p style={{ margin: 0 }}>NOV</p>
            <p style={{ margin: 0 }}>DEC</p>
          </div>
        </div>

        {/* Experiment Title */}
        <div style={{ marginBottom: '30px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '24px',
            color: figmaColors.darkGray,
            margin: '0 0 20px 0',
            lineHeight: '32px'
          }}>
            Returns Badge VS Without
          </p>
          
          {/* Progress Line */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ width: '100%', height: '4px', backgroundColor: figmaColors.white, borderRadius: '2px', marginBottom: '10px' }}>
              <div style={{ width: '80%', height: '100%', backgroundColor: figmaColors.blue, borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: figmaColors.darkGray }}>
              <span>Goal: 80%</span>
              <span>80%</span>
            </div>
          </div>
        </div>

        {/* Stats and Action Buttons Row */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          {/* Stats */}
          <div style={{ 
            display: 'flex', 
            gap: '55px', 
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                color: figmaColors.darkGray,
                margin: 0,
                lineHeight: '38.704px'
              }}>
                48 h
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.blue,
                margin: 0
              }}>
                Total Run Time
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                color: figmaColors.darkGray,
                margin: 0
              }}>
                2,100
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.blue,
                margin: 0
              }}>
                Variant A
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                color: figmaColors.darkGray,
                margin: 0
              }}>
                2,160
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.blue,
                margin: 0
              }}>
                Variant B
              </p>
            </div>
          </div>

          {/* Action Buttons - Stacked Vertically */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '10px',
            width: '186px',
            height: '105px'
          }}>
            <button style={{
              backgroundColor: figmaColors.blue,
              borderRadius: '5px',
              border: 'none',
              padding: '12px 24px',
              cursor: 'pointer',
              height: '48px',
              flex: 1
            }}>
              <p style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                color: figmaColors.white,
                margin: 0
              }}>
                End Experiment
              </p>
            </button>
            <button style={{
              backgroundColor: figmaColors.lightBlue,
              border: `1px solid ${figmaColors.blue}`,
              borderRadius: '5px',
              padding: '12px 24px',
              cursor: 'pointer',
              height: '48px',
              flex: 1
            }}>
              <p style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                color: figmaColors.blue,
                margin: 0
              }}>
                View Story
              </p>
            </button>
          </div>
        </div>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#3d3af3', borderRadius: '4px', width: '16px', height: '16px' }} />
            <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '16px', color: figmaColors.themeDark, margin: 0 }}>
              Variant
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ backgroundColor: figmaColors.orange, borderRadius: '4px', width: '16px', height: '16px' }} />
            <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '16px', color: figmaColors.themeDark, margin: 0 }}>
              Control
            </p>
          </div>
        </div>
        
        {/* AutoPilot */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ width: '28px', height: '28px' }}>
            <img alt="Graph" src={imgGraph} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '16px', height: '16px' }}>
              <img alt="Vector" src={imgVector} style={{ width: '100%', height: '100%' }} />
            </div>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '16px',
              color: figmaColors.blue,
              margin: 0
            }}>
              AutoPilot On
            </p>
          </div>
        </div>
      </div>

      {/* Ideas To Try Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px' }}>
            <img alt="Frame" src={imgFrame2147224435} style={{ width: '100%', height: '100%' }} />
          </div>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.lightGray,
            margin: 0
          }}>
            Ideas To Try
          </p>
        </div>
        
        {/* Navigation Arrows */}
        <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
          <div style={{
            border: '0.714px solid #414042',
            borderRadius: '25px',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <div style={{ width: '22.857px', height: '22.857px' }}>
              <img alt="Arrow Left" src={img1} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          <div style={{
            border: '0.714px solid ' + figmaColors.blue,
            borderRadius: '25px',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <div style={{ width: '22.857px', height: '22.857px' }}>
              <img alt="Arrow Right" src={img2} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Test Cards */}
      <div style={{ display: 'flex', gap: '25px', marginBottom: '40px', overflowX: 'auto', paddingBottom: '10px', maxWidth: '100%' }}>
        {testCards.map((card, index) => (
          <div
            key={card.id}
            style={{
              backgroundColor: figmaColors.gray,
              border: `1px solid ${figmaColors.blue}`,
              borderRadius: '24px',
              padding: '40px',
              minWidth: '280px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              alignItems: 'flex-start',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '50px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'flex-start' }}>
                <div style={{ width: '280px', height: '200px', borderRadius: '10px', overflow: 'hidden' }}>
                  <img alt="Placeholder" src={imgPlaceholder} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
                  <p style={{
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 600,
                    fontSize: '24px',
                    color: figmaColors.darkGray,
                    margin: 0
                  }}>
                    {card.name}
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    lineHeight: '20px',
                    width: '280px'
                  }}>
                    {card.description}
                  </p>
                </div>
              </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '280px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ width: '68px', height: '68px' }}>
                    <img alt="Frame" src={imgFrame2147224432} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{
                    backgroundColor: figmaColors.yellow,
                    borderRadius: '20px',
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <p style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px',
                      color: figmaColors.yellow,
                      margin: 0,
                      letterSpacing: '0.4px'
                    }}>
                      {card.status}
                    </p>
                  </div>
                </div>
                <div style={{
                  border: `1px solid ${figmaColors.green}`,
                  borderRadius: '43px',
                  width: '68px',
                  height: '68px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}>
                  <div style={{ width: '28.544px', height: '24.013px' }}>
                    <img alt="Layer" src={imgLayer2} style={{ width: '100%', height: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: 0
          }}>
            Summary
          </p>
          <div style={{ cursor: 'pointer' }}>
            <p style={{
              fontFamily: 'SF Pro, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.blue,
              margin: 0,
              lineHeight: '24px'
            }}>
              View More
            </p>
          </div>
        </div>
        
        {/* Summary Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {/* Revenue Impact Card */}
          <div style={{
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '44px',
                color: '#14213d',
                margin: '0 0 10px 0',
                lineHeight: '32px'
              }}>
                +12%
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: '#14213d',
                margin: '0 0 15px 0',
                lineHeight: '20px'
              }}>
                Revenue Impact
              </p>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.blue,
                  margin: '0 0 5px 0'
                }}>
                  + 23%
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: '#14213d',
                  margin: 0
                }}>
                  This month
                </p>
              </div>
            </div>
            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '80px', height: '60px' }}>
              <img alt="Vector" src={imgVector7} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          
          {/* Total Test Ran Card */}
          <div style={{
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '44px',
                color: '#14213d',
                margin: '0 0 10px 0',
                lineHeight: '32px'
              }}>
                $ 15,221.00
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: '#14213d',
                margin: '0 0 15px 0',
                lineHeight: '20px'
              }}>
                Total Test Ran
              </p>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.blue,
                  margin: '0 0 5px 0'
                }}>
                  - 253%
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: '#14213d',
                  margin: 0
                }}>
                  This month
                </p>
              </div>
            </div>
            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '80px', height: '60px' }}>
              <img alt="Vector" src={imgVector8} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          
          {/* Total Tested Impressions Card */}
          <div style={{
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '44px',
                color: '#14213d',
                margin: '0 0 10px 0',
                lineHeight: '32px'
              }}>
                2,15,221
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: '#14213d',
                margin: '0 0 15px 0',
                lineHeight: '20px'
              }}>
                Total Tested Impressions
              </p>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.blue,
                  margin: '0 0 5px 0'
                }}>
                  + 250%
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: '#14213d',
                  margin: 0
                }}>
                  This month
                </p>
              </div>
            </div>
            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '80px', height: '60px' }}>
              <img alt="Vector" src={imgVector9} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          
          {/* Progress Card */}
          <div style={{
            backgroundColor: figmaColors.blue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ width: '24px', height: '24px' }}>
                <img alt="Award" src={imgAward} style={{ width: '100%', height: '100%' }} />
              </div>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: figmaColors.white,
                margin: 0,
                flex: 1
              }}>
                Your Progress
              </p>
              <div style={{ width: '16px', height: '16px' }}>
                <img alt="Arrow Down" src={imgArrowDown2} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
            
            <p style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.white,
              margin: '0 0 20px 0',
              lineHeight: '32px'
            }}>
              {user.level}
            </p>
            
            <div style={{ marginBottom: '10px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(user.xp / user.maxXp) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(to right, #97cdff 0%, #ef9362 85%)',
                  borderRadius: '4px'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '12px',
                  color: figmaColors.lightBlue,
                  margin: 0
                }}>
                  Level Progress
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: figmaColors.white,
                  margin: 0
                }}>
                  {user.xp} / {user.maxXp} XP
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities and Queued Ideas Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
        {/* Recent Activities */}
        <div style={{
          backgroundColor: '#d9d9d9',
          borderRadius: '20px',
          padding: '40px'
        }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: '0 0 25px 0'
          }}>
            Recent Activities
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {recentActivities.map((activity, index) => (
              <div key={index}>
                <div>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '16px',
                    color: figmaColors.darkGray,
                    margin: '0 0 5px 0',
                    lineHeight: '25.27px'
                  }}>
                    {activity.action}
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: figmaColors.lightGray,
                    margin: 0,
                    lineHeight: '22px'
                  }}>
                    {activity.date}
                  </p>
                </div>
                {index < recentActivities.length - 1 && (
                  <div style={{ width: '100%', height: '1px', margin: '15px 0' }}>
                    <img alt="Line" src={imgLine63} style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Queued Ideas */}
        <div>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: '0 0 30px 0'
          }}>
            Queued Ideas
          </p>

          {/* Queued Tests List */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.85)',
            border: `1px solid ${figmaColors.basicFill}`,
            borderRadius: '24px',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              backgroundColor: '#dbdbdb',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                margin: 0
              }}>
                Test Name
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                margin: 0
              }}>
                Action
              </p>
            </div>
            
            {/* Tests List */}
            <div style={{ padding: '20px' }}>
              {queuedTests.map((test, index) => (
                <div key={index}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '15px 10px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(0, 56, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => toggleTestExpansion(test.name)}
                  >
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '16px',
                      color: figmaColors.darkGray,
                      margin: 0,
                      lineHeight: '25.27px'
                    }}>
                      {test.name}
                    </p>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div style={{ width: '20px', height: '20px' }}>
                        <img alt="Arrow" src={img01IconsLineArrowCircleDownCopy} style={{ width: '100%', height: '100%' }} />
                      </div>
                      <div style={{ width: '20px', height: '20px' }}>
                        <img alt="Arrow" src={img01IconsLineArrowCircleDownCopy2} style={{ width: '100%', height: '100%' }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Separator */}
                  {index < queuedTests.length - 1 && (
                    <div style={{
                      width: '100%',
                      height: '1px',
                      backgroundColor: figmaColors.basicFill,
                      margin: '10px 0'
                    }} />
                  )}
                  
                  {/* Expanded Content */}
                  {expandedTests.has(test.name) && (
                    <div style={{
                      marginTop: '15px',
                      padding: '20px',
                      backgroundColor: 'rgba(0, 56, 255, 0.05)',
                      borderRadius: '12px',
                      border: `1px solid ${figmaColors.blue}`
                    }}>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: figmaColors.darkGray,
                        margin: '0 0 10px 0'
                      }}>
                        Test Details
                      </p>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: figmaColors.themeDark,
                        margin: 0,
                        lineHeight: '20px'
                      }}>
                        This test is queued and ready to be launched. Click to configure test parameters and start the experiment.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}