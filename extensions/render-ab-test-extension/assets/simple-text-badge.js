// Simple Text Badge Widget JavaScript
(function() {
  'use strict';

  var CONFIG_PARAM = 'ab_widget_config';
  var WIDGET_TYPE = 'simple-text-badge';
  var FONT_MAP = {
    system: 'inherit',
    poppins: "'Poppins', sans-serif",
    inter: "'Inter', sans-serif",
    roboto: "'Roboto', sans-serif",
    lato: "'Lato', sans-serif",
    montserrat: "'Montserrat', sans-serif",
    opensans: "'Open Sans', sans-serif",
    raleway: "'Raleway', sans-serif",
    playfair: "'Playfair Display', serif",
    merriweather: "'Merriweather', serif",
    sourcesans: "'Source Sans Pro', sans-serif",
    nunito: "'Nunito', sans-serif",
    worksans: "'Work Sans', sans-serif",
    ptsans: "'PT Sans', sans-serif",
    oswald: "'Oswald', sans-serif",
    notosans: "'Noto Sans', sans-serif",
    ubuntu: "'Ubuntu', sans-serif",
    georgia: "'Georgia', serif",
    times: "'Times New Roman', serif",
    arial: "'Arial', sans-serif",
    helvetica: "'Helvetica', sans-serif",
    courier: "'Courier New', monospace",
    verdana: "'Verdana', sans-serif",
    trebuchet: "'Trebuchet MS', sans-serif",
    serif: "'Georgia', serif"
  };
  var ICON_LIBRARY = {
    star: '⭐',
    trophy: '🏆',
    gift: '🎁'
  };

  function init() {
    refreshBadges();
    registerConfigListener();
    registerThemeEditorListeners();
  }

  function refreshBadges() {
    document.querySelectorAll('.simple-text-badge-widget').forEach(function(container) {
      // Debug: Log the container's HTML to see what data attributes are present
      console.log('🔍 Container HTML:', container.outerHTML.substring(0, 500));
      
      // Check if widget should be enabled (visible) on live storefront
      checkWidgetEnabled(container).then(function(enabled) {
        if (!enabled) {
          // Widget not enabled - hide it on live storefront
          container.style.display = 'none';
          console.log('🚫 Widget hidden - test not launched yet');
          return; // Don't render the badge
        }
        
        // Widget is enabled or in theme editor - show and render it
        container.style.display = '';
        
        // Reset initialization flag before re-rendering
        container.dataset.liveVisitorInitialized = 'false';
        
        renderBadge(container);
        
        // Check if this is a live visitor count or how many in cart widget
        const conversionPlayType = container.dataset.conversionPlayType;
        if (conversionPlayType === 'live-visitor-count' || conversionPlayType === 'how-many-in-cart') {
          initLiveVisitorCount(container);
        }
      }).catch(function(error) {
        console.error('⚠️ Error checking widget enabled status:', error);
        // On error, default to showing widget (fail-safe)
        container.style.display = '';
        container.dataset.liveVisitorInitialized = 'false';
        renderBadge(container);
      });
    });
  }

  /**
   * Check if widget should be enabled (visible) on the live storefront.
   * Widgets are only enabled if there's a running A/B test for the product.
   * Always enabled in theme editor.
   * 
   * @param {HTMLElement} container - The widget container element
   * @returns {Promise<boolean>} - True if widget should be enabled, false otherwise
   */
  function checkWidgetEnabled(container) {
    return new Promise(function(resolve, reject) {
      // Check if we're in theme editor
      const isInThemeEditor = typeof Shopify !== 'undefined' && Shopify.designMode;
      const designModeFromLiquid = container.dataset.designMode === 'true';
      
      if (isInThemeEditor || designModeFromLiquid) {
        // Always show widget in theme editor
        console.log('✅ Widget enabled - in theme editor');
        resolve(true);
        return;
      }
      
      // On live storefront, check if test is running
      const productId = container.dataset.productId;
      const shop = container.dataset.shop;
      
      if (!productId || !shop) {
        console.warn('⚠️ Missing productId or shop - defaulting to disabled');
        resolve(false);
        return;
      }
      
      // Use app proxy to call API from storefront
      // App proxy pattern: https://{shop}/apps/ab-optimizer-app/{path}
      const shopDomain = shop.includes('.myshopify.com') ? shop : shop + '.myshopify.com';
      const apiUrl = 'https://' + shopDomain + '/apps/ab-optimizer-app/api/check-widget-enabled?productId=' + encodeURIComponent(productId) + '&shop=' + encodeURIComponent(shop);
      
      fetch(apiUrl)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('API request failed: ' + response.status);
          }
          return response.json();
        })
        .then(function(data) {
          const enabled = data.enabled === true;
          console.log('🔍 Widget enabled check:', {
            enabled: enabled,
            productId: productId,
            shop: shop,
            testName: data.testName
          });
          resolve(enabled);
        })
        .catch(function(error) {
          console.error('❌ Error checking widget enabled status:', error);
          // On error, default to disabled (fail-safe - don't show unconfigured widgets)
          resolve(false);
        });
    });
  }
  
  function initLiveVisitorCount(container) {
    // Prevent multiple initializations
    if (container.dataset.liveVisitorInitialized === 'true') return;
    container.dataset.liveVisitorInitialized = 'true';
    
    const badge = container.querySelector('.simple-text-badge');
    if (!badge) return;
    
    // Find the count element - it should be in the body text
    const bodyElement = badge.querySelector('.badge-body');
    if (!bodyElement) return;
    
    const minCount = parseInt(container.dataset.countMin) || 40;
    const maxCount = parseInt(container.dataset.countMax) || 60;
    
    const validMin = Math.min(minCount, maxCount);
    const validMax = Math.max(minCount, maxCount);
    
    // Extract the current count from the body text (look for numbers)
    const bodyText = bodyElement.textContent || bodyElement.innerText || '';
    const countMatch = bodyText.match(/\d+/);
    
    // If no number found or it's 0, start from middle of range
    let currentCount;
    if (!countMatch || parseInt(countMatch[0]) === 0) {
      currentCount = Math.floor((validMin + validMax) / 2);
      // Update the display immediately if starting from 0
      if (countMatch && parseInt(countMatch[0]) === 0) {
        const countRegex = new RegExp('\\b0\\b', 'g');
        bodyElement.innerHTML = bodyElement.innerHTML.replace(countRegex, String(currentCount));
      }
    } else {
      currentCount = Math.max(validMin, Math.min(validMax, parseInt(countMatch[0]) || validMin));
    }
    
    function updateVisitorCount() {
      const change = Math.floor(Math.random() * 5) - 2;
      let newCount = currentCount + change;
      newCount = Math.max(validMin, Math.min(validMax, newCount));
      
      if (newCount !== currentCount) {
        bodyElement.classList.add('updating');
        currentCount = newCount;
        
        // Find and replace any number in the body text
        const currentText = bodyElement.textContent || bodyElement.innerText || '';
        const numberMatch = currentText.match(/\d+/);
        if (numberMatch) {
          const numberRegex = new RegExp('\\b' + numberMatch[0] + '\\b', 'g');
          setTimeout(function() {
            bodyElement.innerHTML = bodyElement.innerHTML.replace(numberRegex, String(currentCount));
            bodyElement.classList.remove('updating');
          }, 150);
        }
      }
    }
    
    function scheduleNextUpdate() {
      const delay = Math.random() * 7000 + 8000;
      setTimeout(function() {
        updateVisitorCount();
        scheduleNextUpdate();
      }, delay);
    }
    
    scheduleNextUpdate();
  }

  function registerConfigListener() {
    if (window.__simpleTextBadgeConfigListenerAdded) return;
    window.addEventListener('abTestWidgetConfigUpdate', refreshBadges);
    window.__simpleTextBadgeConfigListenerAdded = true;
  }

  function registerThemeEditorListeners() {
    // Prevent duplicate listeners
    if (window.__simpleTextBadgeThemeEditorListenersAdded) return;
    
    // Listen for section load events (fires when section is added/re-rendered)
    // This is the standard Shopify way to handle theme editor updates
    document.addEventListener('shopify:section:load', function(event) {
      // Use requestAnimationFrame to ensure DOM has updated with new data attributes
      // This is critical when settings are updated via API - the event fires before DOM updates
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          // Double RAF ensures we're after the browser's layout/paint cycle
          // This fixes alignment issues when settings are updated via API
          refreshBadges();
        });
      });
    });

    // Also listen for block select (when merchant selects the block in editor)
    document.addEventListener('shopify:block:select', function(event) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          // Refresh badges when block is selected to ensure latest settings are displayed
          refreshBadges();
        });
      });
    });

    // Listen for block deselect to ensure settings are synced
    document.addEventListener('shopify:block:deselect', function(event) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshBadges();
        });
      });
    });

    window.__simpleTextBadgeThemeEditorListenersAdded = true;
  }

  function renderBadge(container) {
    var overrides = getWidgetOverride();
    var settings = getSettings(container, overrides);
    applyCssVariables(container, settings);

    var iconMarkup = buildIconMarkup(settings);
    var headingMarkup = buildHeadingMarkup(settings);
    var bodyMarkup = buildBodyMarkup(settings);

    var classes = ['simple-text-badge', iconMarkup ? 'has-icon' : 'no-icon'];
    if (settings.hoverEffect) {
      classes.push('hover-enabled');
    }

    container.innerHTML = `
      <div class="${classes.join(' ')}">
        ${iconMarkup || ''}
        <div class="badge-content">
          ${headingMarkup}
          ${bodyMarkup}
        </div>
      </div>
    `;
  }

  function buildIconMarkup(settings) {
    const blinkClass = settings.iconBlink ? ' blinking' : '';
    
    // If a custom icon is uploaded, use it regardless of iconChoice
    if (settings.iconUrl) {
      return `
        <div class="badge-icon-container${blinkClass}">
          <img src="${settings.iconUrl}" alt="${escapeAttribute(settings.iconAlt || 'Badge icon')}" class="badge-icon-img" loading="lazy">
        </div>
      `;
    }

    // If 'none' is selected, don't show any icon
    if (settings.iconChoice === 'none') {
      return '';
    }

    // Otherwise, use the selected emoji icon
    const iconSymbol = ICON_LIBRARY[settings.iconChoice];
    if (!iconSymbol) {
      return '';
    }

    return `
      <div class="badge-icon-container${blinkClass}">
        <span class="badge-icon-swatch" aria-hidden="true">${iconSymbol}</span>
      </div>
    `;
  }

  function buildHeadingMarkup(settings) {
    if (!settings.headerText) return '';
    var content = settings.headerText;
    return `<div class="badge-heading">${content}</div>`;
  }

  function buildBodyMarkup(settings) {
    if (!settings.bodyText) return '';
    var content = settings.bodyText;
    return `<div class="badge-body">${content}</div>`;
  }

  function applyCssVariables(container, settings) {
    container.style.setProperty('--badge-background-color', settings.backgroundColor);
    container.style.setProperty('--badge-border-color', settings.borderColor);
    container.style.setProperty('--badge-text-color', settings.textColor);
    container.style.setProperty('--badge-border-radius', settings.borderRadius + 'px');
    container.style.setProperty('--badge-border-thickness', settings.borderThickness + 'px');

    container.style.setProperty('--badge-inner-padding-x', settings.innerPaddingX + 'px');
    container.style.setProperty('--badge-inner-padding-y', settings.innerPaddingY + 'px');
    container.style.setProperty('--badge-inner-padding-x-mobile', settings.innerPaddingXMobile + 'px');
    container.style.setProperty('--badge-inner-padding-y-mobile', settings.innerPaddingYMobile + 'px');

    container.style.setProperty('--badge-outer-padding-x', settings.outerPaddingX + 'px');
    container.style.setProperty('--badge-outer-padding-y', settings.outerPaddingY + 'px');
    container.style.setProperty('--badge-outer-padding-x-mobile', settings.outerPaddingXMobile + 'px');
    container.style.setProperty('--badge-outer-padding-y-mobile', settings.outerPaddingYMobile + 'px');

    container.style.setProperty('--badge-icon-size', settings.iconSize + 'px');
    container.style.setProperty('--badge-icon-size-mobile', settings.iconSizeMobile + 'px');
    
    // Spacing
    container.style.setProperty('--badge-header-body-spacing', settings.headerBodySpacing + 'px');
    container.style.setProperty('--badge-icon-text-spacing', settings.iconTextSpacing + 'px');
    
    // Blink intensity (0-100 scale)
    // Calculate minimum opacity and scale based on intensity
    var intensity = settings.iconBlinkIntensity / 100; // 0 to 1
    var blinkOpacity = 1 - (intensity * 0.7); // 1.0 to 0.3
    var blinkScale = 1 - (intensity * 0.15); // 1.0 to 0.85
    container.style.setProperty('--badge-blink-opacity', blinkOpacity);
    container.style.setProperty('--badge-blink-scale', blinkScale);
    
    // Header typography
    container.style.setProperty('--badge-header-color', settings.headerColor);
    container.style.setProperty('--badge-header-font-size', settings.headerFontSize + 'px');
    container.style.setProperty('--badge-header-font-family', FONT_MAP[settings.headerFont] || 'inherit');
    container.style.setProperty('--badge-header-text-decoration', settings.headerUnderline ? 'underline' : 'none');
    
    // Body typography
    container.style.setProperty('--badge-body-font-size', settings.bodyFontSize + 'px');
    container.style.setProperty('--badge-body-font-family', FONT_MAP[settings.bodyFont] || 'inherit');
    container.style.setProperty('--badge-body-text-decoration', settings.bodyUnderline ? 'underline' : 'none');

    var dropShadow = settings.dropShadow > 0
      ? `0 ${Math.max(4, settings.dropShadow / 3)}px ${Math.max(10, settings.dropShadow)}px rgba(15,23,42,0.16)`
      : 'none';
    var dropShadowHover = settings.dropShadow > 0
      ? `0 ${Math.max(6, settings.dropShadow / 2)}px ${Math.max(12, settings.dropShadow * 1.2)}px rgba(15,23,42,0.2)`
      : dropShadow;

    container.style.setProperty('--badge-drop-shadow', dropShadow);
    container.style.setProperty('--badge-drop-shadow-hover', dropShadowHover);
  }

  function getSettings(container, overrides) {
    var dataset = container.dataset;
    
    // Debug: Log all data attributes
    console.log('🔍 Reading data attributes from container:', {
      hasContainer: !!container,
      allDataAttributes: Object.keys(dataset),
      headerTextRaw: container.getAttribute('data-header-text'),
      bodyTextRaw: container.getAttribute('data-body-text'),
      textColorRaw: container.getAttribute('data-text-color'),
      headerTextDataset: dataset.headerText,
      bodyTextDataset: dataset.bodyText,
      textColorDataset: dataset.textColor
    });
    
    var base = {
      headerText: formatRichText(dataset.headerText || container.getAttribute('data-header-text') || ''),
      headerFont: dataset.headerFont || 'system',
      headerFontSize: parseNumber(dataset.headerFontSize, 24),
      headerUnderline: parseBoolean(dataset.headerUnderline, false),
      headerColor: dataset.headerColor || '#0f172a',
      bodyText: formatRichText(dataset.bodyText || container.getAttribute('data-body-text') || ''),
      bodyFont: dataset.bodyFont || 'system',
      bodyFontSize: parseNumber(dataset.bodyFontSize, 16),
      bodyUnderline: parseBoolean(dataset.bodyUnderline, false),
      textColor: dataset.textColor || container.getAttribute('data-text-color') || '#1a5f5f',
      backgroundColor: dataset.backgroundColor || '#f5f5f0',
      borderColor: dataset.borderColor || '#d4d4d8',
      headerBodySpacing: parseNumber(dataset.headerBodySpacing, 6),
      iconTextSpacing: parseNumber(dataset.iconTextSpacing, 20),
      innerPaddingX: parseNumber(dataset.innerPaddingX, 24),
      innerPaddingY: parseNumber(dataset.innerPaddingY, 16),
      innerPaddingXMobile: parseNumber(dataset.innerPaddingXMobile, 16),
      innerPaddingYMobile: parseNumber(dataset.innerPaddingYMobile, 12),
      outerPaddingX: parseNumber(dataset.outerPaddingX, 0),
      outerPaddingY: parseNumber(dataset.outerPaddingY, 0),
      outerPaddingXMobile: parseNumber(dataset.outerPaddingXMobile, 0),
      outerPaddingYMobile: parseNumber(dataset.outerPaddingYMobile, 0),
      iconChoice: dataset.iconChoice || 'star',
      iconUrl: dataset.iconUrl || '',
      iconAlt: dataset.iconAlt || 'Badge icon',
      iconBlink: parseBoolean(dataset.iconBlink, false),
      iconBlinkIntensity: parseNumber(dataset.iconBlinkIntensity, 50),
      iconSize: parseNumber(dataset.iconSize, 36),
      iconSizeMobile: parseNumber(dataset.iconSizeMobile, 30),
      borderRadius: parseNumber(dataset.borderRadius, 8),
      borderThickness: parseNumber(dataset.borderThickness, 1),
      hoverEffect: parseBoolean(dataset.hoverEffect, true),
      dropShadow: parseNumber(dataset.dropShadow, 10)
    };

    // Apply Step 2 overrides if enabled
    // Use getAttribute because dataset API can be unreliable with numbers in attribute names
    var enableStep2Raw = container.getAttribute('data-enable-step-2') || dataset.enableStep2;
    var enableStep2 = parseBoolean(enableStep2Raw, false);
    console.log('Simple Text Badge Debug:', {
      rawValue: enableStep2Raw,
      parsed: enableStep2,
      fromGetAttribute: container.getAttribute('data-enable-step-2'),
      fromDataset: dataset.enableStep2
    });
    if (enableStep2) {
      console.log('Step 2 is ENABLED - applying overrides');
      base.headerText = '<p>Free Shipping</p>';
      base.iconChoice = 'trophy';
      base.backgroundColor = '#ff0000';
    } else {
      console.log('Step 2 is DISABLED - using default settings');
    }

    var normalizedOverrides = normalizeOverrides(overrides);
    Object.assign(base, normalizedOverrides);

    console.log('Final settings after overrides:', {
      headerText: base.headerText,
      iconChoice: base.iconChoice,
      backgroundColor: base.backgroundColor,
      hasExternalOverrides: Object.keys(normalizedOverrides).length > 0
    });

    return base;
  }

  function normalizeOverrides(overrides) {
    if (!overrides) return {};
    var normalized = Object.assign({}, overrides);

    if (normalized.badge_text && !normalized.bodyText) {
      normalized.bodyText = normalized.badge_text;
    }
    if (normalized.text && !normalized.bodyText) {
      normalized.bodyText = normalized.text;
    }
    if (normalized.text_color && !normalized.textColor) {
      normalized.textColor = normalized.text_color;
    }
    if (normalized.background_color && !normalized.backgroundColor) {
      normalized.backgroundColor = normalized.background_color;
    }
    if (normalized.header_text && !normalized.headerText) {
      normalized.headerText = normalized.header_text;
    }
    if (normalized.border_color && !normalized.borderColor) {
      normalized.borderColor = normalized.border_color;
    }

    return normalized;
  }

  function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') return Boolean(fallback);
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  }

  function parseNumber(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    var num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  function formatRichText(value) {
    var decoded = decodeHtmlEntities(value || '');
    if (!decoded || !decoded.trim()) return '';

    var temp = document.createElement('div');
    temp.innerHTML = decoded;
    temp.querySelectorAll('script, style').forEach(function(node) { node.remove(); });

    var allowedTags = ['P', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'A', 'BR', 'UL', 'OL', 'LI'];
    Array.prototype.slice.call(temp.getElementsByTagName('*')).forEach(function(node) {
      if (allowedTags.indexOf(node.tagName) === -1) {
        var parent = node.parentNode;
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
        return;
      }
      if (node.tagName === 'A') {
        var href = node.getAttribute('href') || '';
        if (!href || href.indexOf('javascript:') === 0) {
          node.removeAttribute('href');
        }
        node.setAttribute('rel', 'noopener');
      } else {
        node.removeAttribute('style');
        node.removeAttribute('onclick');
        node.removeAttribute('onmouseover');
        node.removeAttribute('onmouseout');
      }
    });

    return temp.innerHTML;
  }

  function decodeHtmlEntities(str) {
    if (!str) return '';
    var txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttribute(value) {
    return value.replace(/"/g, '&quot;');
  }

  function decodeConfigValue(value) {
    try {
      var json = decodeURIComponent(escape(window.atob(value)));
      return JSON.parse(json);
    } catch (error) {
      console.warn('Simple Text Badge: Failed to decode widget config', error);
      return null;
    }
  }

  function getWidgetOverride() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.has(CONFIG_PARAM)) {
        var payload = decodeConfigValue(params.get(CONFIG_PARAM));
        if (payload && payload.widgetType === WIDGET_TYPE) {
          return payload.settings || null;
        }
      }
    } catch (error) {
      console.warn('Simple Text Badge: Unable to read preview config', error);
    }

    var hasVariantMatch = !window.ABTestVariantTemplate || !window.currentVariant || window.currentVariant === window.ABTestVariantTemplate;
    if (window.ABTestWidgetConfig && window.ABTestWidgetConfig.widgetType === WIDGET_TYPE && hasVariantMatch) {
      return window.ABTestWidgetConfig.settings || null;
    }

    return null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

