import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import React, { useState, useEffect, useCallback } from "react";
import { authenticate, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server.js";
import { checkBillingStatus } from "../utils/billing.server.js";
import WidgetLivePreview from "../components/WidgetLivePreview.jsx";
import ConversionPlayCard from "../components/ConversionPlayCard.jsx";
import { abTestIdeas } from "../data/abTestIdeas.js";
import freeShippingBadgeImage from "../assets/free-shipping-badge.png";
import moneyBackGuaranteeImage from "../assets/money-back-guarantee.png";
import addToCartImage from "../assets/add-to-cart.png";

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
const figmaColors = {
  gray: "#e6e6e6",
  primaryBlue: "#0038ff",
  darkGray: "#151515"
};

export default function ABTests() {
  const { themes, products, productTemplates, shop } = useLoaderData();
  const navigate = useNavigate();

  // Wizard state variables
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [selectedWidgetConfig, setSelectedWidgetConfig] = useState(null);
  const [selectedWidgetTweakId, setSelectedWidgetTweakId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [wizardSelectedProductSnapshot, setWizardSelectedProductSnapshot] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);

  // Tinder swiper state
  const [currentWidgetIndex, setCurrentWidgetIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedConversionPlayIndex, setSelectedConversionPlayIndex] = useState(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 });
  
  // Use refs to track drag values to avoid stale closures
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const dragCurrentRef = React.useRef({ x: 0, y: 0 });
  
  // Wizard screenshot state
  const [wizardScreenshot, setWizardScreenshot] = useState(null);
  const [wizardScreenshotLoading, setWizardScreenshotLoading] = useState(false);
  const [storePassword, setStorePassword] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [currentProductPage, setCurrentProductPage] = useState(1);
  
  // Exit modal state
  const [showExitModal, setShowExitModal] = useState(false);
  
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
  
  // Step 4 (Launch) state
  const [testHypothesis, setTestHypothesis] = useState('');
  const [isEditingTestName, setIsEditingTestName] = useState(false);
  const [isEditingHypothesis, setIsEditingHypothesis] = useState(false);
  const [autopilotMode, setAutopilotMode] = useState('balanced'); // 'faster', 'balanced', 'extra-careful'
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autopilotOff, setAutopilotOff] = useState(false);
  const [autopilotOn, setAutopilotOn] = useState(true); // Default ON
  const [manualMode, setManualMode] = useState(false); // Default OFF
  const [fastMode, setFastMode] = useState(false);
  const [standardMode, setStandardMode] = useState(false);
  const [carefulMode, setCarefulMode] = useState(false);
  const [showFastTooltip, setShowFastTooltip] = useState(false);
  const [showStandardTooltip, setShowStandardTooltip] = useState(false);
  const [showCarefulTooltip, setShowCarefulTooltip] = useState(false);
  const [trafficSplitA, setTrafficSplitA] = useState(50);
  const [trafficSplitB, setTrafficSplitB] = useState(50);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [endOnDate, setEndOnDate] = useState('');
  const [endOnImpressions, setEndOnImpressions] = useState('');
  const [endOnConversions, setEndOnConversions] = useState('');
  const [requireMinimumDays, setRequireMinimumDays] = useState(7);
  const [autoPushWinner, setAutoPushWinner] = useState(false);
  const [goalMetric, setGoalMetric] = useState('Add to Cart');
  const [endOnImpressionsEnabled, setEndOnImpressionsEnabled] = useState(false);
  const [impressionsThreshold, setImpressionsThreshold] = useState('');
  
  // Widget settings config tab state
  const [activeSettingsTab, setActiveSettingsTab] = useState('Text Content');
  
  // Widget settings state (for simple-text-badge)
  const [widgetSettings, setWidgetSettings] = useState({
    enable_step_2: false,
    headerText: '',
    header_font: 'system',
    header_font_size: 24,
    header_underline: false,
    bodyText: '',
    body_font: 'system',
    body_font_size: 16,
    body_underline: false,
    header_body_spacing: 6,
    icon_text_spacing: 20,
    inner_padding_horizontal: 24,
    inner_padding_vertical: 16,
    inner_padding_horizontal_mobile: 16,
    inner_padding_vertical_mobile: 12,
    outer_padding_horizontal: 0,
    outer_padding_vertical: 0,
    outer_padding_horizontal_mobile: 0,
    outer_padding_vertical_mobile: 0,
    icon_choice: 'star',
    icon_custom: '',
    icon_blink: false,
    icon_blink_intensity: 50,
    icon_size: 36,
    icon_size_mobile: 30,
    border_radius: 8,
    border_thickness: 1,
    hover_effect: true,
    drop_shadow: 10,
    header_color: '#0f172a',
    textColor: '#1a5f5f',
    backgroundColor: '#f5f5f0',
    border_color: '#d4d4d8',
    count_min: 40,
    count_max: 60
  });
  const [isVariantTemplateReady, setIsVariantTemplateReady] = useState(false);
  const [isVariantRequestInFlight, setIsVariantRequestInFlight] = useState(false);
  const [isBlockSaved, setIsBlockSaved] = useState(false);
  const [isCheckingBlockSaved, setIsCheckingBlockSaved] = useState(false);
  const [isCheckingProductInTest, setIsCheckingProductInTest] = useState(false);
  const [productInTestError, setProductInTestError] = useState(null);

  // abTestIdeas is now imported from shared data file

  // Background colors for each widget type - more vibrant and distinct
  const getWidgetBackgroundColor = (utility) => {
    const colorMap = {
      'Free Shipping Badge': '#DBEAFE', // Brighter baby blue
      'How Many in Cart': '#FEF08A', // Brighter yellow/amber
      'Returns Guarantee Badge': '#DBEAFE' // Brighter baby blue (same as Free Shipping Badge)
    };
    return colorMap[utility] || '#F3F4F6'; // Default gray
  };

  // Filter conversion plays based on selected goal
  const getFilteredConversionPlays = () => {
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
  const getVisibleCards = () => {
    const filteredWidgets = getFilteredConversionPlays();
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

  const resetSwiper = () => {
    setCurrentStep(0);
    setSelectedGoal(null);
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
    setSelectedProduct(null);
    setIsBlockSaved(false);
  };

  // Tinder swiper functions
  const handleSwipe = (direction) => {
    if (isAnimating || isDragging) return;
    
    setIsAnimating(true);
    setSwipeDirection(direction);
    
    if (direction === 'like') {
      const filteredWidgets = getFilteredConversionPlays();
      if (filteredWidgets.length === 0 || currentWidgetIndex >= filteredWidgets.length) {
        setIsAnimating(false);
        setSwipeDirection(null);
        return;
      }
      const selectedWidget = filteredWidgets[currentWidgetIndex];
      if (!selectedWidget) {
        setIsAnimating(false);
        setSwipeDirection(null);
        return;
      }
      
      // Auto-populate settings for How Many in Cart
      if (selectedWidget.id === 1 && selectedWidget.utility === 'How Many in Cart') {
        setWidgetSettings({
          enable_step_2: false,
          headerText: '',
          header_font: 'system',
          header_font_size: 24,
          header_underline: false,
          bodyText: '<p><em><strong> 0</strong></em> <strong>people</strong> &nbsp;currently have this in their carts.</p>',
          body_font: 'system',
          body_font_size: 14,
          body_underline: false,
          header_body_spacing: 6,
          icon_text_spacing: 16,
          inner_padding_horizontal: 16,
          inner_padding_vertical: 10,
          inner_padding_horizontal_mobile: 16,
          inner_padding_vertical_mobile: 12,
          outer_padding_horizontal: 0,
          outer_padding_vertical: 0,
          outer_padding_horizontal_mobile: 0,
          outer_padding_vertical_mobile: 0,
          icon_choice: 'star',
          icon_custom: 'shopify://shop_images/007-shopping-bag.png',
          icon_blink: false,
          icon_blink_intensity: 50,
          icon_size: 16,
          icon_size_mobile: 14,
          border_radius: 4,
          border_thickness: 0,
          hover_effect: true,
          drop_shadow: 0,
          header_color: '#0f172a',
          textColor: '#1a5f5f',
          backgroundColor: '#e6e6e6',
          border_color: '#d4d4d8',
          count_min: 4,
          count_max: 13
        });
      }
      
      // Auto-populate settings for Free Shipping Badge
      if (selectedWidget.id === 2 && selectedWidget.utility === 'Free Shipping Badge') {
        setWidgetSettings({
          enable_step_2: false,
          headerText: '',
          header_font: 'system',
          header_font_size: 24,
          header_underline: false,
          bodyText: 'Ships free - no surprises at checkout',
          body_font: 'system',
          body_font_size: 13,
          body_underline: false,
          header_body_spacing: 6,
          icon_text_spacing: 10,
          inner_padding_horizontal: 12,
          inner_padding_vertical: 13,
          inner_padding_horizontal_mobile: 13,
          inner_padding_vertical_mobile: 12,
          outer_padding_horizontal: 0,
          outer_padding_vertical: 0,
          outer_padding_horizontal_mobile: 0,
          outer_padding_vertical_mobile: 0,
          icon_choice: 'none',
          icon_custom: 'shopify://shop_images/039-delivery.png',
          icon_blink: false,
          icon_blink_intensity: 50,
          icon_size: 18,
          icon_size_mobile: 18,
          border_radius: 8,
          border_thickness: 0,
          hover_effect: false,
          drop_shadow: 0,
          header_color: '#0f172a',
          textColor: '#121212',
          backgroundColor: '#f2f2f2',
          border_color: '#d4d4d8'
        });
      }
      
      // Auto-populate settings for Returns Guarantee Badge
      if (selectedWidget.id === 3 && selectedWidget.utility === 'Returns Guarantee Badge') {
        setWidgetSettings({
          enable_step_2: false,
          headerText: '',
          header_font: 'system',
          header_font_size: 24,
          header_underline: false,
          bodyText: '<p><strong>90-Day Money-Back Guarantee</strong> Not totally thrilled with your purchase? No sweat! Shoot us a message within 90 days, and we\'ll hustle to set things right.</p>',
          body_font: 'system',
          body_font_size: 12,
          body_underline: false,
          header_body_spacing: 6,
          icon_text_spacing: 10,
          inner_padding_horizontal: 12,
          inner_padding_vertical: 13,
          inner_padding_horizontal_mobile: 16,
          inner_padding_vertical_mobile: 12,
          outer_padding_horizontal: 0,
          outer_padding_vertical: 0,
          outer_padding_horizontal_mobile: 0,
          outer_padding_vertical_mobile: 0,
          icon_choice: 'none',
          icon_custom: '',
          icon_blink: false,
          icon_blink_intensity: 50,
          icon_size: 18,
          icon_size_mobile: 30,
          border_radius: 8,
          border_thickness: 0,
          hover_effect: true,
          drop_shadow: 0,
          header_color: '#0f172a',
          textColor: '#121212',
          backgroundColor: '#f2f2f2',
          border_color: '#d4d4d8'
        });
      }
      
      applyWidgetIdeaSelection(selectedWidget);
      setTimeout(() => {
        setCurrentStep(1);
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 400);
    } else {
      setTimeout(() => {
        if (currentWidgetIndex < abTestIdeas.length - 1) {
          setCurrentWidgetIndex(currentWidgetIndex + 1);
        } else {
          setCurrentWidgetIndex(0);
        }
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 400);
    }
  };

  // Drag handlers
  const handleDragMove = useCallback((e) => {
    if (!isDragging || isAnimating) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragCurrentRef.current = { x: clientX, y: clientY };
    setDragCurrent({ x: clientX, y: clientY });
  }, [isDragging, isAnimating]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || isAnimating) return;
    
    // Use refs to get the most current values
    const current = dragCurrentRef.current;
    const start = dragStartRef.current;
    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const threshold = 50; // Minimum drag distance to trigger navigation
    
    if (dragDistance > threshold) {
      // Determine direction based on horizontal movement
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Only move one widget at a time
        if (deltaX > 0) {
          // Dragged right - go to next widget (only one step)
          setCurrentWidgetIndex(prevIndex => {
            if (prevIndex < abTestIdeas.length - 1) {
              return prevIndex + 1;
            } else {
              return 0; // Wrap around
            }
          });
        } else {
          // Dragged left - go to previous widget (only one step)
          setCurrentWidgetIndex(prevIndex => {
            if (prevIndex > 0) {
              return prevIndex - 1;
            } else {
              return abTestIdeas.length - 1; // Wrap around
            }
          });
        }
      }
    }
    
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
    setDragCurrent({ x: 0, y: 0 });
    dragStartRef.current = { x: 0, y: 0 };
    dragCurrentRef.current = { x: 0, y: 0 };
  }, [isDragging, isAnimating]);

  const handleDragStart = (e) => {
    if (isAnimating) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const startPos = { x: clientX, y: clientY };
    setIsDragging(true);
    setDragStart(startPos);
    setDragCurrent(startPos);
    dragStartRef.current = startPos;
    dragCurrentRef.current = startPos;
  };

  // Add document-level event listeners for better drag handling
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);

      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

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

  // Check if app block has been saved in the template
  const checkIfBlockSaved = async () => {
    if (!wizardVariantName || !themes?.length) {
      alert('Template information not available. Please ensure the template has been duplicated.');
      return false;
    }

    const mainTheme = themes.find(t => t.role === 'MAIN');
    if (!mainTheme) {
      alert('Main theme not found.');
      return false;
    }

    const themeId = mainTheme.id.replace('gid://shopify/OnlineStoreTheme/', '');
    
    setIsCheckingBlockSaved(true);
    
    try {
      const formData = new FormData();
      formData.append('templateName', `product.${wizardVariantName}`);
      formData.append('themeId', themeId);

      const response = await fetch('/api/check-block-saved', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        setIsBlockSaved(result.blockExists);
        
        if (result.blockExists) {
          console.log('✅ App block found in template:', result.blockDetails);
        } else {
          console.log('❌ App block not found in template');
        }
        return result.blockExists;
      } else {
        console.error('❌ Failed to check block status:', result.error);
        alert(`Failed to check if widget is saved: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error checking block status:', error);
      alert('Error checking if widget is saved. Please try again.');
      return false;
    } finally {
      setIsCheckingBlockSaved(false);
    }
    return false;
  };

  // Generate preview URL for wizard
  const generateWizardPreviewUrl = (productHandle, themeId) => {
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '');
    const baseUrl = `https://${shop}`;
    const previewUrl = `${baseUrl}/products/${productHandle}?preview_theme_id=${cleanThemeId}`;
    return previewUrl;
  };

  const handleProductSelection = (product) => {
    setSelectedProduct(product);
    if (product) {
      setWizardSelectedProductSnapshot(product);
    }
    // Clear variant-related state when selecting a new product
    setWizardVariantProductHandle(null);
    setWizardVariantProductId(null);
    setWizardVariantProductTitle('');
    setWizardVariantName('');
    setWizardVariantTemplateFilename('');
    setIsVariantTemplateReady(false);
    setWizardLaunchError(null);
    setWizardLaunchSuccess(null);
    setProductInTestError(null); // Clear product in test error when selecting a new product
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

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const variantName = `trylabs-variant-${randomDigits}`;

    let creationResult = { success: false };

    try {
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
      
      let baseTemplate;
      if (activeProduct.templateSuffix) {
        baseTemplate = `templates/product.${activeProduct.templateSuffix}.liquid`;
      } else {
        const exactDefaults = [
          'templates/product.json',
          'templates/product.liquid'
        ];
        
        baseTemplate = exactDefaults.find(template => productTemplates.includes(template));
        
        if (!baseTemplate) {
          const productTemplatesWithoutSuffix = productTemplates.filter(template => {
            const name = template.replace('templates/', '').replace('.liquid', '').replace('.json', '');
            return name === 'product';
          });
          
          if (productTemplatesWithoutSuffix.length > 0) {
            baseTemplate = productTemplatesWithoutSuffix[0];
          } else {
            baseTemplate = productTemplates.find(template => 
              template.includes('product') && 
              (template.endsWith('.liquid') || template.endsWith('.json'))
            );
            
            if (!baseTemplate) {
              baseTemplate = productTemplates[0] || 'templates/product.liquid';
            }
          }
        }
      }
      
      const templateExists = productTemplates.includes(baseTemplate);
      if (!templateExists) {
        baseTemplate = productTemplates[0] || 'templates/product.liquid';
      }
      
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
        setWizardVariantName(variantName);
        setWizardVariantProductId(productId || null);
        setWizardVariantProductHandle(productHandle);
        setWizardVariantProductTitle(productTitle);
        setWizardVariantTemplateFilename(result.newFilename);
        setIsVariantTemplateReady(true);

        // Note: We no longer assign the product to the variant template here.
        // The product will only be assigned to the variant template if it wins the A/B test.
        // Assignment happens temporarily when opening the theme editor, and permanently only when variant wins.

        creationResult = { success: true, variantName, newFilename: result.newFilename };
      } else {
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

  // Open variant in theme editor
  const openVariantInThemeEditor = async () => {
    try {
      if (!wizardVariantName) {
        alert('Variant template has not been created yet. Please duplicate the template first.');
        return;
      }

      if (!isVariantTemplateReady) {
        alert('We are still preparing the duplicated template. Please wait a moment and try again.');
        return;
      }

      const mainTheme = themes.find(t => t.role === 'MAIN');
      if (!mainTheme) {
        return;
      }
      const numericThemeId = mainTheme.id.replace('gid://shopify/OnlineStoreTheme/', '');
      const storeSubdomain = (shop || '').replace('.myshopify.com', '');

      if (!wizardVariantProductHandle) {
        alert('We could not determine which product to preview. Please go back, re-select your product, and duplicate the template again.');
        return;
      }

      // According to Shopify docs, we can preview alternate templates using the 'view' URL parameter
      // without assigning the template to the product. This prevents visitors from seeing unconfigured widgets.
      // Reference: https://shopify.dev/docs/storefronts/themes/architecture/templates/alternate-templates
      // 
      // We are NOT assigning the product to avoid exposing unconfigured widgets to visitors.
      // If Shopify redirects to a different product, the debug logs below will help diagnose the issue.
      
      // Use the product handle that was set when the template was duplicated
      const productHandleForPreview = wizardVariantProductHandle;
      const productIdForDebug = wizardVariantProductId || wizardSelectedProductSnapshot?.id || selectedProduct?.id;
      
      // Comprehensive debug logging to diagnose any redirect issues
      console.log('🔍 Opening theme editor - Debug Info:', {
        productHandle: productHandleForPreview,
        productId: productIdForDebug,
        productTitle: wizardVariantProductTitle || wizardSelectedProductSnapshot?.title || selectedProduct?.title,
        variantName: wizardVariantName,
        variantTemplateFilename: wizardVariantTemplateFilename,
        templateParam: `product.${wizardVariantName}`,
        selectedProductSnapshot: wizardSelectedProductSnapshot ? {
          id: wizardSelectedProductSnapshot.id,
          handle: wizardSelectedProductSnapshot.handle,
          title: wizardSelectedProductSnapshot.title,
          templateSuffix: wizardSelectedProductSnapshot.templateSuffix
        } : null,
        selectedProduct: selectedProduct ? {
          id: selectedProduct.id,
          handle: selectedProduct.handle,
          title: selectedProduct.title,
          templateSuffix: selectedProduct.templateSuffix
        } : null,
        assignmentStrategy: 'NO_ASSIGNMENT - Using view parameter only'
      });
      
      // Validate we have the required data
      if (!productHandleForPreview) {
        console.error('❌ Missing product handle - cannot open theme editor');
        alert('We could not determine which product to preview. Please go back, re-select your product, and duplicate the template again.');
        return;
      }
      
      if (!wizardVariantName) {
        console.error('❌ Missing variant name - cannot open theme editor');
        alert('Variant template has not been created yet. Please duplicate the template first.');
        return;
      }
      // For OS 2.0 JSON templates, the template param should be: product.<suffix>
      // This tells Shopify which template file to load in the editor
      const templateParam = `product.${wizardVariantName}`;

      // The previewPath must include ?view=<suffix> to ensure Shopify uses the correct template
      // This is critical - without it, Shopify will use the product's default template assignment
      // Build preview path with view parameter to use the alternate template without assignment
      // The 'view' parameter tells Shopify to use the specified template suffix
      const previewParams = new URLSearchParams();
      previewParams.set('view', wizardVariantName); // Critical: This makes Shopify use the variant template
      
      if (selectedIdea?.blockId && selectedWidgetConfig) {
        const encodedConfig = encodeWidgetConfigPayload({
          widgetType: selectedIdea.blockId,
          settings: selectedWidgetConfig
        });
        if (encodedConfig) {
          previewParams.set('ab_widget_config', encodedConfig);
        }
      }
      
      const previewPath = `/products/${productHandleForPreview}?${previewParams.toString()}`;
      const encodedPreviewPath = encodeURIComponent(previewPath);
      
      console.log('🔍 Preview path details:', {
        previewPath: previewPath,
        encodedPreviewPath: encodedPreviewPath,
        viewParameter: wizardVariantName,
        productHandle: productHandleForPreview
      });

      const apiKey = "5ff212573a3e19bae68ca45eae0a80c4";
      const widgetHandle = selectedIdea?.blockId || null;
      
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
          }
        } catch (checkError) {
          console.error('⚠️ Error checking if widget exists:', checkError);
        }
      }
      
      const addBlockParams = (widgetHandle && !blockAlreadyExists)
        ? `&addAppBlockId=${apiKey}/${widgetHandle}&target=mainSection`
        : '';

      const cacheBuster = `&_t=${Date.now()}`;

      const editorUrl = `https://admin.shopify.com/store/${storeSubdomain}/themes/${numericThemeId}/editor?template=${encodeURIComponent(templateParam)}&previewPath=${encodedPreviewPath}${addBlockParams}${cacheBuster}`;

      console.log('🔍 Final theme editor URL:', {
        url: editorUrl,
        templateParam: templateParam,
        previewPath: previewPath,
        hasViewParam: previewParams.has('view'),
        viewValue: previewParams.get('view')
      });

      const themeEditorWindow = window.open(editorUrl, '_blank');
      
      // Debug: Log what we expect vs what might happen
      console.log('🔍 Theme Editor Opening - Expected Behavior:', {
        expectedProductHandle: productHandleForPreview,
        expectedProductTitle: wizardVariantProductTitle || wizardSelectedProductSnapshot?.title || selectedProduct?.title,
        expectedTemplate: `product.${wizardVariantName}`,
        previewPathIncludesView: previewPath.includes('view='),
        viewParameterValue: wizardVariantName,
        strategy: 'Using view parameter WITHOUT product assignment to prevent visitors from seeing unconfigured widgets'
      });
      
      console.log('⚠️ DEBUGGING: If the theme editor shows a DIFFERENT product, check:', {
        possibleCauses: [
          'Shopify may require product assignment for theme editor preview (despite docs saying view param should work)',
          'Another product may have this template assigned and Shopify is defaulting to it',
          'The view parameter may not be working as expected in theme editor context'
        ],
        whatToCheck: [
          'Check the URL in the theme editor - does it show the correct product handle?',
          'Does the previewPath in the URL include ?view=' + wizardVariantName + '?',
          'What product is actually displayed in the theme editor?'
        ],
        fallbackSolution: 'If view parameter alone doesn\'t work, we may need to temporarily assign the product, but this exposes unconfigured widgets to visitors'
      });
      
      // Monitor window (though we can't read cross-origin URLs)
      if (themeEditorWindow) {
        setTimeout(() => {
          console.log('🔍 Theme editor opened. Please check:', {
            instruction: 'Look at the theme editor URL and verify:',
            checks: [
              '1. Does the previewPath show the correct product handle?',
              '2. Does it include ?view=' + wizardVariantName + '?',
              '3. What product is actually displayed in the preview?',
              '4. If wrong product, note which product it shows'
            ]
          });
        }, 1000);
      }
      
      // Note: We are NOT assigning the product to the variant template.
      // According to Shopify docs (https://shopify.dev/docs/storefronts/themes/architecture/templates/alternate-templates),
      // the 'view' parameter in previewPath should allow previewing the alternate template without assignment.
      // This prevents visitors from seeing unconfigured widgets.
      // If Shopify redirects to a different product, the debug logs above will help diagnose the issue.

      if (widgetHandle && selectedIdea?.blockId === 'simple-text-badge' && widgetSettings && Object.keys(widgetSettings).length > 0) {
        const formatText = (text) => {
          if (!text || text.trim() === '') return '<p></p>';
          if (text.trim().startsWith('<')) return text;
          return `<p>${text}</p>`;
        };
        
        const finalBlockSettings = {
          enable_step_2: widgetSettings.enable_step_2 || false,
          header_text: formatText(widgetSettings.headerText),
          header_font: widgetSettings.header_font || 'system',
          header_font_size: widgetSettings.header_font_size || 24,
          header_underline: widgetSettings.header_underline || false,
          body_text: formatText(widgetSettings.bodyText),
          body_font: widgetSettings.body_font || 'system',
          body_font_size: widgetSettings.body_font_size || 16,
          body_underline: widgetSettings.body_underline || false,
          header_body_spacing: widgetSettings.header_body_spacing || 6,
          icon_text_spacing: widgetSettings.icon_text_spacing || 20,
          inner_padding_horizontal: widgetSettings.inner_padding_horizontal || 24,
          inner_padding_vertical: widgetSettings.inner_padding_vertical || 16,
          inner_padding_horizontal_mobile: widgetSettings.inner_padding_horizontal_mobile || 16,
          inner_padding_vertical_mobile: widgetSettings.inner_padding_vertical_mobile || 12,
          outer_padding_horizontal: widgetSettings.outer_padding_horizontal || 0,
          outer_padding_vertical: widgetSettings.outer_padding_vertical || 0,
          outer_padding_horizontal_mobile: widgetSettings.outer_padding_horizontal_mobile || 0,
          outer_padding_vertical_mobile: widgetSettings.outer_padding_vertical_mobile || 0,
          icon_choice: widgetSettings.icon_choice || 'star',
          icon_custom: widgetSettings.icon_custom || '',
          icon_blink: widgetSettings.icon_blink || false,
          icon_blink_intensity: widgetSettings.icon_blink_intensity || 50,
          icon_size: widgetSettings.icon_size || 36,
          icon_size_mobile: widgetSettings.icon_size_mobile || 30,
          border_radius: widgetSettings.border_radius || 8,
          border_thickness: widgetSettings.border_thickness || 1,
          hover_effect: widgetSettings.hover_effect !== undefined ? widgetSettings.hover_effect : true,
          drop_shadow: widgetSettings.drop_shadow || 10,
          header_color: widgetSettings.header_color || '#0f172a',
          text_color: widgetSettings.textColor || '#1a5f5f',
          background_color: widgetSettings.backgroundColor || '#f5f5f0',
          border_color: widgetSettings.border_color || '#d4d4d8'
        };
        
        // If this is How Many in Cart, add the conversion play type and count settings
        if (selectedIdea?.utility === 'How Many in Cart') {
          finalBlockSettings.conversion_play_type = 'how-many-in-cart';
          finalBlockSettings.count_min = widgetSettings.count_min || 4;
          finalBlockSettings.count_max = widgetSettings.count_max || 13;
        }

        const updateBlockSettings = async (attempt = 1, maxAttempts = 5) => {
          try {
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
              return true;
            } else {
              if (updateResponse.status === 404 && attempt < maxAttempts) {
                const delay = attempt * 2000;
                setTimeout(() => updateBlockSettings(attempt + 1, maxAttempts), delay);
              }
            }
          } catch (error) {
            if (attempt < maxAttempts) {
              const delay = attempt * 2000;
              setTimeout(() => updateBlockSettings(attempt + 1, maxAttempts), delay);
            }
          }
        };

        if (blockAlreadyExists) {
          updateBlockSettings();
        } else {
          setTimeout(() => updateBlockSettings(), 3000);
        }
      }
    } catch (error) {
      console.error('❌ Error opening theme editor:', error);
      alert('Failed to open theme editor. Please try again.');
    }
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

    // Determine endResultType based on mode selection
    const endResultType = autopilotOn ? 'auto-pilot' : 'manual';
    
    // Determine which mode was selected for autopilot
    let selectedMode = null;
    if (autopilotOn) {
      if (fastMode) selectedMode = 'fast';
      else if (standardMode) selectedMode = 'standard';
      else if (carefulMode) selectedMode = 'careful';
    }

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
      widgetSettings: selectedWidgetConfig || null,
      endResultType: endResultType,
      endDate: manualMode && endOnDate ? endOnDate : null,
      autopilotMode: selectedMode
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
        resetSwiper();
        navigate('/app');
      }, 1500);
    } catch (error) {
      console.error('❌ Failed to launch A/B test!:', error);
      setWizardLaunchError(error.message || 'Failed to launch A/B test. Please try again.');
    } finally {
      setIsLaunchingTest(false);
    }
  };

  useEffect(() => {
    if (wizardSelectedProductSnapshot && selectedIdea && !wizardTestName) {
      const ideaLabel = selectedIdea.utility || 'Widget';
      const productLabel = wizardSelectedProductSnapshot.title || 'Product';
      setWizardTestName(`${ideaLabel} on ${productLabel}`);
    }
  }, [wizardSelectedProductSnapshot, selectedIdea, wizardTestName]);

  useEffect(() => {
    if (selectedIdea && wizardSelectedProductSnapshot && !testHypothesis) {
      const utility = selectedIdea.utility || 'widget';
      const placement = 'the product page'; // Could be dynamic based on widget placement
      setTestHypothesis(`Adding a ${utility} near ${placement} will increase **Add to Cart**.`);
    }
  }, [selectedIdea, wizardSelectedProductSnapshot, testHypothesis]);

  // Clear selection when navigating to a different widget
  useEffect(() => {
    setSelectedConversionPlayIndex(null);
  }, [currentWidgetIndex]);

  // Reset widget index when goal changes
  useEffect(() => {
    setCurrentWidgetIndex(0);
    setSelectedConversionPlayIndex(null);
  }, [selectedGoal]);

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
    wizardSelectedProductSnapshot &&
    (manualMode ? endOnDate : (fastMode || standardMode || carefulMode)) // Require mode selection if autopilot, or end date if manual
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#e6e6e6',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '32px',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        paddingBottom: '32px'
      }}>
        {/* Progress Bar */}
        <div style={{
          background: '#e6e6e6',
          padding: '24px 32px',
          marginBottom: '32px',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {[1, 2, 3, 4, 5].map((step) => {
              const isActive = currentStep + 1 === step;
              const isCompleted = currentStep + 1 > step;
              const stepIndex = step - 1; // Convert to 0-indexed
              
              return (
                <React.Fragment key={step}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <button
                      onClick={() => setCurrentStep(stepIndex)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: isActive ? '#3B82F6' : '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.background = isCompleted ? '#3B82F6' : '#4B5563';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.background = '#374151';
                        }
                      }}
                      title={`Go to step ${step}`}
                    >
                      {isActive ? (
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#FFFFFF'
                        }} />
                      ) : (
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#FFFFFF'
                        }}>
                          {step}
                        </span>
                      )}
                    </button>
                  </div>
                  {step < 5 && (
                    <div style={{
                      width: '60px',
                      height: '1px',
                      background: isCompleted ? '#3B82F6' : '#374151',
                      margin: '0 4px'
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        <div style={{
          fontSize: '14px',
          color: '#374151',
          textAlign: 'center',
          marginTop: '16px'
        }}>
          Step {currentStep + 1} of 5
        </div>
        
        {/* Exit Button */}
        <button
          onClick={() => setShowExitModal(true)}
          style={{
            position: 'absolute',
            top: '24px',
            right: '32px',
            background: '#FFFFFF',
            border: '1px solid #1F2937',
            borderRadius: '20px',
            padding: '12px 32px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500',
            color: '#1F2937',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1F2937';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FFFFFF';
            e.currentTarget.style.color = '#1F2937';
          }}
        >
          Exit
        </button>
      </div>
      
      {/* Exit Modal */}
      {showExitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setShowExitModal(false)}
        >
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#000000',
              margin: '0 0 16px 0'
            }}>
              Are you absolutely sure?
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: '0 0 24px 0',
              lineHeight: '1.5'
            }}>
              This action cannot be undone. All changes will be discarded.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowExitModal(false)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  navigate('/app');
                }}
                style={{
                  background: '#ef9362',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#FFFFFF',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e67e52';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef9362';
                }}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Step 0: Pick an Idea - Goal Selection */}
        {currentStep === 0 && (
          <div style={{
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateX(0)',
            opacity: 1,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            justifyContent: 'center',
            gap: '24px',
            padding: '40px 20px',
            minHeight: '500px'
          }}>
            {/* Goal Selection Card - Left Side */}
            <div style={{
              background: 'linear-gradient(135deg, rgb(126, 200, 227) 0%, rgb(91, 168, 212) 50%, rgb(74, 148, 196) 100%)',
              borderRadius: '16px',
              padding: '40px',
              width: '100%',
              maxWidth: '600px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              minHeight: '100%',
              boxSizing: 'border-box'
            }}>
              {/* Title */}
              <p style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 16px 0'
              }}>
                SELECT YOUR GOAL
              </p>
              
              {/* Main Question */}
              <h3 style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#FFFFFF',
                margin: '0 0 32px 0',
                lineHeight: '1.2'
              }}>
                What do you want to improve?
              </h3>

              {/* Goal Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {[
                  { 
                    goal: 'Trust', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/%3E%3Cpath d='M9 12l2 2 4-4'/%3E%3C/svg%3E",
                    description: 'Make shoppers feel safe, confident, and comfortable buying.'
                  },
                  { 
                    goal: 'Urgency', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3Cpath d='M8 12l4 4'/%3E%3C/svg%3E",
                    description: 'Create a feeling that buying NOW is better than later.'
                  },
                  { 
                    goal: 'Scarcity', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z'/%3E%3Cline x1='3' y1='6' x2='21' y2='6'/%3E%3Cpath d='M16 10a4 4 0 0 1-8 0'/%3E%3C/svg%3E",
                    description: 'Make shoppers feel the product may run out.'
                  },
                  { 
                    goal: 'Social Proof', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='9' cy='7' r='4'/%3E%3Cpath d='M23 21v-2a4 4 0 0 0-3-3.87'/%3E%3Cpath d='M16 3.13a4 4 0 0 1 0 7.75'/%3E%3C/svg%3E",
                    description: 'Show that others validate the product.'
                  },
                  { 
                    goal: 'Value Perception', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='12' y1='1' x2='12' y2='23'/%3E%3Cpath d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/%3E%3C/svg%3E",
                    description: 'Make the offer stupidly easy to understand.'
                  }
                ].map(({ goal, icon, description }) => {
                  const isSelected = selectedGoal === goal;
                  
                  return (
                    <button
                      key={goal}
                      onClick={() => {
                        setSelectedGoal(goal);
                      }}
                      style={{
                        backgroundColor: selectedGoal && !isSelected ? 'rgba(59, 130, 246, 0.08)' : '#FFFFFF',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '32px 36px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: selectedGoal && !isSelected ? 'rgba(31, 41, 55, 0.6)' : '#1F2937',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: selectedGoal && !isSelected ? '0 1px 2px rgba(0, 0, 0, 0.03)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        width: '100%',
                        minHeight: '90px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedGoal || isSelected) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedGoal || isSelected) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = selectedGoal && !isSelected ? '0 1px 2px rgba(0, 0, 0, 0.03)' : '0 2px 4px rgba(0, 0, 0, 0.05)';
                        }
                      }}
                    >
                      {/* Icon with subtle blue circular background */}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        backgroundColor: selectedGoal && !isSelected ? 'rgba(59, 130, 246, 0.15)' : '#E0F2FE',
                        borderRadius: '50%',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}>
                        <img src={icon} alt="" style={{ 
                          width: '28px', 
                          height: '28px',
                          opacity: selectedGoal && !isSelected ? 0.7 : 1,
                          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} />
                      </div>
                    
                    {/* Text Content */}
                    <div style={{ flex: 1 }}>
                      <p style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: '600',
                        color: selectedGoal && !isSelected ? '#FFFFFF' : '#1F2937',
                        marginBottom: '6px',
                        transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}>
                        {goal}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: '400',
                        color: selectedGoal && !isSelected ? '#FFFFFF' : '#6B7280',
                        lineHeight: '1.4',
                        transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}>
                        {description}
                      </p>
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>

            {/* Tinder Swiper - Right Side (appears when goal is selected) */}
            {selectedGoal && (
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '40px',
                width: '100%',
                maxWidth: '600px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
                boxSizing: 'border-box',
                overflow: 'visible',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}>
                {/* Title with Arrows */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px'
                }}>
                  <p style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    margin: 0
                  }}>
                    CHOOSE YOUR CONVERSION PLAY
                  </p>
                  
                  {/* Navigation Arrows */}
                  <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
                    {/* Left Arrow - Simple gray chevron */}
                    <div 
                      onClick={() => {
                        const filteredWidgets = getFilteredConversionPlays();
                        setCurrentWidgetIndex(prevIndex => {
                          if (prevIndex === 0) {
                            return filteredWidgets.length - 1; // Wrap to last widget
                          }
                          return prevIndex - 1;
                        });
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18l-6-6 6-6" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    
                    {/* Right Arrow - Same size as left */}
                    <div 
                      onClick={() => {
                        const filteredWidgets = getFilteredConversionPlays();
                        setCurrentWidgetIndex(prevIndex => {
                          if (prevIndex === filteredWidgets.length - 1) {
                            return 0; // Wrap to first widget
                          }
                          return prevIndex + 1;
                        });
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M9 18l6-6-6-6" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div style={{
                  position: 'relative',
                  minWidth: '320px',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  flex: '0 0 auto',
                  boxSizing: 'border-box',
                  overflow: 'visible',
                  minHeight: '600px',
                  padding: '32px 0 120px 0'
                }}>
                  {/* Render stacked cards - show cards behind when dragging */}
                  {getVisibleCards().map(({ index, widget, stackIndex }) => {
                    if (!widget) return null;

                    const isCurrent = stackIndex === 0;
                    // Higher z-index for cards on top
                    const zIndex = 100 - stackIndex;
                    
                    // Calculate drag offset for current card only
                    let dragOffsetX = 0;
                    let dragOffsetY = 0;
                    
                    // Calculate deltaX for showing widget behind during drag
                    const deltaX = isDragging ? (dragCurrent.x - dragStart.x) : 0;
                    const showNextWidget = isDragging && Math.abs(deltaX) > 20;
                    
                    if (isCurrent && isDragging) {
                      dragOffsetX = dragCurrent.x - dragStart.x;
                      dragOffsetY = dragCurrent.y - dragStart.y;
                    }
                    
                    // Determine which widget to show behind when dragging
                    let shouldShow = false;
                    if (isCurrent) {
                      shouldShow = true; // Always show current
                    } else if (showNextWidget) {
                      // getVisibleCards puts widgets in order: current (0), next (1), next+1 (2), ..., prev (last)
                      if (deltaX > 0) {
                        // Dragging right - show next widget (which is at stackIndex 1)
                        shouldShow = stackIndex === 1;
                      } else if (deltaX < 0) {
                        // Dragging left - show previous widget (which is at the last stackIndex)
                        // Calculate total number of widgets
                        const totalWidgets = abTestIdeas.length;
                        const lastStackIndex = totalWidgets - 1; // Last widget is at this stackIndex
                        shouldShow = stackIndex === lastStackIndex;
                      }
                    }
                    
                    // Perfect alignment - no offset for cards behind when not dragging
                    // Center the card: left: 50% then translateX(-50%) to center, plus drag offset
                    // Use percentage for proper centering regardless of card width
                    const baseTranslateX = '-50%';
                    const translateX = isCurrent 
                      ? `calc(${baseTranslateX} + ${dragOffsetX}px)` 
                      : baseTranslateX;
                    const translateY = isCurrent ? dragOffsetY : 0;
                    
                    // Opacity: 100% for current, 0 for others unless dragging
                    const opacity = isCurrent ? 1 : (shouldShow ? 0.4 : 0);
                    const isSelected = isCurrent && selectedConversionPlayIndex === index;

                    return (
                      <div
                        key={`stack-${index}-${stackIndex}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: `translate(${translateX}, ${translateY}px)`,
                          zIndex: zIndex,
                          opacity: opacity,
                          transformOrigin: 'center center',
                          transition: isCurrent && !isDragging
                            ? 'all 0.3s ease' 
                            : !isCurrent 
                              ? `opacity 0.1s ease` // Fast transition when dragging
                              : 'none',
                          cursor: isCurrent ? (isDragging ? 'grabbing' : 'pointer') : 'default',
                          ...(isCurrent && isAnimating && swipeDirection === 'like' && {
                            animation: 'swipeRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                          }),
                          ...(isCurrent && isAnimating && swipeDirection === 'dislike' && {
                            animation: 'swipeLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                          })
                        }}
                      >
                        <ConversionPlayCard
                          widget={widget}
                          isSelected={isSelected}
                          onClick={(e) => {
                            // Only handle click if not dragging and it's the current card
                            if (isCurrent && !isDragging && !isAnimating) {
                              e.stopPropagation();
                              // Toggle selection: if already selected, deselect; otherwise select
                              if (selectedConversionPlayIndex === index) {
                                setSelectedConversionPlayIndex(null);
                              } else {
                                setSelectedConversionPlayIndex(index);
                              }
                            }
                          }}
                          dragHandlers={{
                            onMouseDown: isCurrent ? handleDragStart : undefined,
                            onTouchStart: isCurrent ? handleDragStart : undefined
                          }}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Navigation Dots - positioned absolutely at bottom of cards */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    bottom: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 200,
                    pointerEvents: 'auto'
                  }}>
                  {getFilteredConversionPlays().map((widget, index) => (
                    <button
                      key={`dot-${index}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentWidgetIndex(index);
                        setIsAnimating(false);
                        setSwipeDirection(null);
                      }}
                      type="button"
                      style={{
                        width: currentWidgetIndex === index ? '10px' : '8px',
                        height: currentWidgetIndex === index ? '10px' : '8px',
                        borderRadius: '50%',
                        background: currentWidgetIndex === index ? '#3B82F6' : '#9CA3AF',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.3s ease',
                        opacity: 1,
                        position: 'relative',
                        zIndex: 201,
                        pointerEvents: 'auto'
                      }}
                      aria-label={`Go to widget ${index + 1}`}
                    />
                  ))}
                  </div>
                </div>

                {/* Select/Next Button */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '16px',
                  paddingTop: '0px',
                  paddingBottom: '10px'
                }}>
                  <button
                    onClick={() => handleSwipe('like')}
                    disabled={isAnimating || selectedConversionPlayIndex === null}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #2563EB',
                      borderRadius: '20px',
                      padding: '12px 32px',
                      cursor: (isAnimating || selectedConversionPlayIndex === null) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '500',
                      color: '#2563EB',
                      transition: 'all 0.2s ease',
                      opacity: (isAnimating || selectedConversionPlayIndex === null) ? 0.5 : 1,
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      if (!isAnimating && selectedConversionPlayIndex !== null) {
                        e.currentTarget.style.background = '#2563EB';
                        e.currentTarget.style.color = '#FFFFFF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAnimating && selectedConversionPlayIndex !== null) {
                        e.currentTarget.style.background = '#FFFFFF';
                        e.currentTarget.style.color = '#2563EB';
                      }
                    }}
                  >
                    {selectedConversionPlayIndex !== null ? 'NEXT' : 'SELECT'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Choose Product & Preview */}
        {currentStep === 1 && (
          <div style={{
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateX(0)',
            opacity: 1
          }}>
            <h3 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '8px'
            }}>
              Select a product to test
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6B7280',
              marginBottom: '24px'
            }}>
              Choose a high-traffic product page from your store.
            </p>

            {/* Search Bar */}
            <div style={{
              position: 'relative',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'flex-start'
            }}>
              <div style={{
                position: 'relative',
                width: '400px',
                maxWidth: '100%'
              }}>
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  zIndex: 1
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setCurrentProductPage(1); // Reset to page 1 when searching
                  }}
                  placeholder="Search products..."
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 48px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    fontSize: '14px',
                    background: '#FFFFFF',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3B82F6';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB';
                  }}
                />
              </div>
            </div>

            {/* Filtered Products Grid */}
            {(() => {
              const filteredProducts = products.filter(product => 
                product.title.toLowerCase().includes(productSearchQuery.toLowerCase())
              );
              const productsPerPage = 12; // 3 rows × 4 columns
              const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
              const startIndex = (currentProductPage - 1) * productsPerPage;
              const endIndex = startIndex + productsPerPage;
              const currentPageProducts = filteredProducts.slice(startIndex, endIndex);
              
              // Reset to page 1 if current page is out of bounds
              if (currentProductPage > totalPages && totalPages > 0) {
                setCurrentProductPage(1);
              }
              
              return (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '20px',
                    marginBottom: '32px'
                  }}>
                    {currentPageProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      handleProductSelection(product);
                    }}
                    style={{
                      background: '#FFFFFF',
                      border: selectedProduct?.id === product.id ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: selectedProduct?.id === product.id ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transform: selectedProduct?.id === product.id ? 'scale(1.02)' : 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedProduct?.id !== product.id) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedProduct?.id !== product.id) {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    {/* Product Image */}
                    <div style={{
                      width: '100%',
                      aspectRatio: '1',
                      background: '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      {product.featuredImage ? (
                        <img
                          src={product.featuredImage.url}
                          alt={product.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: '#E5E7EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9CA3AF',
                          fontSize: '14px'
                        }}>
                          No Image
                        </div>
                      )}
                    </div>
                    
                    {/* Product Title */}
                    <div style={{
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: '1.4'
                      }}>
                        {product.title}
                      </h4>
                    </div>
                  </div>
                    ))}
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      marginBottom: '32px'
                    }}>
                      {/* Left Arrow */}
                      <button
                        onClick={() => {
                          if (currentProductPage > 1) {
                            setCurrentProductPage(currentProductPage - 1);
                          }
                        }}
                        disabled={currentProductPage === 1}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          background: currentProductPage === 1 ? '#F3F4F6' : '#FFFFFF',
                          cursor: currentProductPage === 1 ? 'not-allowed' : 'pointer',
                          opacity: currentProductPage === 1 ? 0.5 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (currentProductPage > 1) {
                            e.currentTarget.style.borderColor = '#3B82F6';
                            e.currentTarget.style.background = '#F0F9FF';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentProductPage > 1) {
                            e.currentTarget.style.borderColor = '#E5E7EB';
                            e.currentTarget.style.background = '#FFFFFF';
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={currentProductPage === 1 ? '#9CA3AF' : '#374151'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 18l-6-6 6-6"/>
                        </svg>
                      </button>
                      
                      {/* Page Number */}
                      <span style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        minWidth: '40px',
                        textAlign: 'center'
                      }}>
                        {currentProductPage}
                      </span>
                      
                      {/* Right Arrow */}
                      <button
                        onClick={() => {
                          if (currentProductPage < totalPages) {
                            setCurrentProductPage(currentProductPage + 1);
                          }
                        }}
                        disabled={currentProductPage === totalPages}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          background: currentProductPage === totalPages ? '#F3F4F6' : '#FFFFFF',
                          cursor: currentProductPage === totalPages ? 'not-allowed' : 'pointer',
                          opacity: currentProductPage === totalPages ? 0.5 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (currentProductPage < totalPages) {
                            e.currentTarget.style.borderColor = '#3B82F6';
                            e.currentTarget.style.background = '#F0F9FF';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentProductPage < totalPages) {
                            e.currentTarget.style.borderColor = '#E5E7EB';
                            e.currentTarget.style.background = '#FFFFFF';
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={currentProductPage === totalPages ? '#9CA3AF' : '#374151'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Product In Test Error Message */}
            {productInTestError && (
              <div style={{
                marginTop: '24px',
                padding: '12px 16px',
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                color: '#991B1B',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                {productInTestError}
              </div>
            )}

            {/* Next Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '24px',
              paddingRight: '10px'
            }}>
              <button
                onClick={async () => {
                  if (selectedProduct) {
                    // First, check if product is already in a running test
                    setIsCheckingProductInTest(true);
                    setProductInTestError(null);
                    
                    try {
                      const checkResponse = await fetch('/api/check-product-in-test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          productId: selectedProduct.id
                        })
                      });
                      
                      if (!checkResponse.ok) {
                        console.error('❌ Check product API returned error:', checkResponse.status, checkResponse.statusText);
                        // On API errors, show warning but allow continuation (fail open)
                        setProductInTestError(
                          'Unable to verify if this product is available. Please try again or contact support if this persists.'
                        );
                        setIsCheckingProductInTest(false);
                        // Don't return - allow continuation on errors
                      } else {
                        const checkResult = await checkResponse.json();
                        
                        if (checkResult.inUse) {
                          // Product is in use - BLOCK progression
                          setProductInTestError(
                            `This product is already being used in a running A/B test: "${checkResult.testName}". Please select a different product.`
                          );
                          setIsCheckingProductInTest(false);
                          return; // Block here
                        }
                        
                        // Product is available - clear any previous errors and continue
                        setProductInTestError(null);
                        setIsCheckingProductInTest(false);
                      }
                    } catch (checkError) {
                      console.error('❌ Error checking if product is in test:', checkError);
                      // Network errors - show warning but allow continuation (fail open)
                      setProductInTestError(
                        'Unable to verify if this product is available. Please check your connection and try again.'
                      );
                      setIsCheckingProductInTest(false);
                      // Don't return - allow continuation on network errors
                    }
                    
                    // Trigger template duplication when moving to step 2
                    const result = await createVariantTemplate();
                    if (result?.success) {
                      setCurrentStep(2);
                    } else {
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
                    }
                  }
                }}
                disabled={!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest}
                style={{
                  padding: '12px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#FFFFFF',
                  background: (!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest) 
                    ? '#D1D5DB' 
                    : '#3B82F6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest) 
                    ? 'not-allowed' 
                    : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: (!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest) 
                    ? 0.6 
                    : 1
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = '#2563EB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = '#3B82F6';
                  }
                }}
              >
                {isCheckingProductInTest 
                  ? 'Checking...' 
                  : isVariantRequestInFlight 
                    ? 'Duplicating Template...' 
                    : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Install your widget */}
        {currentStep === 2 && (
          <div style={{
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateX(0)',
            opacity: 1,
            display: 'flex',
            gap: '40px',
            alignItems: 'flex-start'
          }}>
            {/* Left side - Steps */}
            <div style={{ flex: 1, maxWidth: '600px' }}>
              <h2 style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1F2937',
                marginBottom: '12px'
              }}>
                Install your widget
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6B7280',
                marginBottom: '40px'
              }}>
                TryLab has already inserted your widget into your product template <strong>{wizardVariantName ? `product.${wizardVariantName}` : 'product'}</strong>. Just click Save in Shopify.
              </p>

            {/* Step 1: Open Shopify Theme Editor */}
            <div style={{
              marginBottom: '48px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#3B82F6',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    1
                  </div>
                  {/* Progress line */}
                  <div style={{
                    width: '2px',
                    height: '60px',
                    background: '#374151',
                    marginTop: '12px'
                  }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    margin: '0 0 8px 0'
                  }}>
                    Open Shopify Theme Editor
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: '0 0 16px 0',
                    lineHeight: '1.5'
                  }}>
                    This opens your product template with the TryLab widget pre-added.
                  </p>
                  <button
                    onClick={openVariantInThemeEditor}
                    disabled={!canOpenThemeEditor}
                    style={{
                      padding: '12px 24px',
                      background: canOpenThemeEditor ? '#3B82F6' : '#9CA3AF',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: canOpenThemeEditor ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isVariantRequestInFlight && !isVariantTemplateReady ? 'Preparing Theme Editor…' : 'Open Theme Editor'}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 8H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Press Save in Shopify */}
            <div style={{
              marginBottom: '48px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#9CA3AF',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    2
                  </div>
                  {/* Progress line */}
                  <div style={{
                    width: '2px',
                    height: '60px',
                    background: '#374151',
                    marginTop: '12px'
                  }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    margin: '0 0 8px 0'
                  }}>
                    Press Save in Shopify
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: '0 0 16px 0',
                    lineHeight: '1.5'
                  }}>
                    Look for the black Save button in the top-right corner of your theme editor.
                  </p>
                  <div style={{
                    background: '#F3F4F6',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'inline-block'
                  }}>
                    <button style={{
                      padding: '8px 16px',
                      background: '#000000',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'default'
                    }}>
                      Save
                    </button>
                    <p style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      margin: '8px 0 0 0',
                      textAlign: 'center'
                    }}>
                      Click the black Save button
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Return here */}
            <div style={{
              marginBottom: '32px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#9CA3AF',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: '600',
                  flexShrink: 0
                }}>
                  3
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    margin: '0 0 8px 0'
                  }}>
                    Return here
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    We'll verify your installation automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* I've saved in Shopify button */}
            <div style={{
              marginBottom: '40px'
            }}>
              <button
                onClick={async () => {
                  const wasSaved = await checkIfBlockSaved();
                  if (wasSaved === false) {
                    alert('Widget not found. Please make sure you clicked the Save button in the Shopify theme editor and try again.');
                  }
                }}
                disabled={isCheckingBlockSaved}
                style={{
                  padding: '12px 32px',
                  background: isCheckingBlockSaved ? '#9CA3AF' : '#3B82F6',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isCheckingBlockSaved ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isCheckingBlockSaved ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #FFFFFF',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Checking...
                  </>
                ) : (
                  <>
                    I've saved in Shopify
                  </>
                )}
              </button>
              {isBlockSaved && (
                <p style={{
                  fontSize: '14px',
                  color: '#3B82F6',
                  margin: '12px 0 0 0',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: '#3B82F6' }}>✅</span> Installation verified! You can proceed to the next step.
                </p>
              )}
            </div>

            {/* Next button - only enabled when saved */}
            {isBlockSaved && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '24px'
              }}>
                <button
                  onClick={() => setCurrentStep(3)}
                  style={{
                    padding: '12px 32px',
                    background: '#3B82F6',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}
                >
                  Next
                </button>
              </div>
            )}
            </div>

            {/* Right side - Conversion Play Display */}
            {selectedIdea && (
              <div style={{
                flex: 1,
                maxWidth: '450px',
                position: 'sticky',
                top: '20px'
              }}>
                <div style={{
                  backgroundColor: figmaColors.gray,
                  border: `1px solid ${figmaColors.primaryBlue}`,
                  borderRadius: '24px',
                  padding: '40px',
                  margin: '0',
                  boxSizing: 'border-box',
                  overflow: 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  alignItems: 'center',
                  minHeight: '650px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '50px', alignItems: 'center', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                      {/* Widget Preview - Image Section */}
                      <div style={{ 
                        width: '350px', 
                        height: '280px', 
                        borderRadius: '10px', 
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}>
                        {selectedIdea.utility === 'Free Shipping Badge' ? (
                          <img 
                            src={freeShippingBadgeImage} 
                            alt="Free Shipping Badge"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                        ) : selectedIdea.utility === 'How Many in Cart' ? (
                          <img 
                            src={addToCartImage} 
                            alt="How Many in Cart"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                        ) : selectedIdea.utility === 'Returns Guarantee Badge' ? (
                          <img 
                            src={moneyBackGuaranteeImage} 
                            alt="Returns Guarantee Badge"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                        ) : null}
                      </div>

                      {/* Title and Description Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                        {/* Title */}
                        <p style={{
                          fontFamily: 'Geist, sans-serif',
                          fontWeight: 600,
                          fontSize: '20px',
                          color: figmaColors.darkGray,
                          margin: 0,
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          width: '100%',
                          boxSizing: 'border-box',
                          textAlign: 'center'
                        }}>
                          {selectedIdea.utility}
                        </p>
                        
                        {/* Tags */}
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          {(Array.isArray(selectedIdea.style) ? selectedIdea.style : [selectedIdea.style]).map((tag, tagIndex) => (
                            <div
                              key={tagIndex}
                              style={{
                                background: '#FFFFFF',
                                color: '#1E40AF',
                                padding: '8px 16px',
                                borderRadius: '16px',
                                fontSize: '14px',
                                fontWeight: '500',
                                width: 'fit-content',
                                border: '1px solid #E5E7EB',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                maxWidth: '100%',
                                boxSizing: 'border-box'
                              }}
                            >
                              {tag}
                            </div>
                          ))}
                        </div>
                        
                        {/* Description */}
                        <p style={{
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          fontSize: '14px',
                          color: figmaColors.darkGray,
                          margin: 0,
                          lineHeight: '20px',
                          width: '100%',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          boxSizing: 'border-box',
                          textAlign: 'center'
                        }}>
                          {selectedIdea.rationale}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Widget Settings Config */}
        {currentStep === 3 && selectedIdea?.blockId === 'simple-text-badge' && (
          <div style={{
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateX(0)',
            opacity: 1
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              Customize your widget
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#6B7280',
              marginBottom: '40px',
              textAlign: 'center'
            }}>
              Make it match your brand perfectly.
            </p>

            {/* Preview Buttons - Above backgrounds */}
            {isBlockSaved && (
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
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
                  Save and Preview in Theme Editor
                </button>
                <button
                  onClick={() => {
                    if (shop && wizardVariantProductHandle && wizardVariantName) {
                      const storefrontUrl = `https://${shop}/products/${wizardVariantProductHandle}?view=${wizardVariantName}`;
                      window.open(storefrontUrl, '_blank');
                    } else {
                      alert('Missing information to generate storefront preview URL.');
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
            )}

            {/* Main Container - Two Columns */}
            <div style={{
              display: 'flex',
              gap: '24px',
              alignItems: 'flex-start'
            }}>
              {/* Left Side - Settings with Tabs */}
              <div style={{
                flex: 1,
                background: '#FFFFFF',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                height: '600px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Tabs */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '24px',
                  background: '#F3F4F6',
                  padding: '4px',
                  borderRadius: '8px'
                }}>
                  {['Text Content', 'Padding', 'Icons & Effects', 'Border'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveSettingsTab(tab)}
                      style={{
                        padding: '12px 20px',
                        background: activeSettingsTab === tab ? '#FFFFFF' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: activeSettingsTab === tab ? '#3B82F6' : '#6B7280',
                        fontSize: '14px',
                        fontWeight: activeSettingsTab === tab ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: activeSettingsTab === tab ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {/* Text Content Tab */}
                  {activeSettingsTab === 'Text Content' && (
                    <>
                      {/* Header Text - Only show if headerText is not empty */}
                      {widgetSettings.headerText && widgetSettings.headerText.trim() !== '' && (
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
                  )}

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

                  {/* Cart Count Range - Only show for How Many in Cart conversion play */}
                  {activeSettingsTab === 'Text Content' && selectedIdea?.utility === 'How Many in Cart' && (
                    <>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151',
                          marginBottom: '8px'
                        }}>
                          Minimum Visitor Count
                        </label>
                        <input
                          type="number"
                          value={widgetSettings.count_min}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value >= 0) {
                              setWidgetSettings(prev => ({ ...prev, count_min: value }));
                            }
                          }}
                          placeholder="40"
                          min="0"
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: '#FFFFFF'
                          }}
                        />
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '4px 0 0 0'
                        }}>
                          The minimum number for the visitor count fluctuation
                        </p>
                      </div>

                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151',
                          marginBottom: '8px'
                        }}>
                          Maximum Visitor Count
                        </label>
                        <input
                          type="number"
                          value={widgetSettings.count_max}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value >= 0) {
                              setWidgetSettings(prev => ({ ...prev, count_max: value }));
                            }
                          }}
                          placeholder="60"
                          min="0"
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: '#FFFFFF'
                          }}
                        />
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '4px 0 0 0'
                        }}>
                          The maximum number for the visitor count fluctuation
                        </p>
                      </div>
                    </>
                  )}

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

                  {/* Header Color */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Header Color
                    </label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={widgetSettings.header_color}
                        onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_color: e.target.value }))}
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
                        value={widgetSettings.header_color}
                        onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_color: e.target.value }))}
                        placeholder="#0f172a"
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

                  {/* Border Color */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Border Color
                    </label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={widgetSettings.border_color}
                        onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_color: e.target.value }))}
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
                        value={widgetSettings.border_color}
                        onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_color: e.target.value }))}
                        placeholder="#d4d4d8"
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

                  {/* Header Font */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Header Font
                    </label>
                    <select
                      value={widgetSettings.header_font}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_font: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="system">System default</option>
                      <option value="poppins">Poppins</option>
                      <option value="inter">Inter</option>
                      <option value="roboto">Roboto</option>
                      <option value="lato">Lato</option>
                      <option value="montserrat">Montserrat</option>
                      <option value="opensans">Open Sans</option>
                      <option value="raleway">Raleway</option>
                      <option value="playfair">Playfair Display</option>
                      <option value="merriweather">Merriweather</option>
                      <option value="sourcesans">Source Sans Pro</option>
                      <option value="nunito">Nunito</option>
                      <option value="worksans">Work Sans</option>
                      <option value="ptsans">PT Sans</option>
                      <option value="oswald">Oswald</option>
                      <option value="notosans">Noto Sans</option>
                      <option value="ubuntu">Ubuntu</option>
                      <option value="georgia">Georgia</option>
                      <option value="times">Times New Roman</option>
                      <option value="arial">Arial</option>
                      <option value="helvetica">Helvetica</option>
                      <option value="courier">Courier New</option>
                      <option value="verdana">Verdana</option>
                      <option value="trebuchet">Trebuchet MS</option>
                    </select>
                  </div>

                  {/* Header Font Size */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Header Font Size (px): {widgetSettings.header_font_size}
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="64"
                      step="1"
                      value={widgetSettings.header_font_size}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_font_size: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </div>

                  {/* Header Underline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={widgetSettings.header_underline}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_underline: e.target.checked }))}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <label style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: 'pointer'
                    }}>
                      Header Underline
                    </label>
                  </div>

                  {/* Body Font */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Body Font
                    </label>
                    <select
                      value={widgetSettings.body_font}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, body_font: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="system">System default</option>
                      <option value="poppins">Poppins</option>
                      <option value="inter">Inter</option>
                      <option value="roboto">Roboto</option>
                      <option value="lato">Lato</option>
                      <option value="montserrat">Montserrat</option>
                      <option value="opensans">Open Sans</option>
                      <option value="raleway">Raleway</option>
                      <option value="playfair">Playfair Display</option>
                      <option value="merriweather">Merriweather</option>
                      <option value="sourcesans">Source Sans Pro</option>
                      <option value="nunito">Nunito</option>
                      <option value="worksans">Work Sans</option>
                      <option value="ptsans">PT Sans</option>
                      <option value="oswald">Oswald</option>
                      <option value="notosans">Noto Sans</option>
                      <option value="ubuntu">Ubuntu</option>
                      <option value="georgia">Georgia</option>
                      <option value="times">Times New Roman</option>
                      <option value="arial">Arial</option>
                      <option value="helvetica">Helvetica</option>
                      <option value="courier">Courier New</option>
                      <option value="verdana">Verdana</option>
                      <option value="trebuchet">Trebuchet MS</option>
                    </select>
                  </div>

                  {/* Body Font Size */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Body Font Size (px): {widgetSettings.body_font_size}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="36"
                      step="1"
                      value={widgetSettings.body_font_size}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, body_font_size: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </div>

                  {/* Body Underline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={widgetSettings.body_underline}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, body_underline: e.target.checked }))}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <label style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: 'pointer'
                    }}>
                      Body Underline
                    </label>
                  </div>

                  {/* Header to Body Spacing */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Header to Body Spacing (px): {widgetSettings.header_body_spacing}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="2"
                      value={widgetSettings.header_body_spacing}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_body_spacing: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </div>

                  {/* Icon to Text Spacing */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Icon to Text Spacing (px): {widgetSettings.icon_text_spacing}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="2"
                      value={widgetSettings.icon_text_spacing}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_text_spacing: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                    </>
                  )}

                  {/* Padding Tab */}
                  {activeSettingsTab === 'Padding' && (
                    <>
                  {/* Inner Padding Horizontal */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Inner Horizontal Padding (px): {widgetSettings.inner_padding_horizontal}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={widgetSettings.inner_padding_horizontal}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_horizontal: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Inner Padding Vertical */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Inner Vertical Padding (px): {widgetSettings.inner_padding_vertical}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={widgetSettings.inner_padding_vertical}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_vertical: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Inner Padding Horizontal Mobile */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Inner Horizontal Padding Mobile (px): {widgetSettings.inner_padding_horizontal_mobile}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="1"
                      value={widgetSettings.inner_padding_horizontal_mobile}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_horizontal_mobile: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Inner Padding Vertical Mobile */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Inner Vertical Padding Mobile (px): {widgetSettings.inner_padding_vertical_mobile}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="1"
                      value={widgetSettings.inner_padding_vertical_mobile}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_vertical_mobile: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Outer Padding Horizontal */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Outer Horizontal Padding (px): {widgetSettings.outer_padding_horizontal}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={widgetSettings.outer_padding_horizontal}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_horizontal: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Outer Padding Vertical */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Outer Vertical Padding (px): {widgetSettings.outer_padding_vertical}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={widgetSettings.outer_padding_vertical}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_vertical: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Outer Padding Horizontal Mobile */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Outer Horizontal Padding Mobile (px): {widgetSettings.outer_padding_horizontal_mobile}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={widgetSettings.outer_padding_horizontal_mobile}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_horizontal_mobile: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Outer Padding Vertical Mobile */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Outer Vertical Padding Mobile (px): {widgetSettings.outer_padding_vertical_mobile}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={widgetSettings.outer_padding_vertical_mobile}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_vertical_mobile: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                    </>
                  )}

                  {/* Icons & Effects Tab */}
                  {activeSettingsTab === 'Icons & Effects' && (
                    <>
                  {/* Icon Choice */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Icon Choice
                    </label>
                    <select
                      value={widgetSettings.icon_choice}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_choice: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="none">None (no icon)</option>
                      <option value="star">⭐ Star</option>
                      <option value="trophy">🏆 Trophy</option>
                      <option value="gift">🎁 Gift</option>
                    </select>
                  </div>

                  {/* Custom Icon URL */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Custom Icon URL (optional)
                    </label>
                    <input
                      type="text"
                      value={widgetSettings.icon_custom}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_custom: e.target.value }))}
                      placeholder="Enter custom icon image URL..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    />
                    <p style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      margin: '4px 0 0 0'
                    }}>
                      If provided, this will override the selected icon above
                    </p>
                  </div>

                  {/* Icon Blink */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={widgetSettings.icon_blink}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_blink: e.target.checked }))}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <label style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: 'pointer'
                    }}>
                      Enable Icon Blink Effect
                    </label>
                  </div>

                  {/* Icon Blink Intensity */}
                  {widgetSettings.icon_blink && (
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Icon Blink Intensity: {widgetSettings.icon_blink_intensity}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={widgetSettings.icon_blink_intensity}
                        onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_blink_intensity: parseInt(e.target.value) }))}
                        style={{
                          width: '100%'
                        }}
                      />
                    </div>
                  )}

                  {/* Icon Size */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Icon Size (px): {widgetSettings.icon_size}
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="120"
                      step="2"
                      value={widgetSettings.icon_size}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_size: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Icon Size Mobile */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Icon Size Mobile (px): {widgetSettings.icon_size_mobile}
                    </label>
                    <input
                      type="range"
                      min="8"
                      max="100"
                      step="2"
                      value={widgetSettings.icon_size_mobile}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_size_mobile: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                    </>
                  )}

                  {/* Border Tab */}
                  {activeSettingsTab === 'Border' && (
                    <>
                  {/* Border Radius */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Border Radius (px): {widgetSettings.border_radius}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="1"
                      value={widgetSettings.border_radius}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_radius: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Border Thickness */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Border Thickness (px): {widgetSettings.border_thickness}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="1"
                      value={widgetSettings.border_thickness}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_thickness: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Hover Effect */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={widgetSettings.hover_effect}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, hover_effect: e.target.checked }))}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <label style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: 'pointer'
                    }}>
                      Enable Hover Lift Effect
                    </label>
                  </div>

                  {/* Drop Shadow */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Drop Shadow Amount: {widgetSettings.drop_shadow}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={widgetSettings.drop_shadow}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, drop_shadow: parseInt(e.target.value) }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Side - Live Preview */}
              <WidgetLivePreview
                widgetSettings={widgetSettings}
                conversionPlayType={
                  selectedIdea?.utility === 'How Many in Cart' 
                    ? 'how-many-in-cart' 
                    : selectedIdea?.utility === 'Free Shipping Badge' || selectedIdea?.utility === 'Returns Guarantee Badge'
                    ? ''
                    : ''
                }
                countMin={widgetSettings.count_min || 40}
                countMax={widgetSettings.count_max || 60}
              />
            </div>

            {/* Navigation buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginTop: '40px'
            }}>
              <button
                onClick={() => setCurrentStep(4)}
                style={{
                  padding: '12px 32px',
                  background: '#3B82F6',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configure Test - OLD STEP, KEEPING FOR REFERENCE BUT NOT USED */}
        {false && currentStep === 999 && (
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

        {/* Step 4: Review & Launch! */}
        {currentStep === 4 && (
          <div style={{
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateX(0)',
            opacity: 1
          }}>
            <h3 style={{
              fontSize: '36px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '32px'
            }}>
              Review & launch
            </h3>

            {/* Main White Card Container */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '40px',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)',
              marginBottom: '32px'
            }}>
              {/* Test Summary Section */}
              <div style={{ marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid #E5E7EB' }}>
                <h4 style={{
                  fontSize: '32px',
                  fontWeight: '600',
                  color: '#3B82F6',
                  marginBottom: '16px'
                }}>
                  Test Summary
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '20px'
                }}>
                  {/* Product Name Card */}
                  <div style={{
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '32px',
                    borderTop: '3px solid #e6e6e6',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '18px',
                      fontWeight: '500',
                      color: '#6B7280',
                      marginBottom: '12px'
                    }}>
                      Product Name
                    </label>
                    <p style={{
                      fontSize: '22px',
                      fontWeight: '600',
                      color: '#1F2937',
                      margin: 0,
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      flex: 1
                    }}>
                      {wizardSelectedProductSnapshot?.title || selectedProduct?.title || 'Not selected'}
                    </p>
                  </div>

                  {/* Widget Name Card */}
                  <div style={{
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '32px',
                    borderTop: '3px solid #e6e6e6',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '18px',
                      fontWeight: '500',
                      color: '#6B7280',
                      marginBottom: '12px'
                    }}>
                      Widget Name
                    </label>
                    <p style={{
                      fontSize: '22px',
                      fontWeight: '600',
                      color: '#1F2937',
                      margin: 0,
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      flex: 1
                    }}>
                      {selectedIdea?.utility || 'Not selected'}
                    </p>
                  </div>

                  {/* Test Name Card */}
                  <div style={{
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '32px',
                    borderTop: '3px solid #ef9362',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '18px',
                      fontWeight: '500',
                      color: '#6B7280',
                      marginBottom: '12px'
                    }}>
                      Test Name
                    </label>
                    {isEditingTestName ? (
                      <input
                        type="text"
                        value={wizardTestName}
                        onChange={(e) => setWizardTestName(e.target.value)}
                        onBlur={() => setIsEditingTestName(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setIsEditingTestName(false);
                          }
                        }}
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '8px 14px',
                          border: '1px solid #3B82F6',
                          borderRadius: '4px',
                          fontSize: '22px',
                          fontWeight: '600',
                          color: '#1F2937',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    ) : (
                      <p
                        onClick={() => setIsEditingTestName(true)}
                        style={{
                          fontSize: '22px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: 0,
                          cursor: 'text',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          flex: 1
                        }}
                      >
                        {wizardTestName || (selectedIdea && (wizardSelectedProductSnapshot || selectedProduct) 
                          ? `${selectedIdea.utility || 'Widget'} on ${wizardSelectedProductSnapshot?.title || selectedProduct?.title || 'Product'}`
                          : 'Test Name')}
                      </p>
                    )}
                  </div>

                  {/* Traffic Split Card */}
                  <div style={{
                    background: manualMode ? '#E0F2FE' : '#F9FAFB',
                    border: manualMode ? '1px solid #3B82F6' : '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '32px',
                    transition: 'all 0.2s ease',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '18px',
                      fontWeight: '500',
                      color: '#6B7280',
                      marginBottom: '12px'
                    }}>
                      Traffic Split
                    </label>
                    {manualMode ? (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={trafficSplitA}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setTrafficSplitA(Math.min(100, Math.max(0, val)));
                            setTrafficSplitB(100 - Math.min(100, Math.max(0, val)));
                          }}
                          style={{
                            width: '80px',
                            padding: '8px 12px',
                            border: '1px solid #3B82F6',
                            borderRadius: '6px',
                            fontSize: '22px',
                            fontWeight: '600',
                            color: '#1F2937',
                            outline: 'none',
                            background: '#FFFFFF'
                          }}
                        />
                        <span style={{ fontSize: '22px', fontWeight: '600', color: '#3B82F6' }}>-</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={trafficSplitB}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setTrafficSplitB(Math.min(100, Math.max(0, val)));
                            setTrafficSplitA(100 - Math.min(100, Math.max(0, val)));
                          }}
                          style={{
                            width: '80px',
                            padding: '8px 12px',
                            border: '1px solid #3B82F6',
                            borderRadius: '6px',
                            fontSize: '22px',
                            fontWeight: '600',
                            color: '#1F2937',
                            outline: 'none',
                            background: '#FFFFFF'
                          }}
                        />
                      </div>
                    ) : (
                      <p style={{
                        fontSize: '22px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0,
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {trafficSplitA} - {trafficSplitB}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Variants Section */}
              <div style={{ marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid #E5E7EB' }}>
                <h4 style={{
                  fontSize: '32px',
                  fontWeight: '600',
                  color: '#3B82F6',
                  marginBottom: '16px'
                }}>
                  Variants
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '20px'
                }}>
                  {/* Control Card */}
                  <div style={{
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '32px',
                    borderLeft: '4px solid #e6e6e6',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <h5 style={{
                      fontSize: '20px',
                      fontWeight: '600',
                      color: '#374151',
                      margin: '0 0 12px 0'
                    }}>
                      Control
                    </h5>
                    <p style={{
                      fontSize: '18px',
                      color: '#6B7280',
                      margin: 0,
                      lineHeight: '1.5',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      flex: 1
                    }}>
                      Product Selected before widget
                    </p>
                  </div>

                  {/* Variant Card */}
                  <div style={{
                    background: '#E0F2FE',
                    border: '1px solid #3B82F6',
                    borderRadius: '12px',
                    padding: '32px',
                    borderLeft: '4px solid #3B82F6',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <h5 style={{
                      fontSize: '20px',
                      fontWeight: '600',
                      color: '#3B82F6',
                      margin: '0 0 12px 0'
                    }}>
                      Variant
                    </h5>
                    <p style={{
                      fontSize: '18px',
                      color: '#1E40AF',
                      margin: 0,
                      lineHeight: '1.5',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      flex: 1
                    }}>
                      Product Selected with widget added
                    </p>
                  </div>
                </div>
              </div>

              {/* AutoPilot Mode and Manual Mode */}
              <div style={{ marginBottom: '0' }}>
                {/* Autopilot Mode Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #E5E7EB'
                }}>
                  <div>
                    <label style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: autopilotOn ? '#3B82F6' : '#1F2937',
                      marginBottom: '4px',
                      display: 'block',
                      transition: 'color 0.2s ease'
                    }}>
                      Autopilot Mode
                    </label>
                    <p style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      margin: 0
                    }}>
                      Automatically declares a winner when the selected confidence threshold is reached
                    </p>
                  </div>
                  <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '48px',
                    height: '24px'
                  }}>
                    <input
                      type="checkbox"
                      checked={autopilotOn}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setAutopilotOn(newValue);
                        // If autopilot is turned on, manual mode must be off
                        if (newValue) {
                          setManualMode(false);
                          // Reset mode selections when switching back to autopilot
                          setFastMode(false);
                          setStandardMode(false);
                          setCarefulMode(false);
                        } else {
                          // If autopilot is turned off, manual mode must be on (mutually exclusive)
                          setManualMode(true);
                        }
                      }}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: autopilotOn ? '#3B82F6' : '#D1D5DB',
                      borderRadius: '24px',
                      transition: '0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px'
                    }}>
                      <span style={{
                        content: '""',
                        position: 'absolute',
                        height: '20px',
                        width: '20px',
                        left: autopilotOn ? '26px' : '2px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>

                {/* Mode Selection - Only shown when Autopilot is ON */}
                {autopilotOn && (
                  <div style={{
                    marginLeft: '24px',
                    marginTop: '16px',
                    paddingLeft: '24px',
                    borderLeft: '3px solid #3B82F6',
                    background: '#F0F9FF',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '24px'
                  }}>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '16px'
                    }}>
                      Select Analysis Mode:
                    </p>
                    
                    {/* Fast Mode */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      padding: '12px',
                      background: fastMode ? '#E0F2FE' : '#FFFFFF',
                      border: fastMode ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <label style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '40px',
                          height: '20px',
                          flexShrink: 0
                        }}>
                          <input
                            type="checkbox"
                            checked={fastMode}
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setFastMode(newValue);
                              if (newValue) {
                                setStandardMode(false);
                                setCarefulMode(false);
                              }
                            }}
                            style={{
                              opacity: 0,
                              width: 0,
                              height: 0
                            }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: fastMode ? '#3B82F6' : '#D1D5DB',
                            borderRadius: '20px',
                            transition: '0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px'
                          }}>
                            <span style={{
                              content: '""',
                              position: 'absolute',
                              height: '16px',
                              width: '16px',
                              left: fastMode ? '22px' : '2px',
                              backgroundColor: '#FFFFFF',
                              borderRadius: '50%',
                              transition: '0.3s',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                          </span>
                        </label>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: fastMode ? '#3B82F6' : '#1F2937'
                            }}>
                              Fast Mode
                            </span>
                            <div 
                              style={{
                                position: 'relative',
                                display: 'inline-block',
                                cursor: 'help'
                              }}
                              onMouseEnter={() => setShowFastTooltip(true)}
                              onMouseLeave={() => setShowFastTooltip(false)}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6B7280' }}>
                                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                                <text x="8" y="11" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">?</text>
                              </svg>
                              {showFastTooltip && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  marginBottom: '8px',
                                  padding: '8px 12px',
                                  background: '#1F2937',
                                  color: '#FFFFFF',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  zIndex: 1000,
                                  width: '200px',
                                  whiteSpace: 'normal',
                                  textAlign: 'left',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}>
                                  <strong>Fast Mode (55% probability)</strong><br/>
                                  Quick decisions with lower confidence. Best for rapid iteration and early insights.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Standard Mode */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      padding: '12px',
                      background: standardMode ? '#E0F2FE' : '#FFFFFF',
                      border: standardMode ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <label style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '40px',
                          height: '20px',
                          flexShrink: 0
                        }}>
                          <input
                            type="checkbox"
                            checked={standardMode}
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setStandardMode(newValue);
                              if (newValue) {
                                setFastMode(false);
                                setCarefulMode(false);
                              }
                            }}
                            style={{
                              opacity: 0,
                              width: 0,
                              height: 0
                            }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: standardMode ? '#3B82F6' : '#D1D5DB',
                            borderRadius: '20px',
                            transition: '0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px'
                          }}>
                            <span style={{
                              content: '""',
                              position: 'absolute',
                              height: '16px',
                              width: '16px',
                              left: standardMode ? '22px' : '2px',
                              backgroundColor: '#FFFFFF',
                              borderRadius: '50%',
                              transition: '0.3s',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                          </span>
                        </label>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: standardMode ? '#3B82F6' : '#1F2937'
                            }}>
                              Standard Mode
                            </span>
                            <div 
                              style={{
                                position: 'relative',
                                display: 'inline-block',
                                cursor: 'help'
                              }}
                              onMouseEnter={() => setShowStandardTooltip(true)}
                              onMouseLeave={() => setShowStandardTooltip(false)}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6B7280' }}>
                                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                                <text x="8" y="11" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">?</text>
                              </svg>
                              {showStandardTooltip && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  marginBottom: '8px',
                                  padding: '8px 12px',
                                  background: '#1F2937',
                                  color: '#FFFFFF',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  zIndex: 1000,
                                  width: '200px',
                                  whiteSpace: 'normal',
                                  textAlign: 'left',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}>
                                  <strong>Standard Mode (70% probability)</strong><br/>
                                  Balanced approach with moderate confidence. Recommended for most tests.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Careful Mode */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0',
                      padding: '12px',
                      background: carefulMode ? '#E0F2FE' : '#FFFFFF',
                      border: carefulMode ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <label style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '40px',
                          height: '20px',
                          flexShrink: 0
                        }}>
                          <input
                            type="checkbox"
                            checked={carefulMode}
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setCarefulMode(newValue);
                              if (newValue) {
                                setFastMode(false);
                                setStandardMode(false);
                              }
                            }}
                            style={{
                              opacity: 0,
                              width: 0,
                              height: 0
                            }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: carefulMode ? '#3B82F6' : '#D1D5DB',
                            borderRadius: '20px',
                            transition: '0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px'
                          }}>
                            <span style={{
                              content: '""',
                              position: 'absolute',
                              height: '16px',
                              width: '16px',
                              left: carefulMode ? '22px' : '2px',
                              backgroundColor: '#FFFFFF',
                              borderRadius: '50%',
                              transition: '0.3s',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                          </span>
                        </label>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: carefulMode ? '#3B82F6' : '#1F2937'
                            }}>
                              Careful Mode
                            </span>
                            <div 
                              style={{
                                position: 'relative',
                                display: 'inline-block',
                                cursor: 'help'
                              }}
                              onMouseEnter={() => setShowCarefulTooltip(true)}
                              onMouseLeave={() => setShowCarefulTooltip(false)}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6B7280' }}>
                                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                                <text x="8" y="11" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">?</text>
                              </svg>
                              {showCarefulTooltip && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  marginBottom: '8px',
                                  padding: '8px 12px',
                                  background: '#1F2937',
                                  color: '#FFFFFF',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  zIndex: 1000,
                                  width: '200px',
                                  whiteSpace: 'normal',
                                  textAlign: 'left',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}>
                                  <strong>Careful Mode (95% probability)</strong><br/>
                                  High statistical significance. Best for critical decisions requiring maximum confidence.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Mode Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: manualMode ? '16px' : '0',
                  paddingBottom: manualMode ? '16px' : '0',
                  borderBottom: manualMode ? '1px solid #E5E7EB' : 'none'
                }}>
                  <div>
                    <label style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: manualMode ? '#3B82F6' : '#1F2937',
                      marginBottom: '4px',
                      display: 'block',
                      transition: 'color 0.2s ease'
                    }}>
                      Manual Mode
                    </label>
                    <p style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      margin: 0
                    }}>
                      Set end conditions manually
                    </p>
                  </div>
                  <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '48px',
                    height: '24px'
                  }}>
                    <input
                      type="checkbox"
                      checked={manualMode}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setManualMode(newValue);
                        // If manual mode is turned on, autopilot must be off
                        if (newValue) {
                          setAutopilotOn(false);
                          // Reset mode selections when switching to manual
                          setFastMode(false);
                          setStandardMode(false);
                          setCarefulMode(false);
                        } else {
                          // If manual mode is turned off, autopilot must be on (mutually exclusive)
                          setAutopilotOn(true);
                        }
                      }}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: manualMode ? '#3B82F6' : '#D1D5DB',
                      borderRadius: '24px',
                      transition: '0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px'
                    }}>
                      <span style={{
                        content: '""',
                        position: 'absolute',
                        height: '20px',
                        width: '20px',
                        left: manualMode ? '26px' : '2px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>

                {/* Manual Mode Explanation */}
                {manualMode && (
                  <div style={{
                    marginTop: '12px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#F0F9FF',
                    border: '1px solid #3B82F6',
                    borderRadius: '6px'
                  }}>
                    <p style={{
                      fontSize: '13px',
                      color: '#1F2937',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      <strong>Note:</strong> In manual mode, the primary measure we're targeting is <strong>add-to-cart</strong>, given that we're using widgets to optimize conversion.
                    </p>
                  </div>
                )}
              </div>

              {/* End Test Section - Only shown when Manual Mode is ON */}
              {manualMode && (
                <div style={{ 
                  marginLeft: '24px',
                  marginTop: '16px',
                  paddingLeft: '24px',
                  borderLeft: '3px solid #3B82F6',
                  background: '#F0F9FF',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '0'
                }}>
                  {/* End Date Input */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #3B82F6',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#3B82F6',
                      marginBottom: '8px'
                    }}>
                      End Date
                    </label>
                    <input
                      type="datetime-local"
                      value={endOnDate}
                      min={(() => {
                        const minDate = new Date();
                        minDate.setDate(minDate.getDate() + 7); // Minimum 1 week from today
                        return minDate.toISOString().slice(0, 16);
                      })()}
                      onChange={(e) => {
                        const selectedDate = new Date(e.target.value);
                        const minDate = new Date();
                        minDate.setDate(minDate.getDate() + 7);
                        
                        if (selectedDate < minDate) {
                          setWizardLaunchError('End date must be at least 1 week from today');
                        } else {
                          setWizardLaunchError(null);
                          setEndOnDate(e.target.value);
                        }
                      }}
                      style={{
                        width: '100%',
                        maxWidth: '300px',
                        padding: '8px 12px',
                        border: '1px solid #3B82F6',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#1F2937',
                        outline: 'none',
                        background: '#F9FAFB'
                      }}
                    />
                    <p style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      margin: '8px 0 0 0'
                    }}>
                      Test will end on this date. Minimum duration is 1 week from today.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Validation Notices */}
            {wizardLaunchError && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #EF4444',
                color: '#B91C1C',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '24px'
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
                marginBottom: '24px'
              }}>
                {wizardLaunchSuccess}
              </div>
            )}

            {/* Launch Test Button - Bottom Right */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '32px'
            }}>
              <button
                onClick={handleLaunchTest}
                disabled={isLaunchingTest || !canLaunchTest}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 28px',
                  background: (isLaunchingTest || !canLaunchTest) ? '#D1D5DB' : '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (isLaunchingTest || !canLaunchTest) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: (isLaunchingTest || !canLaunchTest) ? 0.6 : 1,
                  boxShadow: (isLaunchingTest || !canLaunchTest) ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = '#059669';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = '#10B981';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                </svg>
                {isLaunchingTest ? 'Launching Test...' : 'Launch Test'}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

