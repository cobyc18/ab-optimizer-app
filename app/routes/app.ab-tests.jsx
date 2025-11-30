import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import React, { useState, useEffect } from "react";
import { authenticate } from "../shopify.server.js";

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
      shop: session.shop
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
  
  // Wizard screenshot state
  const [wizardScreenshot, setWizardScreenshot] = useState(null);
  const [wizardScreenshotLoading, setWizardScreenshotLoading] = useState(false);
  const [wizardStorePassword, setWizardStorePassword] = useState('');
  const [storePassword, setStorePassword] = useState('');
  
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
  const [isBlockSaved, setIsBlockSaved] = useState(false);
  const [isCheckingBlockSaved, setIsCheckingBlockSaved] = useState(false);

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
    if (isAnimating) return;
    
    setIsAnimating(true);
    setSwipeDirection(direction);
    
    if (direction === 'like') {
      const selectedWidget = abTestIdeas[currentWidgetIndex];
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
          setCurrentWidgetIndex(0);
        }
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 400);
    }
  };

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
      return;
    }

    const mainTheme = themes.find(t => t.role === 'MAIN');
    if (!mainTheme) {
      alert('Main theme not found.');
      return;
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
      } else {
        console.error('❌ Failed to check block status:', result.error);
        alert(`Failed to check if widget is saved: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error checking block status:', error);
      alert('Error checking if widget is saved. Please try again.');
    } finally {
      setIsCheckingBlockSaved(false);
    }
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
    setWizardLaunchError(null);
    setWizardLaunchSuccess(null);
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

        try {
          const assignResponse = await fetch('/api/assign-product-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId,
              templateSuffix: variantName
            })
          });
          const assignTemplateResult = await assignResponse.json();
          if (assignResponse.ok && assignTemplateResult.success) {
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

      const productHandleForPreview = wizardVariantProductHandle;
      const templateParam = `product.${wizardVariantName}`;

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

      if (widgetHandle && selectedIdea?.blockId === 'simple-text-badge' && widgetSettings && Object.keys(widgetSettings).length > 0) {
        const formatText = (text) => {
          if (!text || text.trim() === '') return '<p></p>';
          if (text.trim().startsWith('<')) return text;
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
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
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
        background: '#FFFFFF',
        padding: '24px 32px',
        borderBottom: '1px solid #E5E5E5',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          maxWidth: '800px',
          margin: '0 auto 16px auto'
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
        flex: 1,
        padding: '32px',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Step 0: Pick an Idea - Goal Selection */}
        {currentStep === 0 && (
          <div style={{
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateX(0)',
            opacity: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '40px 20px',
            minHeight: '500px'
          }}>
            {/* Goal Selection Card - Matching Image Design */}
            <div style={{
              backgroundColor: '#7DD3FC',
              borderRadius: '16px',
              padding: '40px',
              width: '100%',
              maxWidth: '600px',
              marginBottom: '20px'
            }}>
              {/* Title */}
              <p style={{
                fontSize: '12px',
                fontWeight: '500',
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
                    goal: 'Increase Trust', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/%3E%3Cpath d='M9 12l2 2 4-4'/%3E%3C/svg%3E",
                    description: 'Build credibility with new visitors'
                  },
                  { 
                    goal: 'Create Urgency', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3Cpath d='M8 12l4 4'/%3E%3C/svg%3E",
                    description: 'Encourage faster purchase decisions'
                  },
                  { 
                    goal: 'Reduce Friction', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/%3E%3C/svg%3E",
                    description: 'Smooth out the path to purchase'
                  },
                  { 
                    goal: 'Boost Add-to-Cart', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='21' r='1'/%3E%3Ccircle cx='20' cy='21' r='1'/%3E%3Cpath d='M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'/%3E%3C/svg%3E",
                    description: 'Increase cart additions'
                  },
                  { 
                    goal: 'Increase Social Proof', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='9' cy='7' r='4'/%3E%3Cpath d='M23 21v-2a4 4 0 0 0-3-3.87'/%3E%3Cpath d='M16 3.13a4 4 0 0 1 0 7.75'/%3E%3C/svg%3E",
                    description: 'Show others are buying'
                  },
                  { 
                    goal: 'Improve Clarity', 
                    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='16' x2='12' y2='12'/%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'/%3E%3C/svg%3E",
                    description: 'Make product information clearer'
                  }
                ].map(({ goal, icon, description }) => (
                  <button
                    key={goal}
                    onClick={() => {
                      if (goal === 'Increase Trust') {
                        setSelectedGoal(goal);
                        setCurrentStep(1);
                      }
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '32px 36px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#1F2937',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      width: '100%',
                      minHeight: '90px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img src={icon} alt="" style={{ width: '28px', height: '28px' }} />
                    </div>
                    
                    {/* Text Content */}
                    <div style={{ flex: 1 }}>
                      <p style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '6px'
                      }}>
                        {goal}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: '400',
                        color: '#6B7280',
                        lineHeight: '1.4'
                      }}>
                        {description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Choose Widget */}
        {currentStep === 1 && (
          <div style={{
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateX(0)',
            opacity: 1,
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

            <div style={{
              position: 'relative',
              width: '400px',
              height: '450px',
              margin: '0 auto',
              overflow: 'hidden'
            }}>
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
                    transition: 'all 0.3s ease',
                    ...(isAnimating && swipeDirection === 'like' && {
                      animation: 'swipeRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                    }),
                    ...(isAnimating && swipeDirection === 'dislike' && {
                      animation: 'swipeLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                    })
                  }}
                >
                  <div style={{
                    fontSize: '48px',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}>
                    {abTestIdeas[currentWidgetIndex].utility === 'Live Visitor Count' && '👁️'}
                    {abTestIdeas[currentWidgetIndex].utility === 'Simple Text Badge' && '🎁'}
                  </div>

                  <h4 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#1F2937',
                    margin: '0 0 12px 0',
                    textAlign: 'center'
                  }}>
                    {abTestIdeas[currentWidgetIndex].utility}
                  </h4>

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

                  <p style={{
                    fontSize: '16px',
                    color: '#374151',
                    margin: '0 0 20px 0',
                    lineHeight: '1.5',
                    textAlign: 'center'
                  }}>
                    {abTestIdeas[currentWidgetIndex].rationale}
                  </p>

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
                  <div style={{
                    fontSize: '48px',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}>
                    {abTestIdeas[currentWidgetIndex + 1].utility === 'Live Visitor Count' && '👁️'}
                    {abTestIdeas[currentWidgetIndex + 1].utility === 'Simple Text Badge' && '🎁'}
                  </div>

                  <h4 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#1F2937',
                    margin: '0 0 12px 0',
                    textAlign: 'center'
                  }}>
                    {abTestIdeas[currentWidgetIndex + 1].utility}
                  </h4>

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

                  <p style={{
                    fontSize: '16px',
                    color: '#374151',
                    margin: '0 0 20px 0',
                    lineHeight: '1.5',
                    textAlign: 'center'
                  }}>
                    {abTestIdeas[currentWidgetIndex + 1].rationale}
                  </p>

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
              Select a product and enter your store password
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              minHeight: '500px'
            }}>
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

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
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
                    Enter your store password
                  </p>
                  <input
                    type="password"
                    value={wizardStorePassword}
                    onChange={(e) => setWizardStorePassword(e.target.value)}
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

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              background: '#F3F4F6',
              borderRadius: '12px',
              border: '1px solid #D1D5DB',
              marginBottom: '24px'
            }}>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                margin: '0 0 16px 0',
                textAlign: 'center',
                fontWeight: '500'
              }}>
                After saving in the theme editor, click below to verify the widget was saved:
              </p>
              <button
                onClick={checkIfBlockSaved}
                disabled={isCheckingBlockSaved}
                style={{
                  padding: '12px 24px',
                  background: isCheckingBlockSaved ? '#9CA3AF' : '#10B981',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  border: `1px solid ${isCheckingBlockSaved ? '#9CA3AF' : '#10B981'}`,
                  cursor: isCheckingBlockSaved ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
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
                    {isBlockSaved ? '✅ Widget Saved' : 'Check if Saved'}
                  </>
                )}
              </button>
              {isBlockSaved && (
                <p style={{
                  fontSize: '14px',
                  color: '#059669',
                  margin: '12px 0 0 0',
                  textAlign: 'center',
                  fontWeight: '500'
                }}>
                  ✅ Widget successfully saved! You can now configure the settings below.
                </p>
              )}
            </div>

            {selectedIdea?.blockId === 'simple-text-badge' && !isBlockSaved && (
              <div style={{
                padding: '20px',
                background: '#FEF3C7',
                borderRadius: '8px',
                border: '1px solid #F59E0B',
                textAlign: 'center',
                marginBottom: '24px'
              }}>
                <p style={{
                  fontSize: '14px',
                  color: '#92400E',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  ⚠️ Please save the widget in the theme editor first, then click "Check if Saved" to enable widget configuration.
                </p>
              </div>
            )}
            
            {selectedIdea?.blockId === 'simple-text-badge' && isBlockSaved && (
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
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                </div>
              </div>
            )}

            {isBlockSaved && (
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
                  <span style={{ fontSize: '12px', color: '#15803D', textAlign: 'center' }}>
                    Preview in theme editor or live storefront with updated widget settings
                  </span>
                </div>
              </div>
            )}
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

      {/* Footer */}
      <div style={{
        background: '#FFFFFF',
        padding: '24px 32px',
        borderTop: '1px solid #E5E5E5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={() => navigate('/app')}
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
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            style={{
              background: currentStep === 0 ? '#F3F4F6' : '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: currentStep === 0 ? '#9CA3AF' : '#374151'
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
  );
}

