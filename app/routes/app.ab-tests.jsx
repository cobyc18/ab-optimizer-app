import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import React, { useState, useEffect, useCallback } from "react";
import { authenticate, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server.js";
import { checkBillingStatus } from "../utils/billing.server.js";
import WidgetLivePreview from "../components/WidgetLivePreview.jsx";
import ConversionPlayCard from "../components/ConversionPlayCard.jsx";
import Step0 from "./app.ab-tests-step0.jsx";
import Step1 from "./app.ab-tests-step1.jsx";
import Step2 from "./app.ab-tests-step2.jsx";
import Step3 from "./app.ab-tests-step3.jsx";
import Step4 from "./app.ab-tests-step4.jsx";
import { abTestIdeas } from "../data/abTestIdeas.js";
import { getFilteredConversionPlays, getGoalForWidget } from "./app.ab-tests.shared.jsx";

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
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Tinder swiper functions (for steps 1+, not step 0)
  const handleSwipe = (direction) => {
    // This function is only used for steps 1+, step 0 has its own handleSwipe
    if (currentStep === 0) return;
    
    if (isAnimating) return;
    
    setIsAnimating(true);
    setSwipeDirection(direction);
    
    if (direction === 'like') {
      const filteredWidgets = getFilteredConversionPlays(selectedGoal);
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


  // Store widget ID from URL params to apply after goal is set
  const pendingWidgetIdRef = React.useRef(null);
  const pendingStepRef = React.useRef(null);

  // Handle URL params for direct navigation from dashboard
  useEffect(() => {
    const widgetIdParam = searchParams.get('widgetId');
    const stepParam = searchParams.get('step');
    
    if (widgetIdParam) {
      // Convert to number (URL params are strings, but widget IDs are numbers)
      const widgetId = parseInt(widgetIdParam, 10);
      const widget = abTestIdeas.find(idea => idea.id === widgetId);
      
      if (widget) {
        // Store the widget ID and step to apply after goal is set
        const stepNum = stepParam ? parseInt(stepParam, 10) : 1;
        pendingWidgetIdRef.current = widgetId;
        pendingStepRef.current = stepNum;
        
        // First, determine and set the correct goal for this widget
        const appropriateGoal = getGoalForWidget(widget);
        setSelectedGoal(appropriateGoal);
        
        // Clear URL params after processing
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  // Apply widget selection and navigate after goal is set and filtered list is ready
  useEffect(() => {
    if (pendingWidgetIdRef.current && selectedGoal) {
      const widgetId = pendingWidgetIdRef.current;
      const stepNum = pendingStepRef.current;
      
      // Wait a tick to ensure filtered list is updated
      setTimeout(() => {
        const widget = abTestIdeas.find(idea => idea.id === widgetId);
        
        if (widget) {
          // Verify widget is in filtered list for the selected goal
          const filteredWidgets = getFilteredConversionPlays(selectedGoal);
          const widgetInFiltered = filteredWidgets.find(w => w.id === widgetId);
          
          if (widgetInFiltered) {
            // Apply the widget selection first (this sets selectedIdea, etc.)
            applyWidgetIdeaSelection(widget);
            
            // Then set the index in the filtered list (this is what the swiper uses)
            const filteredIndex = filteredWidgets.findIndex(w => w.id === widgetId);
            setCurrentWidgetIndex(filteredIndex);
            
            // Navigate to specified step (step=1 means currentStep=1, which is step 2 = product selection)
            if (stepNum >= 0 && stepNum <= 4) {
              setCurrentStep(stepNum);
            }
          }
        }
        
        // Clear the pending refs
        pendingWidgetIdRef.current = null;
        pendingStepRef.current = null;
      }, 150); // Small delay to ensure state updates are processed
    }
  }, [selectedGoal]); // Run when goal changes

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

        // Set metafield to false to ensure widget is hidden on live storefront until test is launched
        // This prevents the widget from showing for new tests before they're launched
        try {
          const metafieldResponse = await fetch('/api/set-test-metafield', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: productId,
              value: false
            })
          });
          
          const metafieldResult = await metafieldResponse.json();
          if (metafieldResult.success) {
            console.log('✅ Set product metafield to false: widget will be hidden until test is launched');
          } else {
            console.warn('⚠️ Failed to set metafield to false:', metafieldResult.error);
            // Don't fail template creation if metafield setting fails
          }
        } catch (metafieldError) {
          console.warn('⚠️ Error setting metafield to false:', metafieldError);
          // Don't fail template creation if metafield setting fails
        }

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

      // Temporarily assign the product to the variant template so Shopify's theme editor uses the correct product
      // The product will be reverted back to the control template when the test is launched
      const productIdForAssignment = wizardVariantProductId || wizardSelectedProductSnapshot?.id || selectedProduct?.id;
      
      if (productIdForAssignment) {
        try {
          const assignResponse = await fetch('/api/assign-product-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: productIdForAssignment,
              templateSuffix: wizardVariantName
            })
          });
          
          if (assignResponse.ok) {
            console.log('✅ Temporarily assigned product to variant template for theme editor');
                } else {
            console.error('⚠️ Failed to assign product template:', await assignResponse.json());
          }
        } catch (assignError) {
          console.error('⚠️ Failed to temporarily assign product template:', assignError);
          // Continue anyway - the URL parameters might still work
        }
      }

      // Use the product handle that was set when the template was duplicated
      const productHandleForPreview = wizardVariantProductHandle;
      
      console.log('🔍 Opening theme editor with:', {
        productHandle: productHandleForPreview,
        productId: productIdForAssignment,
        variantName: wizardVariantName,
        templateParam: `product.${wizardVariantName}`
      });
      // For OS 2.0 JSON templates, the template param should be: product.<suffix>
      // This tells Shopify which template file to load in the editor
      const templateParam = `product.${wizardVariantName}`;

      // The previewPath must include ?view=<suffix> to ensure Shopify uses the correct template
      // This is critical - without it, Shopify will use the product's default template assignment
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

      window.open(editorUrl, '_blank');

      // Note: We temporarily assign the product to the variant template so Shopify's theme editor
      // uses the correct product. The product will be reverted back to the control template
      // when the test is launched (in the launch API). This ensures the theme editor works correctly
      // and the product is only permanently assigned if the variant wins the A/B test.

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
        // Navigate to dashboard
        window.location.href = '/app';
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

  // Auto-populate widget settings defaults when entering step 3 if settings are empty
  useEffect(() => {
    if (currentStep === 3 && selectedIdea?.blockId === 'simple-text-badge') {
      // Check if widgetSettings are still at their initial empty state
      const isEmpty = !widgetSettings.bodyText || widgetSettings.bodyText.trim() === '';
      
      if (isEmpty) {
        // Auto-populate settings for How Many in Cart
        if (selectedIdea.id === 1 && selectedIdea.utility === 'How Many in Cart') {
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
        if (selectedIdea.id === 2 && selectedIdea.utility === 'Free Shipping Badge') {
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
        if (selectedIdea.id === 3 && selectedIdea.utility === 'Returns Guarantee Badge') {
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
      }
    }
  }, [currentStep, selectedIdea]);


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
          <Step0
            selectedGoal={selectedGoal}
            setSelectedGoal={setSelectedGoal}
            currentWidgetIndex={currentWidgetIndex}
            setCurrentWidgetIndex={setCurrentWidgetIndex}
            selectedConversionPlayIndex={selectedConversionPlayIndex}
            setSelectedConversionPlayIndex={setSelectedConversionPlayIndex}
            isAnimating={isAnimating}
            swipeDirection={swipeDirection}
            setIsAnimating={setIsAnimating}
            setSwipeDirection={setSwipeDirection}
            onSwipeLike={() => {
              setCurrentStep(1);
            }}
            applyWidgetIdeaSelection={applyWidgetIdeaSelection}
          />
        )}

        {/* Step 1: Choose Product & Preview */}
        {currentStep === 1 && (
          <Step1
            products={products}
            selectedProduct={selectedProduct}
            productSearchQuery={productSearchQuery}
            setProductSearchQuery={setProductSearchQuery}
            currentProductPage={currentProductPage}
            setCurrentProductPage={setCurrentProductPage}
            handleProductSelection={handleProductSelection}
            createVariantTemplate={createVariantTemplate}
            setCurrentStep={setCurrentStep}
            isVariantRequestInFlight={isVariantRequestInFlight}
            isCheckingProductInTest={isCheckingProductInTest}
            setIsCheckingProductInTest={setIsCheckingProductInTest}
            productInTestError={productInTestError}
            setProductInTestError={setProductInTestError}
          />
        )}

        {/* Step 2: Install your widget */}
        {currentStep === 2 && (
          <Step2
            wizardVariantName={wizardVariantName}
            selectedIdea={selectedIdea}
            canOpenThemeEditor={canOpenThemeEditor}
            isVariantRequestInFlight={isVariantRequestInFlight}
            isVariantTemplateReady={isVariantTemplateReady}
            openVariantInThemeEditor={openVariantInThemeEditor}
            checkIfBlockSaved={checkIfBlockSaved}
            isCheckingBlockSaved={isCheckingBlockSaved}
            isBlockSaved={isBlockSaved}
            setCurrentStep={setCurrentStep}
          />
        )}

        {/* Step 3: Widget Settings Config */}
        {currentStep === 3 && selectedIdea?.blockId === 'simple-text-badge' && (
          <Step3
            selectedIdea={selectedIdea}
            widgetSettings={widgetSettings}
            setWidgetSettings={setWidgetSettings}
            activeSettingsTab={activeSettingsTab}
            setActiveSettingsTab={setActiveSettingsTab}
            isBlockSaved={isBlockSaved}
            canOpenThemeEditor={canOpenThemeEditor}
            shop={shop}
            wizardVariantProductHandle={wizardVariantProductHandle}
            wizardVariantName={wizardVariantName}
            openVariantInThemeEditor={openVariantInThemeEditor}
            setCurrentStep={setCurrentStep}
          />
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
          <Step4
            selectedIdea={selectedIdea}
            wizardSelectedProductSnapshot={wizardSelectedProductSnapshot}
            selectedProduct={selectedProduct}
            wizardTestName={wizardTestName}
            setWizardTestName={setWizardTestName}
            isEditingTestName={isEditingTestName}
            setIsEditingTestName={setIsEditingTestName}
            testHypothesis={testHypothesis}
            setTestHypothesis={setTestHypothesis}
            isEditingHypothesis={isEditingHypothesis}
            setIsEditingHypothesis={setIsEditingHypothesis}
            trafficSplitA={trafficSplitA}
            setTrafficSplitA={setTrafficSplitA}
            trafficSplitB={trafficSplitB}
            setTrafficSplitB={setTrafficSplitB}
            manualMode={manualMode}
            setManualMode={setManualMode}
            autopilotOn={autopilotOn}
            setAutopilotOn={setAutopilotOn}
            fastMode={fastMode}
            setFastMode={setFastMode}
            standardMode={standardMode}
            setStandardMode={setStandardMode}
            carefulMode={carefulMode}
            setCarefulMode={setCarefulMode}
            showFastTooltip={showFastTooltip}
            setShowFastTooltip={setShowFastTooltip}
            showStandardTooltip={showStandardTooltip}
            setShowStandardTooltip={setShowStandardTooltip}
            showCarefulTooltip={showCarefulTooltip}
            setShowCarefulTooltip={setShowCarefulTooltip}
            endOnDate={endOnDate}
            setEndOnDate={setEndOnDate}
            wizardLaunchError={wizardLaunchError}
            setWizardLaunchError={setWizardLaunchError}
            wizardLaunchSuccess={wizardLaunchSuccess}
            isLaunchingTest={isLaunchingTest}
            canLaunchTest={canLaunchTest}
            handleLaunchTest={handleLaunchTest}
          />
        )}
      </div>

    </div>
  );
}

