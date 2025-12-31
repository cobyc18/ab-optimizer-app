import { json } from "@remix-run/node";
import { authenticate, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server.js";
import { checkBillingStatus } from "../utils/billing.server.js";
import { abTestIdeas } from "../data/abTestIdeas.js";

// Export loader function
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Check billing status for premium features
  const billingStatus = await checkBillingStatus(request, [BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN]);
  
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

    // Fetch product templates
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
      
      productTemplates = assets
        .map(a => a.key)
        .filter(key =>
          (key.startsWith("templates/product") && (key.endsWith(".liquid") || key.endsWith(".json"))) ||
          (key === "templates/product.liquid" || key === "templates/product.json")
        );
    }

    return json({
      themes: themes,
      products: products,
      productTemplates: productTemplates,
      shop: session.shop,
      hasActivePayment: billingStatus.hasActivePayment,
      isDevelopmentStore: billingStatus.isDevelopmentStore,
    });
  } catch (error) {
    console.error("Error loading AB tests data:", error);
    return json({
      themes: [],
      products: [],
      productTemplates: [],
      shop: session.shop,
      error: "Failed to load data"
    });
  }
};

// Figma Design Variables
export const figmaColors = {
  gray: "#e6e6e6",
  primaryBlue: "#0038ff",
  darkGray: "#151515"
};

// Background colors for each widget type - more vibrant and distinct
export const getWidgetBackgroundColor = (utility) => {
  const colorMap = {
    'Free Shipping Badge': '#DBEAFE', // Brighter baby blue
    'How Many in Cart': '#FEF08A', // Brighter yellow/amber
    'Returns Guarantee Badge': '#DBEAFE' // Brighter baby blue (same as Free Shipping Badge)
  };
  return colorMap[utility] || '#F3F4F6'; // Default gray
};

// Filter conversion plays based on selected goal
export const getFilteredConversionPlays = (selectedGoal) => {
  if (!selectedGoal) return [];
  
  return abTestIdeas.filter(widget => {
    // "How Many in Cart" should ONLY show for Social Proof or Urgency
    if (widget.utility === 'How Many in Cart') {
      return selectedGoal === 'Social Proof' || selectedGoal === 'Urgency';
    }
    // Free Shipping and Returns Guarantee should ONLY show for Trust
    if (widget.utility === 'Free Shipping Badge' || widget.utility === 'Returns Guarantee Badge') {
      return selectedGoal === 'Trust';
    }
    // Default: don't show
    return false;
  });
};

// Get visible cards in stack (current + ALL other widgets behind in circular order)
export const getVisibleCards = (currentWidgetIndex, selectedGoal) => {
  const filteredWidgets = getFilteredConversionPlays(selectedGoal);
  if (filteredWidgets.length === 0) return [];
  
  // Map currentWidgetIndex to the filtered array
  const actualIndex = Math.min(currentWidgetIndex, filteredWidgets.length - 1);
  const cards = [];
  
  // First, add the current card (stackIndex 0)
  cards.push({
    index: actualIndex,
    widget: filteredWidgets[actualIndex],
    stackIndex: 0
  });
  
  // Then add all other widgets in circular order (starting from next, wrapping around)
  let stackIndex = 1;
  // Add widgets after current
  for (let i = actualIndex + 1; i < filteredWidgets.length; i++) {
    cards.push({
      index: i,
      widget: filteredWidgets[i],
      stackIndex: stackIndex++
    });
  }
  // Add widgets before current (wrapping around)
  for (let i = 0; i < actualIndex; i++) {
    cards.push({
      index: i,
      widget: filteredWidgets[i],
      stackIndex: stackIndex++
    });
  }
  
  return cards;
};

// Widget tweaks catalog
export const widgetTweaksCatalog = {
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

// Utility functions
export const cloneConfig = (config) => (config ? JSON.parse(JSON.stringify(config)) : null);
export const getWidgetTweaks = (widgetType) => widgetTweaksCatalog[widgetType] || [];
export const getWidgetIdeaByType = (widgetType) => abTestIdeas.find(idea => idea.blockId === widgetType);
export const getTweakLabel = (widgetType, tweakId) => {
  if (!widgetType || !tweakId) return null;
  const tweaks = getWidgetTweaks(widgetType);
  const tweak = tweaks.find(t => t.id === tweakId);
  return tweak ? tweak.title : null;
};

// Map widget utility to appropriate goal
export const getGoalForWidget = (widget) => {
  if (!widget) return null;
  
  // "How Many in Cart" works with Social Proof or Urgency - default to Social Proof
  if (widget.utility === 'How Many in Cart') {
    return 'Social Proof';
  }
  // "Free Shipping Badge" and "Returns Guarantee Badge" work with Trust
  if (widget.utility === 'Free Shipping Badge' || widget.utility === 'Returns Guarantee Badge') {
    return 'Trust';
  }
  // Default fallback
  return 'Social Proof';
};
