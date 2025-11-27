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
    fast: { threshold: 0.55, minN: 1, minDays: 0 },
    standard: { threshold: 0.58, minN: 1, minDays: 0 },
    careful: { threshold: 0.65, minN: 1, minDays: 0 }
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

// Figma Design Assets - Dashboard specific assets (using inline SVG data URIs)
const imgPlaceholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect width='200' height='150' fill='%23e6e6e6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%2384818a' font-family='Arial' font-size='14'%3EPlaceholder%3C/text%3E%3C/svg%3E";
const imgLine59 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M3 12h18M12 3l9 9-9 9' stroke='%23151515' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const imgLine60 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M21 12H3M12 21l-9-9 9-9' stroke='%23151515' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const imgChart = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='300'%3E%3Crect width='800' height='300' fill='%23ffffff'/%3E%3Cline x1='50' y1='250' x2='750' y2='250' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cline x1='50' y1='250' x2='50' y2='50' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cpolyline points='100,200 200,180 300,150 400,120 500,100 600,90 700,80' fill='none' stroke='%230038ff' stroke-width='3'/%3E%3C/svg%3E";
const imgGraph = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='300'%3E%3Crect width='800' height='300' fill='%23ffffff'/%3E%3Cline x1='50' y1='250' x2='750' y2='250' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cline x1='50' y1='250' x2='50' y2='50' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cpolyline points='100,200 200,180 300,150 400,120 500,100 600,90 700,80' fill='none' stroke='%230038ff' stroke-width='3'/%3E%3C/svg%3E";
const imgVector = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M20 40 L40 20 L60 40' stroke='%230038ff' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const imgVector1 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M20 20 L40 40 L60 20' stroke='%230038ff' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const imgVector2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Ccircle cx='40' cy='30' r='15' fill='%230038ff' opacity='0.3'/%3E%3Ccircle cx='40' cy='30' r='8' fill='%230038ff'/%3E%3C/svg%3E";
const imgVector3 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect x='20' y='15' width='40' height='30' rx='5' fill='%230038ff' opacity='0.3'/%3E%3Crect x='30' y='20' width='20' height='20' rx='3' fill='%230038ff'/%3E%3C/svg%3E";
const imgVector4 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M40 10 L50 30 L30 30 Z' fill='%230038ff'/%3E%3Crect x='35' y='30' width='10' height='20' fill='%230038ff'/%3E%3C/svg%3E";
const imgVector5 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M20 30 Q40 10 60 30' stroke='%230038ff' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const imgVector6 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M20 20 L40 40 L60 20' stroke='%230038ff' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const imgFrame2147224432 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect x='4' y='4' width='16' height='16' rx='2' fill='%23f4b207'/%3E%3Cpath d='M8 12h8M12 8v8' stroke='%23ffffff' stroke-width='2'/%3E%3C/svg%3E";
const imgLayer2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect x='4' y='4' width='16' height='16' rx='2' fill='%2329ad00'/%3E%3Cpath d='M8 12h8M12 8v8' stroke='%23ffffff' stroke-width='2'/%3E%3C/svg%3E";
const imgFrame2147224435 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%230038ff'/%3E%3Cpath d='M8 12h8M12 8v8' stroke='%23ffffff' stroke-width='1.5'/%3E%3C/svg%3E";
const img1 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M15 18l-6-6 6-6' stroke='%23151515' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
const img2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M9 18l6-6-6-6' stroke='%23151515' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
const imgVector7 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M20 40 L40 20 L60 40' stroke='%230038ff' stroke-width='3' fill='none'/%3E%3Ccircle cx='40' cy='30' r='3' fill='%230038ff'/%3E%3C/svg%3E";
const imgVector8 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M20 20 L40 40 L60 20' stroke='%230038ff' stroke-width='3' fill='none'/%3E%3Ccircle cx='40' cy='30' r='3' fill='%230038ff'/%3E%3C/svg%3E";
const imgVector9 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M20 30 L40 10 L60 30' stroke='%230038ff' stroke-width='3' fill='none'/%3E%3Ccircle cx='40' cy='20' r='3' fill='%230038ff'/%3E%3C/svg%3E";
const imgAward = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M12 2L15 9L22 10L17 15L18 22L12 19L6 22L7 15L2 10L9 9Z' fill='%23f4b207'/%3E%3C/svg%3E";
const imgArrowDown2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%23ffffff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
const imgLine62 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='2'%3E%3Cline x1='0' y1='1' x2='100' y2='1' stroke='%23e6e6e6' stroke-width='2'/%3E%3C/svg%3E";
const imgLine63 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='2'%3E%3Cline x1='0' y1='1' x2='100' y2='1' stroke='%23e6e6e6' stroke-width='2'/%3E%3C/svg%3E";
const img01IconsLineArrowCircleDownCopy = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='none' stroke='%23151515' stroke-width='2'/%3E%3Cpath d='M8 10l4 4 4-4' stroke='%23151515' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const img01IconsLineArrowCircleDownCopy2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='none' stroke='%23151515' stroke-width='2'/%3E%3Cpath d='M8 10l4 4 4-4' stroke='%23151515' stroke-width='2' fill='none'/%3E%3C/svg%3E";

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
    // Fetch themes for preview functionality
    const themesResponse = await admin.graphql(`
      query getThemes {
        themes(first: 10) {
          edges {
            node {
              id
              name
              role
            }
          }
        }
      }
    `);
    
    const themesData = await themesResponse.json();
    const themes = themesData.data?.themes?.edges?.map(edge => edge.node) || [];
    
    // Fetch products for preview
    const productsResponse = await admin.graphql(`
      query getProducts {
        products(first: 20) {
          edges {
            node {
              id
              title
              handle
              templateSuffix
              featuredImage {
                url
                altText
              }
            }
          }
        }
      }
    `);
    
    const productsData = await productsResponse.json();
    const products = productsData.data?.products?.edges?.map(edge => edge.node) || [];

    // Fetch product templates (same logic as ab-tests.jsx)
    const mainTheme = themes.find(t => t.role === 'MAIN');
    let productTemplates = [];
    if (mainTheme) {
      const themeId = mainTheme.id.replace('gid://shopify/OnlineStoreTheme/', '');
      const shopDomain = session.shop.replace('.myshopify.com', '');
      
      const restRes = await fetch(
        `https://${shopDomain}.myshopify.com/admin/api/2024-01/themes/${themeId}/assets.json`,
        {
          headers: {
            "X-Shopify-Access-Token": session.accessToken,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      
      const restJson = await restRes.json();
      const assets = restJson.assets || [];
      
      // Debug: Log all assets to see what's available
      console.log('🔍 All theme assets:', assets.map(a => a.key));
      
      productTemplates = assets
        .map(a => a.key)
        .filter(key =>
          (key.startsWith("templates/product") && (key.endsWith(".liquid") || key.endsWith(".json"))) ||
          (key === "templates/product.liquid" || key === "templates/product.json")
        );
      
      console.log('📄 Filtered product templates!:', productTemplates);
    }

    // Fetch all A/B tests (both active and completed with winners)
    const allTests = await prisma.aBTest.findMany({
      where: { 
        shop: session.shop,
        status: { in: ['active', 'running', 'live', 'completed'] }
      },
      orderBy: { startDate: 'desc' }
    });

    console.log(`🔍 Dashboard: Found ${allTests.length} tests for shop ${session.shop}`);
    allTests.forEach(test => {
      console.log(`  Test: ${test.name}, Status: ${test.status}, Winner: ${test.winner}`);
    });

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
        } else if (test.status === 'completed' && test.winner === null) {
          // Test is already completed with no clear winner
          console.log(`✅ Test ${test.id} already completed with no clear winner`);
          
          // Create a mock analysis for display purposes showing no clear winner
          analysis = {
            decision: 'no_clear_winner',
            purchases: {
              probB: 0.50,
              expectedLift: 0.0
            },
            atc: {
              probB: 0.50,
              expectedLift: 0.0
            }
          };
        } else if (variantPurchases > 0) {
          console.log(`⚡ Immediate winner override: variant purchase detected for test ${test.id}`);
          winnerDeclared = true;
          analysis = {
            decision: 'variant_winner',
            purchases: {
              probB: 0.99,
              expectedLift: 0.25
            },
            atc: {
              probB: 0.95,
              expectedLift: 0.15
            }
          };
          
          await prisma.aBTest.update({
            where: { id: test.id },
            data: {
              status: 'completed',
              winner: 'B',
              endDate: new Date()
            }
          });

          test.status = 'completed';
          test.winner = 'B';
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
          console.log(`  Days running: ${daysRunning}`);
          
          // Day-based winner declaration logic:
          // - Days 0-9: Wait, don't declare winner even if probabilities are met
          // - Days 10-21: If probabilities meet thresholds, declare winner immediately
          // - After day 21: If no winner, mark as completed with 'no clear winner'
          
          if (daysRunning < 10) {
            // Wait 10 days minimum before declaring a winner
            console.log(`⏳ Test ${test.id} is only ${daysRunning} days old. Waiting until day 10 before declaring winner.`);
          } else if (daysRunning >= 10 && daysRunning < 21) {
            // Days 10-21: Declare winner if probabilities are met
          if (analysis.decision !== 'no_clear_winner') {
            winnerDeclared = true;
              console.log(`🎉 WINNER DECLARED for test ${test.id} (day ${daysRunning}): ${analysis.decision}`);
            
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
              console.log(`⏳ No clear winner yet for test ${test.id} (day ${daysRunning}). Waiting until day 21.`);
            }
          } else if (daysRunning >= 21) {
            // After 21 days: If no winner, mark as completed with 'no clear winner'
            if (analysis.decision !== 'no_clear_winner') {
              winnerDeclared = true;
              console.log(`🎉 WINNER DECLARED for test ${test.id} (day ${daysRunning}): ${analysis.decision}`);
              
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
              // No winner after 21 days - mark as completed with no clear winner
              console.log(`⏸️ Test ${test.id} reached 21 days with no clear winner. Marking as completed.`);
              await prisma.aBTest.update({
                where: { id: test.id },
                data: { 
                  status: 'completed',
                  winner: null,
                  endDate: new Date()
                }
              });
            }
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
          winner: test.winner || (winnerDeclared ? (analysis.decision.includes('variant') ? 'B' : 'A') : null),
          widgetType: test.widgetType || null,
          widgetSettings: test.widgetSettings || null
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
      themes: themes,
      products: products,
      productTemplates: productTemplates,
      shop: session.shop
    });
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    return json({
      user: { name: "Zac", level: "Legend Scientist", xp: 2100, maxXp: 3000 },
      experiments: [],
      productTemplates: [],
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
      themes: [],
      products: [],
      shop: session.shop,
      error: "Failed to load dashboard data"
    });
  }
};

export default function Dashboard() {
  const { user, experiments, testCards, queuedTests, recentActivities, themes, products, productTemplates, shop } = useLoaderData();
  const [expandedTests, setExpandedTests] = useState(new Set());
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [wizardSelectedProductSnapshot, setWizardSelectedProductSnapshot] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [testResult, setTestResult] = useState('');
  const [storePassword, setStorePassword] = useState('');

  // Wizard state variables
  const [wizardOpen, setWizardOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [selectedWidgetConfig, setSelectedWidgetConfig] = useState(null);
  const [selectedWidgetTweakId, setSelectedWidgetTweakId] = useState(null);
  const [placementGuideOpen, setPlacementGuideOpen] = useState(false);
  const [themePreviewMode, setThemePreviewMode] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({ x: 100, y: 100 });
  const [draggedElement, setDraggedElement] = useState(null);
  const [themePreviewData, setThemePreviewData] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productPreviewOpen, setProductPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);

  // Tinder swiper state
  const [currentWidgetIndex, setCurrentWidgetIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Wizard screenshot state
  const [wizardScreenshot, setWizardScreenshot] = useState(null);
  const [wizardScreenshotLoading, setWizardScreenshotLoading] = useState(false);
  const [wizardStorePassword, setWizardStorePassword] = useState('');
  
  // Wizard variant state
  const [wizardVariantName, setWizardVariantName] = useState('');
  const [wizardVariantProductId, setWizardVariantProductId] = useState(null);
  const [wizardVariantProductHandle, setWizardVariantProductHandle] = useState(null);
  const [wizardVariantProductTitle, setWizardVariantProductTitle] = useState('');
  const [wizardVariantTemplateFilename, setWizardVariantTemplateFilename] = useState('');
  const [wizardControlTemplateFilename, setWizardControlTemplateFilename] = useState('');
  const [wizardVariantOriginalTemplateSuffix, setWizardVariantOriginalTemplateSuffix] = useState(null);
  const [wizardTestName, setWizardTestName] = useState('');
  const [wizardTrafficSplit, setWizardTrafficSplit] = useState('50');
  const [isLaunchingTest, setIsLaunchingTest] = useState(false);
  const [wizardLaunchError, setWizardLaunchError] = useState(null);
  const [wizardLaunchSuccess, setWizardLaunchSuccess] = useState(null);
  
  // Widget settings state (for simple-text-badge)
  const [widgetSettings, setWidgetSettings] = useState({
    headerText: '',
    bodyText: '',
    textColor: '#000000',
    backgroundColor: '#f5f5f0'
  });
  const [isVariantTemplateReady, setIsVariantTemplateReady] = useState(false);
  const [isVariantRequestInFlight, setIsVariantRequestInFlight] = useState(false);
  const encodeWidgetConfigPayload = (payload) => {
    if (!payload) return null;
    try {
      const json = JSON.stringify(payload);
      return btoa(unescape(encodeURIComponent(json)));
    } catch (error) {
      console.error('⚠️ Failed to encode widget config payload:', error);
      return null;
    }
  };

  // Debug: Open the created variant directly in the Theme Editor with previewPath
  const openVariantInThemeEditor = async () => {
    try {
      if (!wizardVariantName) {
        console.error('❌ Variant template name is missing - cannot open Theme Editor');
        alert('Variant template has not been created yet. Please duplicate the template first.');
        return;
      }

      if (!isVariantTemplateReady) {
        console.warn('⏳ Variant template is still being prepared - delaying Theme Editor open');
        alert('We are still preparing the duplicated template. Please wait a moment and try again.');
        return;
      }

      const mainTheme = themes.find(t => t.role === 'MAIN');
      if (!mainTheme) {
        console.warn('⚠️ No MAIN theme found for editor open');
        return;
      }
      const numericThemeId = mainTheme.id.replace('gid://shopify/OnlineStoreTheme/', '');
      const storeSubdomain = (shop || '').replace('.myshopify.com', '');

      if (!wizardVariantProductHandle) {
        console.error('❌ No stored product handle for this variant template!');
        alert('We could not determine which product to preview. Please go back, re-select your product, and duplicate the template again.');
        return;
      }

      const productHandleForPreview = wizardVariantProductHandle;
      const productTitleForPreview = wizardVariantProductTitle || wizardSelectedProductSnapshot?.title || selectedProduct?.title;

      // Debug: Log current product context
      console.log('🔍 Theme Editor Debug - Product context:', {
        selectedProduct,
        wizardSelectedProductSnapshot,
        productHandleForPreview,
        wizardVariantProductId,
        productTitleForPreview,
        wizardVariantProductHandle,
        wizardVariantProductTitle,
        wizardVariantName,
        wizardVariantTemplateFilename
      });

      if (!productHandleForPreview) {
        console.error('❌ No product handle available - cannot open Theme Editor');
        alert('No product is available for the preview. Please select a product and try again.');
        return;
      }

      // For OS 2.0 JSON templates, the template param is product.<suffix>
      const templateParam = `product.${wizardVariantName}`;

      // Ensure the preview path matches the duplicated template via ?view=<suffix>
      const previewParams = new URLSearchParams();
      if (wizardVariantName) {
        previewParams.set('view', wizardVariantName);
      }
      if (selectedIdea?.blockId && selectedWidgetConfig) {
        const encodedConfig = encodeWidgetConfigPayload({
          widgetType: selectedIdea.blockId,
          settings: selectedWidgetConfig
        });
        if (encodedConfig) {
          previewParams.set('ab_widget_config', encodedConfig);
        }
      }
      const previewPath = previewParams.toString()
        ? `/products/${productHandleForPreview}?${previewParams.toString()}`
        : `/products/${productHandleForPreview}`;
      const encodedPreviewPath = encodeURIComponent(previewPath);

      const apiKey = "5ff212573a3e19bae68ca45eae0a80c4";
      const widgetHandle = selectedIdea?.blockId || null;
      
      // Check if widget block already exists in the template
      let blockAlreadyExists = false;
      if (widgetHandle && wizardVariantTemplateFilename) {
        try {
          const checkResponse = await fetch('/api/check-widget-exists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateFilename: wizardVariantTemplateFilename || `templates/product.${wizardVariantName}.json`,
              themeId: mainTheme.id,
              blockId: widgetHandle,
              appExtensionId: apiKey
            })
          });
          
          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            blockAlreadyExists = checkResult.exists || false;
            console.log('🔍 Widget block existence check:', { exists: blockAlreadyExists });
          }
        } catch (checkError) {
          console.error('⚠️ Error checking if widget exists:', checkError);
          // If check fails, assume it doesn't exist and proceed with deep link
        }
      }
      
      // Only add deep link parameter if block doesn't already exist
      const addBlockParams = (widgetHandle && !blockAlreadyExists)
        ? `&addAppBlockId=${apiKey}/${widgetHandle}&target=mainSection`
        : '';

      // Add cache-busting parameter to force theme editor to reload fresh content
      const cacheBuster = `&_t=${Date.now()}`;

      const editorUrl = `https://admin.shopify.com/store/${storeSubdomain}/themes/${numericThemeId}/editor?template=${encodeURIComponent(templateParam)}&previewPath=${encodedPreviewPath}${addBlockParams}${cacheBuster}`;

      // Open the theme editor
      const themeEditorWindow = window.open(editorUrl, '_blank');

      // If we have widget settings, update them after the block is added via deep link
      if (widgetHandle && selectedIdea?.blockId === 'simple-text-badge' && widgetSettings && Object.keys(widgetSettings).length > 0) {
        // Format settings for the API
        const formatText = (text) => {
          if (!text || text.trim() === '') return '<p></p>';
          // If already wrapped in HTML tags, return as-is
          if (text.trim().startsWith('<')) return text;
          // Otherwise wrap in <p> tags
          return `<p>${text}</p>`;
        };
        
        const finalBlockSettings = {
          header_text: formatText(widgetSettings.headerText),
          body_text: formatText(widgetSettings.bodyText),
          text_color: widgetSettings.textColor || '#1a5f5f',
          background_color: widgetSettings.backgroundColor || '#f5f5f0'
        };

        const updateBlockSettings = async (attempt = 1, maxAttempts = 5) => {
          try {
            console.log(`🔄 Updating widget settings (attempt ${attempt}/${maxAttempts})...`);
            
            const updateResponse = await fetch('/api/update-widget-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                templateFilename: wizardVariantTemplateFilename || `templates/product.${wizardVariantName}.json`,
                themeId: mainTheme.id,
                blockId: selectedIdea.blockId,
                appExtensionId: apiKey,
                blockSettings: finalBlockSettings
              })
            });

            const updateResult = await updateResponse.json();
            
            if (updateResponse.ok && updateResult.success) {
              console.log('✅ Widget settings updated successfully:', updateResult);
              // Refresh the theme editor window to show updated settings
              if (themeEditorWindow && !themeEditorWindow.closed) {
                themeEditorWindow.location.reload();
              }
              return true;
            } else {
              console.error(`⚠️ Failed to update widget settings (attempt ${attempt}):`, updateResult.error);
              
              // If block not found and we have more attempts, retry
              if (updateResponse.status === 404 && attempt < maxAttempts) {
                const delay = attempt * 2000; // 2s, 4s, 6s, 8s, 10s
                console.log(`⏳ Retrying in ${delay}ms...`);
                setTimeout(() => updateBlockSettings(attempt + 1, maxAttempts), delay);
              } else {
                console.error('❌ Failed to update widget settings after all attempts');
              }
            }
          } catch (error) {
            console.error(`⚠️ Error updating widget settings (attempt ${attempt}):`, error);
            if (attempt < maxAttempts) {
              const delay = attempt * 2000;
              console.log(`⏳ Retrying in ${delay}ms...`);
              setTimeout(() => updateBlockSettings(attempt + 1, maxAttempts), delay);
            }
          }
        };

        // Start updating settings with appropriate delay
        if (blockAlreadyExists) {
          // Block already exists, update immediately
          console.log('🔄 Block already exists, updating settings immediately...');
          updateBlockSettings();
        } else {
          // Block is being added via deep link, wait a bit then update
          console.log('🔄 Block being added via deep link, waiting before updating settings...');
          setTimeout(() => updateBlockSettings(), 3000);
        }
      }

      console.log('🧭 Theme Editor Debug Params:', {
        shop,
        storeSubdomain,
        themeGid: mainTheme.id,
        numericThemeId,
        templateParam,
        previewPath,
        encodedPreviewPath,
        wizardVariantName,
        wizardVariantTemplateFilename,
        isVariantTemplateReady,
        selectedIdea,
        productHandleForPreview,
        productTitleForPreview,
        addBlockParams,
        editorUrl
      });
    } catch (err) {
      console.error('❌ Failed to open Theme Editor (debug):', err);
      alert(`Failed to open Theme Editor: ${err.message}`);
    }
  };


  // Figma design colors
  const figmaColors = {
    primaryBlue: '#0038ff',
    lightBlue: '#97cdff',
    orange: '#ef9362',
    darkGray: '#151515',
    lightGray: '#84818a',
    white: '#ffffff',
    gray: '#e6e6e6',
    basicFill: '#C5CEE0',
    black: '#202226',
    themeDark: '#464255',
    green: '#29ad00',
    yellow: '#f4b207'
  };

  // Figma icons (using inline SVG data URIs)
  const icons = {
    home: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' stroke='%23151515' stroke-width='2' fill='none'/%3E%3C/svg%3E",
    cultureTube: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect x='6' y='4' width='12' height='16' rx='2' fill='none' stroke='%23151515' stroke-width='2'/%3E%3Cpath d='M9 8h6M9 12h6M9 16h6' stroke='%23151515' stroke-width='2'/%3E%3C/svg%3E",
    award: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M12 2L15 9L22 10L17 15L18 22L12 19L6 22L7 15L2 10L9 9Z' fill='%23f4b207'/%3E%3C/svg%3E",
    chart: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='300'%3E%3Crect width='800' height='300' fill='%23ffffff'/%3E%3Cline x1='50' y1='250' x2='750' y2='250' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cline x1='50' y1='250' x2='50' y2='50' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cpolyline points='100,200 200,180 300,150 400,120 500,100 600,90 700,80' fill='none' stroke='%230038ff' stroke-width='3'/%3E%3C/svg%3E",
    graph: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='300'%3E%3Crect width='800' height='300' fill='%23ffffff'/%3E%3Cline x1='50' y1='250' x2='750' y2='250' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cline x1='50' y1='250' x2='50' y2='50' stroke='%23e6e6e6' stroke-width='2'/%3E%3Cpolyline points='100,200 200,180 300,150 400,120 500,100 600,90 700,80' fill='none' stroke='%230038ff' stroke-width='3'/%3E%3C/svg%3E",
    ideasIcon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%230038ff'/%3E%3Cpath d='M8 12h8M12 8v8' stroke='%23ffffff' stroke-width='1.5'/%3E%3C/svg%3E",
    arrowLeft: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M15 18l-6-6 6-6' stroke='%23151515' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E",
    arrowRight: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M9 18l6-6-6-6' stroke='%23151515' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"
  };

  // A/B Test Ideas
  const abTestIdeas = [
    {
      id: 1,
      utility: 'Live Visitor Count',
      rationale: 'Shows real-time visitor activity, creates urgency and social proof',
      style: 'Dynamic',
      preview: '👁️ 76 people viewing this page',
      blockId: 'live-visitor-count',
      appExtensionId: '5ff212573a3e19bae68ca45eae0a80c4'
    },
    {
      id: 2,
      utility: 'Simple Text Badge',
      rationale: 'Displays promotional badges with customizable text, colors, and icons to highlight special offers',
      style: 'Promotional',
      preview: '🎁 Up to 25% Off Everything: Our biggest savings of the year are here. Learn More',
      blockId: 'simple-text-badge',
      appExtensionId: '5ff212573a3e19bae68ca45eae0a80c4'
    }
  ];

  const widgetTweaksCatalog = {
    'simple-text-badge': [
      {
        id: 'simple-text-badge-bold-sale',
        title: 'Bold Sale Banner',
        description: 'High-contrast banner for flash or limited-time promotions.',
        badgeText: 'FLASH DEAL • 30% OFF ENDS TONIGHT',
        previewColors: {
          background: '#fff1f2',
          text: '#be123c',
          ribbon: '#be123c'
        },
        settings: {
          text: 'FLASH DEAL • 30% OFF ENDS TONIGHT',
          textColor: '#be123c',
          backgroundColor: '#fff1f2',
          ribbonColor: '#be123c'
        }
      },
      {
        id: 'simple-text-badge-luxury',
        title: 'Luxury Ribbon Message',
        description: 'Muted palette with serif tone for premium drops.',
        badgeText: 'Limited Atelier Drop • Complimentary gift wrapping today',
        previewColors: {
          background: '#f5f5f0',
          text: '#1a5f5f',
          ribbon: '#8b5cf6'
        },
        settings: {
          text: 'Limited Atelier Drop • Complimentary gift wrapping today',
          textColor: '#1a5f5f',
          backgroundColor: '#f5f5f0',
          ribbonColor: '#8b5cf6'
        }
      },
      {
        id: 'simple-text-badge-eco',
        title: 'Eco Friendly Highlight',
        description: 'Earthy tones to promote sustainability messaging.',
        badgeText: 'Earth Conscious • Ships in recycled packaging',
        previewColors: {
          background: '#ecfccb',
          text: '#14532d',
          ribbon: '#65a30d'
        },
        settings: {
          text: 'Earth Conscious • Ships in recycled packaging',
          textColor: '#14532d',
          backgroundColor: '#ecfccb',
          ribbonColor: '#65a30d'
        }
      },
      {
        id: 'simple-text-badge-loyalty',
        title: 'Loyalty Boost',
        description: 'Spotlight perks for logged-in or VIP customers.',
        badgeText: 'Members unlock free 2-day shipping + double points',
        previewColors: {
          background: '#e0f2fe',
          text: '#0c4a6e',
          ribbon: '#0369a1'
        },
        settings: {
          text: 'Members unlock free 2-day shipping + double points',
          textColor: '#0c4a6e',
          backgroundColor: '#e0f2fe',
          ribbonColor: '#0369a1'
        }
      }
    ],
    'live-visitor-count': [
      {
        id: 'live-visitor-count-urgency',
        title: 'Urgency Pulse',
        description: 'Higher range and bold copy to push scarcity.',
        previewText: '87 people just viewed this item — almost gone!',
        settings: {
          countMin: 72,
          countMax: 98,
          desktopText: 'people just viewed this item — almost gone!',
          mobileText: 'viewing now — selling fast!',
          desktopBorderShape: 'rectangular',
          mobileBorderShape: 'rectangular',
          desktopAlignment: 'center',
          mobileAlignment: 'center',
          desktopFont: 'helvetica',
          desktopFontSize: 16,
          mobileFontSize: 14
        }
      },
      {
        id: 'live-visitor-count-social',
        title: 'Social Proof',
        description: 'Highlights how many shoppers have this in cart.',
        previewText: '54 shoppers have this in their cart right now',
        settings: {
          countMin: 40,
          countMax: 62,
          desktopText: 'shoppers have this in their cart right now',
          mobileText: 'carted right now ⚡',
          desktopBorderShape: 'rounded',
          mobileBorderShape: 'rounded',
          desktopAlignment: 'left',
          desktopFont: 'georgia',
          desktopFontSize: 15
        }
      },
      {
        id: 'live-visitor-count-minimal',
        title: 'Minimal Meter',
        description: 'Clean layout aligned right for luxe brands.',
        previewText: '32 people considering this piece today',
        settings: {
          countMin: 26,
          countMax: 42,
          desktopText: 'people considering this piece today',
          mobileText: 'considering today',
          desktopBorderShape: 'rectangular',
          mobileBorderShape: 'rectangular',
          desktopAlignment: 'right',
          desktopFont: 'helvetica',
          desktopFontSize: 14
        }
      },
      {
        id: 'live-visitor-count-socialproof',
        title: 'Drop Countdown',
        description: 'Short text and tight padding for hero sections.',
        previewText: '46 others viewing this drop in the last hour',
        settings: {
          countMin: 38,
          countMax: 56,
          desktopText: 'others viewing this drop in the last hour',
          mobileText: 'live this hour',
          desktopPaddingInside: 10,
          mobilePaddingInside: 8,
          desktopAlignment: 'center',
          desktopFontSize: 15,
          mobileFontSize: 13
        }
      }
    ]
  };

  const cloneConfig = (config) => (config ? JSON.parse(JSON.stringify(config)) : null);
  const getWidgetTweaks = (widgetType) => widgetTweaksCatalog[widgetType] || [];
  const getWidgetIdeaByType = (widgetType) => abTestIdeas.find(idea => idea.blockId === widgetType);
  const getTweakLabel = (widgetType, tweakId) => {
    if (!widgetType || !tweakId) return null;
    const tweaks = getWidgetTweaks(widgetType);
    const tweak = tweaks.find(t => t.id === tweakId);
    return tweak ? tweak.title : null;
  };

  const applyWidgetIdeaSelection = (idea, configOverride = null, tweakId = null) => {
    if (!idea) return;
    setSelectedIdea(idea);
    setSelectedWidgetConfig(cloneConfig(configOverride));
    setSelectedWidgetTweakId(tweakId || null);
    const ideaIndex = abTestIdeas.findIndex(entry => entry.id === idea.id);
    if (ideaIndex >= 0) {
      setCurrentWidgetIndex(ideaIndex);
    }
  };

  const startWizardForIdea = (idea, configOverride = null, tweakId = null) => {
    if (!idea) return;
    resetSwiper();
    applyWidgetIdeaSelection(idea, configOverride, tweakId);
    setWizardOpen(true);
    setCurrentStep(2);
  };

  const handleTweakSelection = (widgetType, tweak) => {
    const idea = getWidgetIdeaByType(widgetType);
    if (!idea) {
      alert('We could not pre-select that widget. Please choose one manually.');
      return;
    }
    const configOverride = tweak?.settings ? cloneConfig(tweak.settings) : null;
    startWizardForIdea(idea, configOverride, tweak?.id || null);
    setWizardTestName('');
    setWizardLaunchError(null);
    setWizardLaunchSuccess(null);
  };

  // Tinder swiper functions
  const handleSwipe = (direction) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setSwipeDirection(direction);
    
    if (direction === 'like') {
      const selectedWidget = abTestIdeas[currentWidgetIndex];
      console.log('🎯 Widget selected:', {
        widget: selectedWidget,
        currentIndex: currentWidgetIndex,
        hasBlockId: !!selectedWidget?.blockId,
        hasAppExtensionId: !!selectedWidget?.appExtensionId,
        blockId: selectedWidget?.blockId,
        appExtensionId: selectedWidget?.appExtensionId
      });
      applyWidgetIdeaSelection(selectedWidget);
      setTimeout(() => {
        setCurrentStep(2);
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 400);
    } else {
      setTimeout(() => {
        if (currentWidgetIndex < abTestIdeas.length - 1) {
          setCurrentWidgetIndex(currentWidgetIndex + 1);
        } else {
          // No more widgets, go back to step 1 or show message
          setCurrentWidgetIndex(0);
        }
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 400);
    }
  };

  const resetSwiper = () => {
    setCurrentStep(1);
    setCurrentWidgetIndex(0);
    setSelectedIdea(null);
    setSelectedWidgetConfig(null);
    setSelectedWidgetTweakId(null);
    setSwipeDirection(null);
    setIsAnimating(false);
    setWizardScreenshot(null);
    setWizardScreenshotLoading(false);
    setWizardStorePassword('');
    setWizardVariantName('');
    setWizardVariantProductId(null);
    setWizardVariantProductHandle(null);
    setWizardVariantProductTitle('');
    setWizardVariantTemplateFilename('');
    setIsVariantTemplateReady(false);
    setWizardSelectedProductSnapshot(null);
    setWizardVariantOriginalTemplateSuffix(null);
    setWizardControlTemplateFilename('');
    setWizardTestName('');
    setWizardTrafficSplit('50');
    setIsLaunchingTest(false);
    setWizardLaunchError(null);
    setWizardLaunchSuccess(null);
  };

  // Generate screenshot for wizard
  const generateWizardScreenshot = async () => {
    console.log('🔍 Wizard Screenshot Debug:', {
      selectedProduct: selectedProduct?.title,
      selectedProductHandle: selectedProduct?.handle,
      selectedTheme: selectedTheme?.name,
      selectedThemeId: selectedTheme?.id,
      mainTheme: themes.find(t => t.role === 'MAIN')?.name,
      mainThemeId: themes.find(t => t.role === 'MAIN')?.id,
      wizardStorePassword: wizardStorePassword ? '***' : 'empty',
      storePassword: storePassword ? '***' : 'empty'
    });

    if (!selectedProduct) {
      console.error('❌ No product selected for screenshot');
      setWizardScreenshotLoading(false);
      return;
    }

    // Use main theme if no theme is selected
    const themeToUse = selectedTheme || themes.find(t => t.role === 'MAIN');
    if (!themeToUse) {
      console.error('❌ No theme available for screenshot');
      setWizardScreenshotLoading(false);
      return;
    }
    
    setWizardScreenshotLoading(true);
    try {
      const previewUrl = generateWizardPreviewUrl(selectedProduct.handle, themeToUse.id);
      console.log('🔗 Generated preview URL:', previewUrl);
      
      const response = await fetch('/api/screenshot-selenium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewUrl,
          productHandle: selectedProduct.handle,
          themeId: themeToUse.id,
          storePassword: wizardStorePassword || storePassword
        })
      });
      
      console.log('📡 Screenshot API response status:', response.status);
      const result = await response.json();
      console.log('📸 Screenshot API result:', result);
      
      if (result.success) {
        setWizardScreenshot(result.screenshotUrl);
        console.log('✅ Screenshot generated successfully');
      } else {
        console.error('❌ Screenshot generation failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Screenshot generation failed:', error);
    } finally {
      setWizardScreenshotLoading(false);
    }
  };

  // Create variant template
  const createVariantTemplate = async () => {
    const activeProduct = wizardSelectedProductSnapshot || selectedProduct;

    if (!activeProduct) {
      console.error('❌ No product selected for variant template creation');
      alert('Please select a product before creating a variant template.');
      return { success: false, error: 'no_product_selected' };
    }

    if (isVariantRequestInFlight) {
      console.log('⏳ Variant creation already in progress, skipping duplicate call');
      return { success: false, error: 'request_in_flight' };
    }

    setIsVariantRequestInFlight(true);
    setIsVariantTemplateReady(false);
    setWizardVariantTemplateFilename('');
    setWizardVariantProductId(null);
    setWizardVariantProductHandle(null);
    setWizardVariantProductTitle('');
    setWizardVariantOriginalTemplateSuffix(activeProduct.templateSuffix || null);

    // Generate random 4-digit name for the duplicated template
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const variantName = `trylabs-variant-${randomDigits}`;

    console.log('🔧 Creating variant template:', {
      variantName,
      product: {
        title: activeProduct.title,
        handle: activeProduct.handle,
        templateSuffix: activeProduct.templateSuffix
      }
    });

    let creationResult = { success: false };

    try {
      // Get the main theme ID
      const mainTheme = themes.find(t => t.role === 'MAIN');
      if (!mainTheme) {
        throw new Error('No main theme found');
      }
      
      const productId = activeProduct.id;
      let productHandle = activeProduct.handle;
      let productTitle = activeProduct.title || '';

      if (!productHandle && productId) {
        const fallbackProduct = products?.find(p => p.id === productId);
        if (fallbackProduct?.handle) {
          productHandle = fallbackProduct.handle;
          if (!productTitle) {
            productTitle = fallbackProduct.title || '';
          }
        }
      }

      if (!productHandle) {
        throw new Error('Selected product is missing a handle. Please re-select the product and try again.');
      }
      
      // Determine the specific template for this product
      console.log('📄 Available product templates from loader:', productTemplates);
      console.log('🔍 Selected product template suffix:', activeProduct.templateSuffix);

      let baseTemplate;
      if (activeProduct.templateSuffix) {
        baseTemplate = `templates/product.${activeProduct.templateSuffix}.liquid`;
        console.log('📄 Using product-specific template:', baseTemplate);
      } else {
        console.log('📄 Product uses default template, finding the correct one...');
        
        const exactDefaults = [
          'templates/product.json',
          'templates/product.liquid'
        ];
        
        baseTemplate = exactDefaults.find(template => productTemplates.includes(template));
        
        if (baseTemplate) {
          console.log('📄 Found exact default template:', baseTemplate);
        } else {
          const productTemplatesWithoutSuffix = productTemplates.filter(template => {
            const name = template.replace('templates/', '').replace('.liquid', '').replace('.json', '');
            return name === 'product';
          });
          
          if (productTemplatesWithoutSuffix.length > 0) {
            baseTemplate = productTemplatesWithoutSuffix[0];
            console.log('📄 Found product template without suffix:', baseTemplate);
          } else {
            baseTemplate = productTemplates.find(template => 
              template.includes('product') && 
              (template.endsWith('.liquid') || template.endsWith('.json'))
            );
            
            if (baseTemplate) {
              console.log('📄 Using first available product template:', baseTemplate);
            } else {
              baseTemplate = productTemplates[0] || 'templates/product.liquid';
              console.log('📄 Using fallback template:', baseTemplate);
            }
          }
        }
      }
      
      const templateExists = productTemplates.includes(baseTemplate);
      if (!templateExists) {
        console.log('⚠️ Template not found in available templates, falling back to first available');
        baseTemplate = productTemplates[0] || 'templates/product.liquid';
      }
      
      console.log('📄 Final template to duplicate:', baseTemplate);
      console.log('✅ Template exists in available templates:', templateExists);
      setWizardControlTemplateFilename(baseTemplate);
      
      const response = await fetch('/api/duplicate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: baseTemplate,
          newName: variantName,
          themeId: mainTheme.id,
          productHandle: productHandle
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Variant template created:', result.newFilename);
        
        setWizardVariantName(variantName);
        setWizardVariantProductId(productId || null);
        setWizardVariantProductHandle(productHandle);
        setWizardVariantProductTitle(productTitle);
        setWizardVariantTemplateFilename(result.newFilename);
        setIsVariantTemplateReady(true);

        let assignTemplateResult = null;
        try {
          const assignResponse = await fetch('/api/assign-product-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId,
              templateSuffix: variantName
            })
          });
          assignTemplateResult = await assignResponse.json();
          if (!assignResponse.ok) {
            throw new Error(assignTemplateResult.error || 'Failed to assign template.');
          }
          if (!assignTemplateResult.success) {
            console.error('⚠️ Failed to assign template to product:', assignTemplateResult.error);
            alert(`We created the template but couldn't assign it to the product automatically. ${assignTemplateResult.error || ''}`);
          } else {
            console.log('✅ Assigned template to product:', {
              productId,
              templateSuffix: variantName
            });
            setWizardSelectedProductSnapshot(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                templateSuffix: variantName
              };
            });
          }
        } catch (assignError) {
          console.error('⚠️ Error assigning template to product:', assignError);
          alert(`We created the template but couldn't assign it to the product automatically. ${assignError.message || ''}`);
        }

        console.log('🔍 Widget Addition Debug - Checking selectedIdea:', {
          selectedIdea,
          hasSelectedIdea: !!selectedIdea,
          selectedIdeaBlockId: selectedIdea?.blockId,
          selectedIdeaAppExtensionId: selectedIdea?.appExtensionId,
          selectedIdeaUtility: selectedIdea?.utility,
          conditionMet: !!(selectedIdea?.blockId && selectedIdea?.appExtensionId)
        });
        
        // Note: We don't add the widget block here via API because Shopify may silently reject it.
        // Instead, we'll use the deep link approach in openVariantInThemeEditor which is more reliable.
        // The block will be added when the theme editor opens, and then we'll immediately update its settings.
        
        creationResult = { success: true, variantName, newFilename: result.newFilename };
      } else {
        console.error('❌ Variant template creation failed:', result.error);
        creationResult = { success: false, error: result.error || 'variant_template_creation_failed' };
      }
    } catch (error) {
      console.error('❌ Variant creation failed:', error);
      creationResult = { success: false, error: error.message };
    } finally {
      setIsVariantRequestInFlight(false);
      if (!creationResult.success) {
        setWizardVariantName('');
        setIsVariantTemplateReady(false);
    }
    }

    return creationResult;
  };

  const toggleTestExpansion = (testName) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testName)) {
      newExpanded.delete(testName);
    } else {
      newExpanded.add(testName);
    }
    setExpandedTests(newExpanded);
  };

  const generatePreviewUrl = () => {
    if (selectedTheme && selectedProduct) {
      const themeId = selectedTheme.id.replace('gid://shopify/OnlineStoreTheme/', '');
      const productHandle = selectedProduct.handle;
      const baseUrl = `https://${shop}`;
      const previewUrl = `${baseUrl}/products/${productHandle}?preview_theme_id=${themeId}`;
      console.log('🔗 Generated preview URL:', previewUrl);
      console.log('📦 Product handle:', productHandle);
      console.log('🎨 Theme ID:', themeId);
      setPreviewUrl(previewUrl);
    }
  };

  // Generate preview URL for wizard (with parameters)
  const generateWizardPreviewUrl = (productHandle, themeId) => {
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '');
    const baseUrl = `https://${shop}`;
    const previewUrl = `${baseUrl}/products/${productHandle}?preview_theme_id=${cleanThemeId}`;
    console.log('🔗 Generated wizard preview URL:', previewUrl);
    console.log('📦 Wizard product handle:', productHandle);
    console.log('🎨 Wizard theme ID:', cleanThemeId);
    return previewUrl;
  };

  const handleProductSelection = (product) => {
    setSelectedProduct(product);
    if (product) {
      setWizardSelectedProductSnapshot(product);
    }
    setWizardLaunchError(null);
    setWizardLaunchSuccess(null);
  };

  const handleLaunchTest = async () => {
    if (isLaunchingTest) return;

    const productGid =
      wizardVariantProductId ||
      wizardSelectedProductSnapshot?.id ||
      selectedProduct?.id;

    if (!wizardSelectedProductSnapshot || !productGid) {
      alert('Please select a product before launching the test.');
      return;
    }

    if (!wizardVariantName || !wizardVariantTemplateFilename) {
      alert('The variant template is not ready yet. Please go back and complete the template setup.');
      return;
    }

    if (!wizardControlTemplateFilename) {
      alert('Unable to detect the control template. Please restart the wizard.');
      return;
    }

    const finalTestName = (wizardTestName && wizardTestName.trim().length > 0)
      ? wizardTestName.trim()
      : `${selectedIdea?.utility || 'Widget'} Test - ${wizardSelectedProductSnapshot.title || 'Product'} (${new Date().toLocaleDateString()})`;

    const payload = {
      shop,
      testName: finalTestName,
      productId: productGid,
      controlTemplateFilename: wizardControlTemplateFilename,
      variantTemplateFilename: wizardVariantTemplateFilename,
      controlTemplateSuffix: wizardVariantOriginalTemplateSuffix,
      variantTemplateSuffix: wizardVariantName,
      trafficSplit: wizardTrafficSplit,
      widgetType: selectedIdea?.blockId || null,
      widgetSettings: selectedWidgetConfig || null
    };

    setIsLaunchingTest(true);
    setWizardLaunchError(null);
    setWizardLaunchSuccess(null);

    try {
      const response = await fetch('/api/launch-ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to launch test.');
      }

      setWizardLaunchSuccess(`Test "${data.abTest?.name || finalTestName}" launched successfully!`);

      // Reset product template back to control/default after launch
      try {
        await fetch('/api/assign-product-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: productGid,
            templateSuffix: wizardVariantOriginalTemplateSuffix ?? null
          })
        });

        setWizardSelectedProductSnapshot(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            templateSuffix: wizardVariantOriginalTemplateSuffix || null
          };
        });
        setSelectedProduct(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            templateSuffix: wizardVariantOriginalTemplateSuffix || null
          };
        });
      } catch (revertError) {
        console.error('⚠️ Failed to revert product template after launching test:', revertError);
      }

      setTimeout(() => {
        setWizardOpen(false);
        resetSwiper();
      }, 1500);
    } catch (error) {
      console.error('❌ Failed to launch A/B test!:', error);
      setWizardLaunchError(error.message || 'Failed to launch A/B test. Please try again.');
    } finally {
      setIsLaunchingTest(false);
    }
  };

  const openPreviewInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const generateScreenshot = async () => {
    if (previewUrl && selectedTheme && selectedProduct) {
      setIsLoadingScreenshot(true);
      setShowScreenshotPreview(true);
      
      try {
        const response = await fetch('/api/screenshot-selenium', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            previewUrl,
            productHandle: selectedProduct.handle,
            themeId: selectedTheme.id.replace('gid://shopify/OnlineStoreTheme/', ''),
            storePassword: storePassword
          })
        });

        const result = await response.json();
        
        if (result.success) {
          setScreenshotUrl(result.screenshotUrl);
        } else {
          console.error('Screenshot generation failed:', result);
          alert(`Screenshot generation failed: ${result.error}\n\nDetails: ${result.details}\n\nSuggestion: ${result.suggestion || 'Please try again or contact support.'}`);
          setShowScreenshotPreview(false);
        }
      } catch (error) {
        console.error('Error generating screenshot:', error);
        setShowScreenshotPreview(false);
      } finally {
        setIsLoadingScreenshot(false);
      }
    }
  };

  const toggleScreenshotPreview = () => {
    if (showScreenshotPreview) {
      setShowScreenshotPreview(false);
      setScreenshotUrl('');
    } else {
      generateScreenshot();
    }
  };

  const testScreenshotAPI = async () => {
    try {
      setTestResult('Testing...');
      const response = await fetch('/api/test-selenium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      setTestResult(result.success ? '✅ Test passed! Screenshot API is working.' : `❌ Test failed: ${result.error}`);
    } catch (error) {
      setTestResult(`❌ Test error: ${error.message}`);
    }
  };

  // Update preview URL when theme or product changes
  useEffect(() => {
    generatePreviewUrl();
    // Hide screenshot when selections change
    setShowScreenshotPreview(false);
    setScreenshotUrl('');
  }, [selectedTheme, selectedProduct]);

  useEffect(() => {
    if (wizardSelectedProductSnapshot && selectedIdea && !wizardTestName) {
      const ideaLabel = selectedIdea.utility || 'Widget';
      const tweakLabel = getTweakLabel(selectedIdea.blockId, selectedWidgetTweakId);
      const productLabel = wizardSelectedProductSnapshot.title || 'Product';
      const composedLabel = tweakLabel ? `${ideaLabel} (${tweakLabel})` : ideaLabel;
      setWizardTestName(`${composedLabel} - ${productLabel}`);
    }
  }, [wizardSelectedProductSnapshot, selectedIdea, wizardTestName, selectedWidgetTweakId]);

  const previewProductTitle = wizardVariantProductTitle || wizardSelectedProductSnapshot?.title || selectedProduct?.title || '';
  const previewProductHandle = wizardVariantProductHandle || wizardSelectedProductSnapshot?.handle || selectedProduct?.handle || '';
  const previewProductId = wizardVariantProductId || wizardSelectedProductSnapshot?.id || '';
  const trafficSplitDisplay = `${wizardTrafficSplit}% - ${100 - Number(wizardTrafficSplit || '50')}%`;
  const controlTemplateLabel = wizardVariantOriginalTemplateSuffix
    ? `product.${wizardVariantOriginalTemplateSuffix}`
    : 'product (default)';
  const variantTemplateLabel = wizardVariantName ? `product.${wizardVariantName}` : 'Not ready';
  const canOpenThemeEditor = Boolean(wizardVariantName && wizardVariantProductHandle && isVariantTemplateReady && !isVariantRequestInFlight);
  const canLaunchTest = Boolean(
    wizardVariantProductId &&
    wizardVariantName &&
    wizardControlTemplateFilename &&
    wizardSelectedProductSnapshot
  );

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideInFromRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes swipeLeft {
          0% {
            transform: translateX(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateX(-50px) rotate(-15deg) scale(0.95);
            opacity: 0.8;
          }
          100% {
            transform: translateX(-120%) rotate(-25deg) scale(0.9);
            opacity: 0;
          }
        }
        @keyframes swipeRight {
          0% {
            transform: translateX(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateX(50px) rotate(15deg) scale(0.95);
            opacity: 0.8;
          }
          100% {
            transform: translateX(120%) rotate(25deg) scale(0.9);
            opacity: 0;
          }
        }
        @keyframes cardEnter {
          0% {
            transform: translateY(100px) scale(0.8);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
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
        <button 
          onClick={() => {
            setWizardOpen(true);
            resetSwiper();
          }}
          style={{
          backgroundColor: '#3e3bf3',
          border: 'none',
          borderRadius: '5px',
          padding: '12px 24px',
          cursor: 'pointer'
          }}
        >
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

      {/* Experiment Overview Section */}
      {(() => {
        const runningTest = experiments.find(exp => exp.status === 'running' || exp.status === 'active' || exp.status === 'live');
        const completedWithWinner = experiments.find(exp => exp.status === 'completed' && exp.winner);
        const spotlightTest = runningTest || completedWithWinner;
        
        if (!spotlightTest) {
          return null;
        }

        const runtimeMatch = spotlightTest.runtime?.match(/(\d+)d/);
        const days = runtimeMatch ? parseInt(runtimeMatch[1], 10) : 0;
        const hours = days * 24;
        const runtimeDisplay = hours >= 24 ? `${days} d` : `${hours} h`;

        const formatNumber = (num) => {
          if (num === null || num === undefined) return '0';
          return num.toLocaleString('en-US');
        };

        const atcLift = spotlightTest.analysis?.atc?.expectedRelLift 
          ? (spotlightTest.analysis.atc.expectedRelLift * 100).toFixed(1)
          : null;
        const certainty = spotlightTest.analysis?.atc?.probB 
          ? (spotlightTest.analysis.atc.probB * 100).toFixed(0)
          : spotlightTest.analysis?.purchases?.probB
          ? (spotlightTest.analysis.purchases.probB * 100).toFixed(0)
          : null;

        let descriptionText = '';
        const winnerDeclared = spotlightTest.status === 'completed' && Boolean(spotlightTest.winner);
        if (winnerDeclared && atcLift && certainty) {
          const winningLabel = spotlightTest.winner === 'B' ? 'Variant' : 'Control';
          descriptionText = `${winningLabel} won with a ${Math.abs(atcLift)}% ATC lift at ${certainty}% certainty.`;
        } else if (atcLift && certainty) {
          const isVariantLeading = spotlightTest.analysis?.atc?.probB > 0.5;
          const liftText = isVariantLeading ? `leading ${Math.abs(atcLift)}%` : `trailing ${Math.abs(atcLift)}%`;
          descriptionText = `Variant is ${liftText} ATC with ${certainty}% certainty.`;
        } else {
          descriptionText = winnerDeclared
            ? 'Winner locked based on purchase probability.'
            : 'Test is running. Collecting data to determine results.';
        }

        const secondaryDescription = winnerDeclared
          ? 'Line up a fresh widget tweak to keep conversion momentum.'
          : 'We suggest keeping the test active for a few more days to reach a more certain conclusion';

        const testNameParts = spotlightTest.name?.split(' VS ') || [spotlightTest.name || 'Experiment'];
        const experimentTitle = testNameParts[0] || spotlightTest.name || 'Experiment';

        const goalPercentage = spotlightTest.analysis?.atc?.probB 
          ? Math.min(95, Math.max(50, Math.round(spotlightTest.analysis.atc.probB * 100)))
          : 80;

        const widgetTweaks = winnerDeclared && spotlightTest.widgetType
          ? getWidgetTweaks(spotlightTest.widgetType)
          : [];

        return (
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
            color: figmaColors.primaryBlue,
            margin: '0 0 15px 0',
            lineHeight: '32px'
          }}>
            Experiment Overview
          </p>
          <div>
            <span style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 500,
                  fontSize: '32px',
              color: figmaColors.darkGray,
                  lineHeight: '40px'
            }}>
                  {descriptionText}
            </span>
            <span style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 300,
                  fontSize: '24px',
              color: figmaColors.darkGray,
                  lineHeight: '32px'
            }}>
                  {' '}{secondaryDescription}
            </span>
          </div>
        </div>

        {/* Chart Area with X/Y Axes */}
        <div style={{ marginBottom: '30px', position: 'relative', height: '300px' }}>
          {/* Y-Axis Labels */}
          <div style={{
            position: 'absolute',
            left: '20px',
            top: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '55px',
            alignItems: 'center',
            fontSize: '18px',
            color: 'rgba(21,21,21,0.7)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            height: '240px',
            justifyContent: 'space-between'
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
            bottom: '20px',
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
                {experimentTitle}
          </p>
          
          {/* Progress Line */}
          <div style={{ marginBottom: '20px' }}>
                <div style={{ width: '100%', height: '4px', backgroundColor: figmaColors.white, borderRadius: '2px', marginBottom: '10px', position: 'relative' }}>
                  <div style={{ 
                    width: `${goalPercentage}%`, 
                    height: '100%', 
                    backgroundColor: figmaColors.primaryBlue, 
                    borderRadius: '2px',
                    position: 'absolute',
                    left: 0,
                    top: 0
                  }} />
            </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: figmaColors.darkGray, fontFamily: 'Inter, sans-serif' }}>
                  <span>Goal: {goalPercentage}%</span>
                  <span>{goalPercentage}%</span>
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
                lineHeight: '38.704px',
                letterSpacing: '0.344px'
              }}>
                {runtimeDisplay}
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.primaryBlue,
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
                margin: 0,
                letterSpacing: '0.344px'
              }}>
              {formatNumber(spotlightTest.variantA || 0)}
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.primaryBlue,
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
                margin: 0,
                letterSpacing: '0.344px'
              }}>
              {formatNumber(spotlightTest.variantB || 0)}
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.primaryBlue,
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
              backgroundColor: figmaColors.primaryBlue,
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
              border: `1px solid ${figmaColors.primaryBlue}`,
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
                color: figmaColors.primaryBlue,
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
            <img alt="Graph" src={icons.graph} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ 
              width: '16px', 
              height: '16px',
              backgroundColor: figmaColors.primaryBlue,
              borderRadius: '50%'
            }}></div>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '16px',
              color: figmaColors.primaryBlue,
              margin: 0
            }}>
              AutoPilot On
            </p>
          </div>
        </div>

        {winnerDeclared && widgetTweaks.length > 0 && (
          <div style={{ marginTop: '35px' }}>
            <p style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 500,
              fontSize: '20px',
              color: figmaColors.darkGray,
              margin: '0 0 16px 0'
            }}>
              Keep Momentum Going
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px'
            }}>
              {widgetTweaks.map((tweak) => (
                <div key={tweak.id} style={{
                  backgroundColor: figmaColors.white,
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}>
                  <div>
                    <p style={{
                      fontFamily: 'Geist, sans-serif',
                      fontWeight: 500,
                      fontSize: '16px',
                      margin: 0,
                      color: figmaColors.darkGray
                    }}>
                      {tweak.title}
                    </p>
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      margin: '4px 0 0 0',
                      color: figmaColors.lightGray,
                      lineHeight: '18px'
                    }}>
                      {tweak.description}
                    </p>
      </div>
                  {spotlightTest.widgetType === 'simple-text-badge' && (
                    <div style={{
                      borderRadius: '12px',
                      padding: '14px',
                      backgroundColor: tweak.previewColors?.background || '#f5f5f0',
                      color: tweak.previewColors?.text || '#1a5f5f',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      minHeight: '72px',
                      display: 'flex',
                      alignItems: 'center',
                      border: `2px solid ${tweak.previewColors?.ribbon || '#dc2626'}`
                    }}>
                      {tweak.badgeText}
                    </div>
                  )}
                  {spotlightTest.widgetType === 'live-visitor-count' && (
                    <div style={{
                      borderRadius: '12px',
                      padding: '12px',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '20px', fontWeight: 600 }}>
                        {tweak.previewText?.replace(/\D/g, '') || `${tweak.settings?.countMin || 40}`}
                      </span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: figmaColors.lightGray }}>
                        {tweak.previewText || tweak.settings?.desktopText}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => handleTweakSelection(spotlightTest.widgetType, tweak)}
                    style={{
                      backgroundColor: figmaColors.primaryBlue,
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      color: figmaColors.white,
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Launch This Idea
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
        );
      })()}

      {/* Ideas To Try Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px' }}>
            <img alt="Ideas Icon" src={icons.ideasIcon} style={{ width: '100%', height: '100%' }} />
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
              <img alt="Arrow Left" src={icons.arrowLeft} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          <div style={{
            border: '0.714px solid ' + figmaColors.primaryBlue,
            borderRadius: '25px',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <div style={{ width: '22.857px', height: '22.857px' }}>
              <img alt="Arrow Right" src={icons.arrowRight} style={{ width: '100%', height: '100%' }} />
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
              border: `1px solid ${figmaColors.primaryBlue}`,
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
              color: figmaColors.primaryBlue,
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
                  color: figmaColors.primaryBlue,
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
                  color: figmaColors.primaryBlue,
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
                  color: figmaColors.primaryBlue,
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
            backgroundColor: figmaColors.primaryBlue,
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
                      border: `1px solid ${figmaColors.primaryBlue}`
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

      {/* Theme Preview Section */}
      <div style={{ marginTop: '60px' }}>
        <div style={{ marginBottom: '30px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: '0 0 10px 0'
          }}>
            Theme Preview
          </p>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            color: figmaColors.lightGray,
            margin: 0,
            lineHeight: '24px'
          }}>
            Preview how your products look under different themes. Perfect for testing A/B variants before launching.
          </p>
    </div>

        <div style={{
          backgroundColor: figmaColors.white,
          borderRadius: '20px',
          padding: '40px',
          border: `1px solid ${figmaColors.basicFill}`
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px' }}>
            {/* Theme Selection */}
            <div>
              <label style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                marginBottom: '15px',
                display: 'block'
              }}>
                Select Theme
              </label>
              <select
                value={selectedTheme?.id || ''}
                onChange={(e) => {
                  const theme = themes.find(t => t.id === e.target.value);
                  setSelectedTheme(theme);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${figmaColors.basicFill}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                  backgroundColor: figmaColors.white,
                  color: figmaColors.darkGray
                }}
              >
                <option value="">Choose a theme...</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name} {theme.role === 'MAIN' ? '(Main)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Selection */}
            <div>
              <label style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                marginBottom: '15px',
                display: 'block'
              }}>
                Select Product
              </label>
              <select
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const product = products.find(p => p.id === e.target.value);
                  handleProductSelection(product);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${figmaColors.basicFill}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                  backgroundColor: figmaColors.white,
                  color: figmaColors.darkGray
                }}
              >
                <option value="">Choose a product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Store Password */}
            <div>
              <label style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                marginBottom: '15px',
                display: 'block'
              }}>
                Store Password (if protected)
              </label>
              <input
                type="password"
                value={storePassword}
                onChange={(e) => setStorePassword(e.target.value)}
                placeholder="Enter your store password if it's password protected"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${figmaColors.basicFill}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                  backgroundColor: figmaColors.white,
                  color: figmaColors.darkGray
                }}
              />
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: figmaColors.lightGray,
                margin: '8px 0 0 0',
                lineHeight: '20px'
              }}>
                Required if your store has password protection enabled
              </p>
            </div>
          </div>

          {/* Preview URL Display */}
          {previewUrl && (
            <div style={{ marginBottom: '30px' }}>
              <label style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                marginBottom: '15px',
                display: 'block'
              }}>
                Preview URL
              </label>
              <div style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  value={previewUrl}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: `1px solid ${figmaColors.basicFill}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif',
                    backgroundColor: figmaColors.gray,
                    color: figmaColors.darkGray
                  }}
                />
                <button
                  onClick={openPreviewInNewTab}
                  style={{
                    backgroundColor: figmaColors.primaryBlue,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.white,
                    margin: 0
                  }}>
                    Open Preview
                  </p>
                </button>
                <button
                  onClick={toggleScreenshotPreview}
                  disabled={isLoadingScreenshot}
                  style={{
                    backgroundColor: showScreenshotPreview ? figmaColors.orange : figmaColors.green,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    cursor: isLoadingScreenshot ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: isLoadingScreenshot ? 0.7 : 1
                  }}
                >
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.white,
                    margin: 0
                  }}>
                    {isLoadingScreenshot ? 'Generating...' : showScreenshotPreview ? 'Hide Preview' : 'Generate Screenshot'}
                  </p>
                </button>
                <button
                  onClick={testScreenshotAPI}
                  style={{
                    backgroundColor: figmaColors.orange,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.white,
                    margin: 0
                  }}>
                    Test API
                  </p>
                </button>
              </div>
              {testResult && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: figmaColors.lightBlue, borderRadius: '8px' }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0
                  }}>
                    {testResult}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Screenshot Preview Section */}
          {showScreenshotPreview && previewUrl && (
            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <label style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.darkGray,
                  margin: 0
                }}>
                  Static Preview
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {isLoadingScreenshot && (
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: `2px solid ${figmaColors.basicFill}`,
                      borderTop: `2px solid ${figmaColors.primaryBlue}`,
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  )}
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: figmaColors.lightGray,
                    margin: 0
                  }}>
                    {selectedTheme?.name} • {selectedProduct?.title}
                  </p>
                </div>
              </div>
              
              <div style={{
                border: `2px solid ${figmaColors.basicFill}`,
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: figmaColors.white,
                position: 'relative'
              }}>
                {/* Preview Header */}
                <div style={{
                  backgroundColor: figmaColors.lightBlue,
                  padding: '12px 20px',
                  borderBottom: `1px solid ${figmaColors.basicFill}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#ff5f57',
                      borderRadius: '50%'
                    }} />
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#ffbd2e',
                      borderRadius: '50%'
                    }} />
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#28ca42',
                      borderRadius: '50%'
                    }} />
                  </div>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0
                  }}>
                    Screenshot Preview
                  </p>
                </div>
                
                {/* Screenshot Container */}
                <div style={{
                  minHeight: '600px',
                  position: 'relative',
                  backgroundColor: figmaColors.gray,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {isLoadingScreenshot ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '20px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        border: `4px solid ${figmaColors.basicFill}`,
                        borderTop: `4px solid ${figmaColors.primaryBlue}`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '16px',
                        color: figmaColors.darkGray,
                        margin: 0
                      }}>
                        Generating Screenshot...
                      </p>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: figmaColors.lightGray,
                        margin: 0,
                        textAlign: 'center'
                      }}>
                        This may take a few seconds
                      </p>
                    </div>
                  ) : screenshotUrl ? (
                    <div style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        width: '100%',
                        maxWidth: '1200px',
                        height: '800px',
                        overflow: 'auto',
                        border: `2px solid ${figmaColors.basicFill}`,
                        borderRadius: '12px',
                        backgroundColor: figmaColors.white,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)'
                      }}>
                        <img
                          src={screenshotUrl}
                          alt="Product Preview Screenshot"
                          style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            cursor: 'zoom-in'
                          }}
                          onClick={() => {
                            // Open full-size image in new tab
                            const newWindow = window.open();
                            newWindow.document.write(`
                              <html>
                                <head><title>Product Preview - Full Size</title></head>
                                <body style="margin:0; padding:20px; background:#f5f5f5; text-align:center;">
                                  <img src="${screenshotUrl}" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
                                  <p style="margin-top:20px; font-family:Arial,sans-serif; color:#666;">Click and drag to pan, scroll to zoom</p>
                                </body>
                              </html>
                            `);
                          }}
                        />
                      </div>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: figmaColors.lightGray,
                        margin: '12px 0 0 0',
                        textAlign: 'center'
                      }}>
                        📸 Full-page screenshot - scroll to see all content
                      </p>
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '16px',
                        flexWrap: 'wrap',
                        justifyContent: 'center'
                      }}>
                        <button
                          onClick={() => window.open(previewUrl, '_blank')}
                          style={{
                            padding: '12px 24px',
                            backgroundColor: figmaColors.primaryBlue,
                            color: figmaColors.white,
                            border: 'none',
                            borderRadius: '8px',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseOver={(e) => e.target.style.backgroundColor = '#357ABD'}
                          onMouseOut={(e) => e.target.style.backgroundColor = figmaColors.primaryBlue}
                        >
                          View Live Preview
                        </button>
                        <button
                          onClick={() => {
                            const newWindow = window.open();
                            newWindow.document.write(`
                              <html>
                                <head><title>Product Preview - Full Size</title></head>
                                <body style="margin:0; padding:20px; background:#f5f5f5; text-align:center;">
                                  <img src="${screenshotUrl}" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
                                  <p style="margin-top:20px; font-family:Arial,sans-serif; color:#666;">Full-size product preview</p>
                                </body>
                              </html>
                            `);
                          }}
                          style={{
                            padding: '12px 24px',
                            backgroundColor: figmaColors.lightBlue,
                            color: figmaColors.white,
                            border: 'none',
                            borderRadius: '8px',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseOver={(e) => e.target.style.backgroundColor = '#4A90E2'}
                          onMouseOut={(e) => e.target.style.backgroundColor = figmaColors.lightBlue}
                        >
                          Open Full Size
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '20px'
                    }}>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '16px',
                        color: figmaColors.darkGray,
                        margin: 0
                      }}>
                        Screenshot will appear here
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Preview Footer */}
                <div style={{
                  backgroundColor: figmaColors.gray,
                  padding: '10px 20px',
                  borderTop: `1px solid ${figmaColors.basicFill}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: figmaColors.lightGray,
                    margin: 0
                  }}>
                    Static screenshot generated with Puppeteer
                  </p>
                  <button
                    onClick={() => window.open(previewUrl, '_blank')}
                    style={{
                      backgroundColor: 'transparent',
                      border: `1px solid ${figmaColors.primaryBlue}`,
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                      fontSize: '12px',
                      color: figmaColors.primaryBlue,
                      margin: 0
                    }}>
                      Open Live Page
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div style={{
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${figmaColors.primaryBlue}`
          }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: figmaColors.primaryBlue,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: figmaColors.white,
                  margin: 0
                }}>
                  i
                </p>
              </div>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.primaryBlue,
                  margin: '0 0 10px 0'
                }}>
                  How Theme Preview Works
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    lineHeight: '20px'
                  }}>
                    • <strong>URL Method:</strong> The preview URL uses <code>?preview_theme_id=</code> parameter to show your product under a different theme
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    lineHeight: '20px'
                  }}>
                    • <strong>Perfect for A/B Testing:</strong> Test how your product variants look under different themes before launching
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    lineHeight: '20px'
                  }}>
                    • <strong>Static Screenshots:</strong> Use the "Generate Screenshot" button to capture a static image using Puppeteer
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    lineHeight: '20px'
                  }}>
                    • <strong>Server-Side Rendering:</strong> Screenshots are generated on the server using headless Chrome for accurate previews
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* A/B Test Wizard Dialog */}
      {wizardOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '95vw',
            height: '90vh',
            maxWidth: '1200px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Wizard Header */}
            <div style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              color: '#FFFFFF',
              padding: '32px',
              textAlign: 'center'
            }}>
              <h1 style={{
                fontSize: '32px',
                fontWeight: '700',
                margin: '0 0 8px 0',
                background: 'linear-gradient(135deg, #FFFFFF 0%, #E0E7FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                🚀 A/B Test Optimizer
              </h1>
              <p style={{
                fontSize: '16px',
                margin: 0,
                opacity: 0.9
              }}>
                Boost your conversion rates with data-driven widget experiments
              </p>
            </div>

            {/* Progress Bar */}
            <div style={{
              background: '#F8FAFC',
              padding: '24px 32px',
              borderBottom: '1px solid #E5E5E5'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: currentStep >= step ? '#4F46E5' : '#E5E5E5',
                      color: currentStep >= step ? '#FFFFFF' : '#9CA3AF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {step}
                    </div>
                    {step < 5 && (
                      <div style={{
                        width: '60px',
                        height: '2px',
                        background: currentStep > step ? '#4F46E5' : '#E5E5E5',
                        margin: '0 8px'
                      }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#6B7280',
                textAlign: 'center'
              }}>
                Step {currentStep} of 5
              </div>
            </div>

            {/* Main Content */}
            <div style={{
              padding: '32px',
              flex: 1,
              overflow: 'auto'
            }}>
              {/* Step 1: Tinder Swiper for A/B Test Ideas */}
              {currentStep === 1 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  minHeight: '500px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '8px',
                      textAlign: 'center'
                    }}>
                      Choose Your Widget
                    </h3>
                    <div style={{
                      marginBottom: '10px',
                      fontSize: '11px',
                      color: '#6B7280',
                      textAlign: 'center'
                    }}>
                      {currentWidgetIndex + 1} of {abTestIdeas.length}
                    </div>
                  </div>

                  {/* Tinder Card Stack */}
                  <div style={{
                    position: 'relative',
                    width: '400px',
                    height: '450px',
                    margin: '0 auto',
                    overflow: 'hidden'
                  }}>
                    {/* Current Card */}
                    {abTestIdeas[currentWidgetIndex] && (
                      <div
                        key={`current-${currentWidgetIndex}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          background: '#FFFFFF',
                          borderRadius: '16px',
                          boxShadow: '0 15px 30px rgba(0, 0, 0, 0.15)',
                          padding: '30px',
                          cursor: 'pointer',
                          zIndex: 2,
                          opacity: 1,
                          transform: 'scale(1) translateY(0)',
                          animation: !isAnimating ? 'cardEnter 0.5s ease-out' : 'none',
                          transition: 'all 0.3s ease',
                          ...(isAnimating && swipeDirection === 'like' && {
                            animation: 'swipeRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                          }),
                          ...(isAnimating && swipeDirection === 'dislike' && {
                            animation: 'swipeLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                          })
                        }}
                      >
                        {/* Widget Icon */}
                        <div style={{
                          fontSize: '48px',
                          textAlign: 'center',
                          marginBottom: '16px'
                        }}>
                          {abTestIdeas[currentWidgetIndex].utility === 'Live Visitor Count' && '👁️'}
                          {abTestIdeas[currentWidgetIndex].utility === 'Simple Text Badge' && '🎁'}
                        </div>

                        {/* Widget Title */}
                        <h4 style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: '#1F2937',
                          margin: '0 0 12px 0',
                          textAlign: 'center'
                        }}>
                          {abTestIdeas[currentWidgetIndex].utility}
                        </h4>

                        {/* Style Badge */}
                        <div style={{
                          background: '#F0F9FF',
                          color: '#1E40AF',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '500',
                          textAlign: 'center',
                          margin: '0 auto 16px auto',
                          width: 'fit-content'
                        }}>
                          {abTestIdeas[currentWidgetIndex].style} Style
                        </div>

                        {/* Description */}
                        <p style={{
                          fontSize: '16px',
                          color: '#374151',
                          margin: '0 0 20px 0',
                          lineHeight: '1.5',
                          textAlign: 'center'
                        }}>
                          {abTestIdeas[currentWidgetIndex].rationale}
                        </p>

                        {/* Preview */}
                        <div style={{
                          background: '#F8FAFC',
                          border: '1px solid #E5E7EB',
                          padding: '16px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          color: '#6B7280',
                          fontStyle: 'italic',
                          textAlign: 'center'
                        }}>
                          "{abTestIdeas[currentWidgetIndex].preview}"
                        </div>
                      </div>
                    )}

                    {/* Next Card (only if there is one) */}
                    {abTestIdeas[currentWidgetIndex + 1] && (
                      <div
                        key={`next-${currentWidgetIndex + 1}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          background: '#FFFFFF',
                          borderRadius: '16px',
                          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
                          padding: '30px',
                          cursor: 'pointer',
                          transform: 'scale(0.95) translateY(15px)',
                          zIndex: 1,
                          opacity: 0.6,
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          ...(isAnimating && swipeDirection === 'dislike' && {
                            transform: 'scale(1) translateY(0)',
                            opacity: 1,
                            zIndex: 2
                          })
                        }}
                      >
                        {/* Widget Icon */}
                        <div style={{
                          fontSize: '48px',
                          textAlign: 'center',
                          marginBottom: '16px'
                        }}>
                          {abTestIdeas[currentWidgetIndex + 1].utility === 'Live Visitor Count' && '👁️'}
                          {abTestIdeas[currentWidgetIndex + 1].utility === 'Simple Text Badge' && '🎁'}
                        </div>

                        {/* Widget Title */}
                        <h4 style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: '#1F2937',
                          margin: '0 0 12px 0',
                          textAlign: 'center'
                        }}>
                          {abTestIdeas[currentWidgetIndex + 1].utility}
                        </h4>

                        {/* Style Badge */}
                        <div style={{
                          background: '#F0F9FF',
                          color: '#1E40AF',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '500',
                          textAlign: 'center',
                          margin: '0 auto 16px auto',
                          width: 'fit-content'
                        }}>
                          {abTestIdeas[currentWidgetIndex + 1].style} Style
                        </div>

                        {/* Description */}
                        <p style={{
                          fontSize: '16px',
                          color: '#374151',
                          margin: '0 0 20px 0',
                          lineHeight: '1.5',
                          textAlign: 'center'
                        }}>
                          {abTestIdeas[currentWidgetIndex + 1].rationale}
                        </p>

                        {/* Preview */}
                        <div style={{
                          background: '#F8FAFC',
                          border: '1px solid #E5E7EB',
                          padding: '16px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          color: '#6B7280',
                          fontStyle: 'italic',
                          textAlign: 'center'
                        }}>
                          "{abTestIdeas[currentWidgetIndex + 1].preview}"
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '5px'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '25px',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <button
                        onClick={() => handleSwipe('dislike')}
                        disabled={isAnimating}
                        style={{
                          width: '70px',
                          height: '70px',
                          borderRadius: '50%',
                          background: '#FEE2E2',
                          border: '3px solid #FCA5A5',
                          cursor: isAnimating ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px',
                          color: '#DC2626',
                          boxShadow: '0 6px 16px rgba(220, 38, 38, 0.4)',
                          transition: 'all 0.2s ease',
                          opacity: isAnimating ? 0.5 : 1,
                          transform: isAnimating ? 'scale(0.95)' : 'scale(1)'
                        }}
                      >
                        ✕
                      </button>
                      
                      <button
                        onClick={() => handleSwipe('like')}
                        disabled={isAnimating}
                        style={{
                          width: '70px',
                          height: '70px',
                          borderRadius: '50%',
                          background: '#DCFCE7',
                          border: '3px solid #86EFAC',
                          cursor: isAnimating ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px',
                          color: '#16A34A',
                          boxShadow: '0 6px 16px rgba(22, 163, 74, 0.4)',
                          transition: 'all 0.2s ease',
                          opacity: isAnimating ? 0.5 : 1,
                          transform: isAnimating ? 'scale(0.95)' : 'scale(1)'
                        }}
                      >
                        ♥
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Choose Product & Preview */}
              {currentStep === 2 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Choose Product to Test
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    Select a product and enter your store password to see a preview
                  </p>

                  {/* Two Column Layout */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '24px',
                    minHeight: '500px'
                  }}>
                    {/* Left Column: Product List */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}>
                      <div style={{
                        maxHeight: '450px',
                        overflowY: 'auto',
                        padding: '10px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px'
                      }}>
                 {products.map((product) => (
                   <div
                     key={product.id}
                     onClick={() => {
                       handleProductSelection(product);
                       // Debug: Log product template information
                       console.log('🔍 Selected product:', product.title);
                       console.log('🔍 Product handle:', product.handle);
                       console.log('🔍 Product ID:', product.id);
                       console.log('🔍 Product template suffix:', product.templateSuffix);
                       console.log('🔍 Product template:', product.template);
                       console.log('📄 Available product templates:', productTemplates);
                       console.log('📄 Total templates found:', productTemplates.length);
                       
                       // Generate screenshot if password is entered
                       if (wizardStorePassword || storePassword) {
                         generateWizardScreenshot();
                       }
                     }}
                            style={{
                              background: selectedProduct?.id === product.id ? '#F0F9FF' : '#FFFFFF',
                              border: selectedProduct?.id === product.id ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                              borderRadius: '12px',
                              padding: '16px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              marginBottom: '12px',
                              transform: selectedProduct?.id === product.id ? 'scale(1.02)' : 'scale(1)'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}>
                              {product.featuredImage && (
                                <img
                                  src={product.featuredImage.url}
                                  alt={product.title}
                                  style={{
                                    width: '60px',
                                    height: '60px',
                                    objectFit: 'cover',
                                    borderRadius: '8px'
                                  }}
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <h4 style={{
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  color: '#1F2937',
                                  margin: '0 0 4px 0'
                                }}>
                                  {product.title}
                                </h4>
                         <p style={{
                           fontSize: '14px',
                           color: '#6B7280',
                           margin: 0
                         }}>
                           {product.vendor}
                         </p>
                         {product.templateSuffix && (
                           <p style={{
                             fontSize: '12px',
                             color: '#10B981',
                             margin: '4px 0 0 0',
                             fontWeight: '500'
                           }}>
                             Template: product.{product.templateSuffix}.liquid
                           </p>
                         )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Password & Preview */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px'
                    }}>
                      {/* Store Password Input */}
                      <div style={{
                        padding: '20px',
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: '0 0 8px 0'
                        }}>
                          Store Password
                        </h4>
                        <p style={{
                          fontSize: '14px',
                          color: '#6B7280',
                          margin: '0 0 16px 0'
                        }}>
                          Enter your store password to generate a preview
                        </p>
                        <input
                          type="password"
                          value={wizardStorePassword}
                          onChange={(e) => setWizardStorePassword(e.target.value)}
                          onKeyDown={(e) => {
                            // Generate screenshot when Enter is pressed
                            if (e.key === 'Enter' && selectedProduct && wizardStorePassword && !wizardScreenshotLoading) {
                              generateWizardScreenshot();
                            }
                          }}
                          onBlur={() => {
                            // Generate screenshot when password field loses focus if product is selected
                            if (selectedProduct && wizardStorePassword && !wizardScreenshotLoading) {
                              generateWizardScreenshot();
                            }
                          }}
                          placeholder="Enter store password..."
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: '#FFFFFF'
                          }}
                        />
                      </div>


                      {/* Screenshot Preview */}
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        {wizardScreenshotLoading ? (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '60px 20px',
                            background: '#F8FAFC',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            flex: 1
                          }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              border: '4px solid #E5E7EB',
                              borderTop: '4px solid #3B82F6',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                              marginBottom: '16px'
                            }}></div>
                            <p style={{
                              fontSize: '16px',
                              color: '#6B7280',
                              margin: 0
                            }}>
                              Generating screenshot...
                            </p>
                          </div>
                        ) : wizardScreenshot ? (
                          <div style={{
                            background: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            padding: '20px',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                            <h4 style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1F2937',
                              margin: '0 0 16px 0'
                            }}>
                              {selectedProduct?.title} Preview
                            </h4>
                            <div style={{
                              flex: 1,
                              overflow: 'auto',
                              textAlign: 'center'
                            }}>
                              <img
                                src={wizardScreenshot}
                                alt="Product preview"
                                style={{
                                  maxWidth: '100%',
                                  height: 'auto',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '60px 20px',
                            background: '#F8FAFC',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            flex: 1
                          }}>
                            <p style={{
                              fontSize: '16px',
                              color: '#6B7280',
                              margin: 0,
                              textAlign: 'center'
                            }}>
                              {selectedProduct ? 'Enter password and select a product to see preview' : 'Select a product and enter password to see preview'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Save Widget & Configure Settings */}
              {currentStep === 3 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Save Widget & Configure Settings
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    First, save the empty widget in the theme editor, then configure your widget settings below
                  </p>

                  {/* Step 1: Save Widget in Theme Editor */}
                  <div style={{
                    background: '#FEF3C7',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #F59E0B',
                    marginBottom: '24px'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#92400E',
                      margin: '0 0 12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ 
                        background: '#F59E0B', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '20px', 
                        height: '20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '12px', 
                        fontWeight: 'bold' 
                      }}>1</span>
                      Save Empty Widget in Theme Editor
                    </h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#92400E',
                      margin: '0 0 16px 0'
                    }}>
                      Click the button below to open the theme editor, then save the template to add the empty widget. Close the tab and return here to configure the widget settings.
                    </p>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <button
                        onClick={openVariantInThemeEditor}
                        disabled={!canOpenThemeEditor}
                        style={{
                          padding: '12px 24px',
                          background: canOpenThemeEditor ? '#F59E0B' : '#9CA3AF',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          border: `1px solid ${canOpenThemeEditor ? '#F59E0B' : '#9CA3AF'}`,
                          cursor: canOpenThemeEditor ? 'pointer' : 'not-allowed',
                          opacity: canOpenThemeEditor ? 1 : 0.7,
                          fontSize: '14px',
                          fontWeight: '600'
                        }}
                      >
                        {isVariantRequestInFlight && !isVariantTemplateReady ? 'Preparing Theme Editor…' : 'Open in Theme Editor'}
                      </button>
                      <span style={{ fontSize: '12px', color: '#92400E', textAlign: 'center' }}>
                        Opens template <strong>{wizardVariantName ? `product.${wizardVariantName}` : 'product'}</strong>
                        {wizardVariantProductHandle ? `, previewing /products/${wizardVariantProductHandle}${wizardVariantName ? `?view=${wizardVariantName}` : ''}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Configure Widget Settings */}
                  <div style={{
                    background: '#F0F9FF',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #0EA5E9',
                    marginBottom: '24px'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#0C4A6E',
                      margin: '0 0 16px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ 
                        background: '#0EA5E9', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '20px', 
                        height: '20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '12px', 
                        fontWeight: 'bold' 
                      }}>2</span>
                      Configure Widget Settings
                    </h4>
                    
                    {/* Widget Settings (only for simple-text-badge) */}
                    {selectedIdea?.blockId === 'simple-text-badge' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Header Text */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '8px'
                          }}>
                            Header Text
                          </label>
                          <input
                            type="text"
                            value={widgetSettings.headerText}
                            onChange={(e) => setWidgetSettings(prev => ({ ...prev, headerText: e.target.value }))}
                            placeholder="Enter header text..."
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: '#FFFFFF'
                            }}
                          />
                        </div>

                        {/* Body Text */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '8px'
                          }}>
                            Body Text
                          </label>
                          <textarea
                            value={widgetSettings.bodyText}
                            onChange={(e) => setWidgetSettings(prev => ({ ...prev, bodyText: e.target.value }))}
                            placeholder="Enter body text..."
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: '#FFFFFF',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                          />
                        </div>

                        {/* Text Color */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '8px'
                          }}>
                            Text Color
                          </label>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={widgetSettings.textColor}
                              onChange={(e) => setWidgetSettings(prev => ({ ...prev, textColor: e.target.value }))}
                              style={{
                                width: '60px',
                                height: '40px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                cursor: 'pointer'
                              }}
                            />
                            <input
                              type="text"
                              value={widgetSettings.textColor}
                              onChange={(e) => setWidgetSettings(prev => ({ ...prev, textColor: e.target.value }))}
                              placeholder="#000000"
                              style={{
                                flex: 1,
                                padding: '12px 16px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                fontSize: '14px',
                                background: '#FFFFFF'
                              }}
                            />
                          </div>
                        </div>

                        {/* Background Color */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '8px'
                          }}>
                            Background Color
                          </label>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={widgetSettings.backgroundColor}
                              onChange={(e) => setWidgetSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                              style={{
                                width: '60px',
                                height: '40px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                cursor: 'pointer'
                              }}
                            />
                            <input
                              type="text"
                              value={widgetSettings.backgroundColor}
                              onChange={(e) => setWidgetSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                              placeholder="#f5f5f0"
                              style={{
                                flex: 1,
                                padding: '12px 16px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                fontSize: '14px',
                                background: '#FFFFFF'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Preview in Theme Editor */}
                  <div style={{
                    background: '#F0FDF4',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #22C55E'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#15803D',
                      margin: '0 0 12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ 
                        background: '#22C55E', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '20px', 
                        height: '20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '12px', 
                        fontWeight: 'bold' 
                      }}>3</span>
                      Preview Updated Widget
                    </h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#15803D',
                      margin: '0 0 16px 0'
                    }}>
                      Click below to preview your configured widget settings in the theme editor
                    </p>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                          onClick={openVariantInThemeEditor}
                          disabled={!canOpenThemeEditor}
                          style={{
                            padding: '12px 24px',
                            background: canOpenThemeEditor ? '#22C55E' : '#9CA3AF',
                            color: '#FFFFFF',
                            borderRadius: '8px',
                            border: `1px solid ${canOpenThemeEditor ? '#22C55E' : '#9CA3AF'}`,
                            cursor: canOpenThemeEditor ? 'pointer' : 'not-allowed',
                            opacity: canOpenThemeEditor ? 1 : 0.7,
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          Preview in Theme Editor
                        </button>
                        <button
                          onClick={() => {
                            // Open storefront preview with the variant template
                            const storeUrl = shop?.myshopifyDomain || shop?.domain;
                            const productHandle = wizardVariantProductHandle;
                            const variantName = wizardVariantName;
                            
                            if (storeUrl && productHandle && variantName) {
                              const storefrontUrl = `https://${storeUrl}/products/${productHandle}?view=${variantName}`;
                              window.open(storefrontUrl, '_blank');
                            } else {
                              alert('Missing information to generate storefront preview URL');
                            }
                          }}
                          disabled={!canOpenThemeEditor || !wizardVariantProductHandle || !wizardVariantName}
                          style={{
                            padding: '12px 24px',
                            background: (canOpenThemeEditor && wizardVariantProductHandle && wizardVariantName) ? '#3B82F6' : '#9CA3AF',
                            color: '#FFFFFF',
                            borderRadius: '8px',
                            border: `1px solid ${(canOpenThemeEditor && wizardVariantProductHandle && wizardVariantName) ? '#3B82F6' : '#9CA3AF'}`,
                            cursor: (canOpenThemeEditor && wizardVariantProductHandle && wizardVariantName) ? 'pointer' : 'not-allowed',
                            opacity: (canOpenThemeEditor && wizardVariantProductHandle && wizardVariantName) ? 1 : 0.7,
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          Preview in Storefront
                        </button>
                      </div>
                      <span style={{ fontSize: '12px', color: '#15803D', textAlign: 'center' }}>
                        Preview in theme editor or live storefront with updated widget settings
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Configure Test */}
              {currentStep === 4 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Configure Your Test
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    Set up your A/B test parameters
                  </p>

                  <div style={{
                    background: '#F8FAFC',
                    padding: '24px',
                    borderRadius: '12px',
                    marginBottom: '24px'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937',
                      margin: '0 0 16px 0'
                    }}>
                      Test Summary
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px'
                    }}>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Widget Type
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {selectedIdea?.utility || 'Not selected'}
                        </p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Product
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {selectedProduct?.title || 'Not selected'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px'
                  }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Test Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Social Proof Widget Test"
                        value={wizardTestName}
                        onChange={(e) => setWizardTestName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Traffic Split
                      </label>
                      <select style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                        value={wizardTrafficSplit}
                        onChange={(e) => setWizardTrafficSplit(e.target.value)}
                      >
                        <option value="50">50% - 50%</option>
                        <option value="60">60% - 40%</option>
                        <option value="70">70% - 30%</option>
                        <option value="80">80% - 20%</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Preview */}
              {currentStep === 4 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Preview Your Test
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    See how your A/B test will look on your store
                  </p>

                  <div style={{
                    background: '#F8FAFC',
                    padding: '24px',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '48px',
                      marginBottom: '16px'
                    }}>
                      🎨
                    </div>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937',
                      margin: '0 0 8px 0'
                    }}>
                      Preview Coming Soon
                    </h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      margin: 0
                    }}>
                      Widget preview will be available in the next step
                    </p>
                  </div>
                </div>
              )}

              {/* Step 5: Launch */}
              {currentStep === 5 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Launch Your A/B Test
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '24px'
                  }}>
                    Review your test configuration and launch when ready
                  </p>

                  <div style={{
                    background: '#F0F9FF',
                    border: '1px solid #3B82F6',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1F2937',
                      margin: '0 0 16px 0'
                    }}>
                      Test Configuration
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px'
                    }}>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Test Name
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {wizardTestName || 'Auto-generated when launching'}
                        </p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Widget Type
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {selectedIdea?.utility || 'Not selected'}
                        </p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Product
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {selectedProduct?.title || 'Not selected'}
                        </p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Traffic Split
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {trafficSplitDisplay}
                        </p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Control Template
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {controlTemplateLabel}
                        </p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '0 0 4px 0'
                        }}>
                          Variant Template
                        </p>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          {variantTemplateLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: '#FEF3C7',
                    border: '1px solid #F59E0B',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '16px' }}>⚠️</span>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#92400E',
                        margin: 0
                      }}>
                        Important
                      </h4>
                    </div>
                    <p style={{
                      fontSize: '14px',
                      color: '#92400E',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Make sure you have the necessary permissions to modify your theme. 
                      This will create a duplicate template for testing.
                    </p>
                  </div>

                  {wizardLaunchError && (
                    <div style={{
                      background: '#FEE2E2',
                      border: '1px solid #EF4444',
                      color: '#B91C1C',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px'
                    }}>
                      {wizardLaunchError}
                    </div>
                  )}

                  {wizardLaunchSuccess && (
                    <div style={{
                      background: '#ECFDF5',
                      border: '1px solid #10B981',
                      color: '#065F46',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px'
                    }}>
                      {wizardLaunchSuccess}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wizard Footer */}
            <div style={{
              background: '#F8FAFC',
              padding: '24px 32px',
              borderTop: '1px solid #E5E5E5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                onClick={() => setWizardOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                  style={{
                    background: currentStep === 1 ? '#F3F4F6' : '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: currentStep === 1 ? '#9CA3AF' : '#374151'
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={
                    (currentStep === 2 && (isVariantRequestInFlight || !wizardSelectedProductSnapshot)) ||
                    (currentStep === 5 && (isLaunchingTest || !canLaunchTest))
                  }
                  onClick={async () => {
                    if (currentStep === 2) {
                      if (!wizardSelectedProductSnapshot) {
                        alert('Please select a product before continuing.');
                        return;
                      }
                      const result = await createVariantTemplate();
                      if (!result?.success) {
                        if (result?.error && result.error !== 'request_in_flight') {
                          const errorCopy = typeof result.error === 'string' ? result.error : '';
                          const friendlyErrorMap = {
                            no_product_selected: 'Please select a product before continuing.',
                            request_in_flight: 'We are still working on the previous request.',
                            variant_template_creation_failed: 'Shopify did not allow us to duplicate the template. Please try again in a few seconds.',
                            no_product_selected_for_variant_template: 'Please select a product before continuing.'
                          };
                          const friendlyMessage = friendlyErrorMap[errorCopy] || errorCopy || 'Please try again in a few seconds.';
                          alert(`We couldn't duplicate the template yet. ${friendlyMessage}`);
                        }
                        return;
                      }
                      setCurrentStep(3);
                      return;
                    }

                    if (currentStep < 5) {
                      setWizardLaunchError(null);
                      setWizardLaunchSuccess(null);
                      setCurrentStep(prev => Math.min(prev + 1, 5));
                    } else {
                      await handleLaunchTest();
                    }
                  }}
                  style={{
                    background:
                      currentStep === 2 && (isVariantRequestInFlight || !wizardSelectedProductSnapshot)
                        ? '#818CF8'
                        : currentStep === 5 && (isLaunchingTest || !canLaunchTest)
                          ? '#818CF8'
                          : '#4F46E5',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    cursor:
                      currentStep === 2 && (isVariantRequestInFlight || !wizardSelectedProductSnapshot)
                        ? 'not-allowed'
                        : currentStep === 5 && (isLaunchingTest || !canLaunchTest)
                          ? 'not-allowed'
                          : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#FFFFFF',
                    opacity:
                      (currentStep === 2 && (isVariantRequestInFlight || !wizardSelectedProductSnapshot)) ||
                      (currentStep === 5 && (isLaunchingTest || !canLaunchTest))
                        ? 0.8
                        : 1
                  }}
                >
                  {currentStep === 2 && isVariantRequestInFlight
                    ? 'Duplicating...'
                    : currentStep === 5 && isLaunchingTest
                      ? 'Launching...'
                    : currentStep === 5
                      ? 'Launch Test'
                      : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}