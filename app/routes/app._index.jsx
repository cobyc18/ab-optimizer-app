import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import React, { useState, useEffect } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import ExperimentOverview from "../components/ExperimentOverview.jsx";

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
      
      console.log('📄 Filtered product templates!!!:', productTemplates);
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

        // Calculate daily metrics for chart
        const startDate = test.startDate ? new Date(test.startDate) : new Date();
        const dailyMetrics = [];
        
        // Group events by day
        const eventsByDay = {};
        events.forEach(event => {
          const eventDate = new Date(event.timestamp);
          const dayNumber = Math.floor((eventDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
          
          if (dayNumber < 1) return; // Skip events before test start
          
          const dayKey = dayNumber;
          if (!eventsByDay[dayKey]) {
            eventsByDay[dayKey] = {
              control: { impressions: 0, addToCart: 0 },
              variant: { impressions: 0, addToCart: 0 }
            };
          }
          
          const variant = event.variant === test.templateA ? 'control' : 
                         event.variant === test.templateB ? 'variant' : null;
          
          if (variant) {
            if (event.eventType === 'impression') {
              eventsByDay[dayKey][variant].impressions++;
            } else if (event.eventType === 'add_to_cart') {
              eventsByDay[dayKey][variant].addToCart++;
            }
          }
        });
        
        // Calculate add to cart rate per day
        Object.keys(eventsByDay).forEach(dayKey => {
          const day = parseInt(dayKey, 10);
          const dayData = eventsByDay[dayKey];
          
          // Control metrics
          const controlRate = dayData.control.impressions > 0
            ? dayData.control.addToCart / dayData.control.impressions
            : 0;
          dailyMetrics.push({
            dayNumber: day,
            variant: 'control',
            impressions: dayData.control.impressions,
            addToCart: dayData.control.addToCart,
            addToCartRate: controlRate
          });
          
          // Variant metrics
          const variantRate = dayData.variant.impressions > 0
            ? dayData.variant.addToCart / dayData.variant.impressions
            : 0;
          dailyMetrics.push({
            dayNumber: day,
            variant: 'variant',
            impressions: dayData.variant.impressions,
            addToCart: dayData.variant.addToCart,
            addToCartRate: variantRate
          });
        });
        
        // Sort by day number
        dailyMetrics.sort((a, b) => a.dayNumber - b.dayNumber);

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
          widgetSettings: test.widgetSettings || null,
          dailyMetrics: dailyMetrics,
          templateA: test.templateA,
          templateB: test.templateB
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

// Widget Tweaks Catalog - used for displaying widget tweak suggestions in the dashboard
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

  const getWidgetTweaks = (widgetType) => widgetTweaksCatalog[widgetType] || [];

export default function Dashboard() {
  const { user, experiments, testCards, queuedTests, recentActivities, themes, products, productTemplates, shop } = useLoaderData();
  const [expandedTests, setExpandedTests] = useState(new Set());
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [testResult, setTestResult] = useState('');
  const [storePassword, setStorePassword] = useState('');
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
        <Link 
          to="/app/ab-tests"
          style={{
          backgroundColor: '#3e3bf3',
          border: 'none',
          borderRadius: '5px',
          padding: '12px 24px',
          cursor: 'pointer',
          textDecoration: 'none',
          display: 'inline-block'
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
        </Link>
      </div>

      {/* Experiment Overview Section */}
      <ExperimentOverview 
        experiments={experiments}
        getWidgetTweaks={getWidgetTweaks}
        figmaColors={figmaColors}
        icons={icons}
      />

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

    </div>
    </>
  );
}
