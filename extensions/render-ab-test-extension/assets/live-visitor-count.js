// Live Visitor Count Widget JavaScript
(function() {
  'use strict';

  var CONFIG_PARAM = 'ab_widget_config';
  var WIDGET_TYPE = 'live-visitor-count';

  function init() {
    refreshLiveVisitorWidgets();
    registerConfigListener();
  }

  function refreshLiveVisitorWidgets() {
    const containers = document.querySelectorAll('.live-visitor-count-widget');
    containers.forEach(function(container) {
      renderWidget(container);
      initWidget(container);
    });
  }

  function registerConfigListener() {
    if (window.__liveVisitorWidgetListenerAdded) return;
    window.addEventListener('abTestWidgetConfigUpdate', refreshLiveVisitorWidgets);
    window.__liveVisitorWidgetListenerAdded = true;
  }

  function renderWidget(container) {
    const overrides = getWidgetOverride();
    const settings = getSettings(container, overrides);
    const widgetId = container.dataset.widgetId;
    
    // Calculate padding horizontal
    const desktopPaddingH = Math.floor(parseInt(settings.desktopPaddingInside) * 1.5);
    const mobilePaddingH = Math.floor(parseInt(settings.mobilePaddingInside) * 1.5);
    
    // Build CSS variables
    const cssVars = {
      '--desktop-padding': settings.desktopPaddingInside + 'px',
      '--desktop-padding-h': desktopPaddingH + 'px',
      '--desktop-padding-outside': settings.desktopPaddingOutside + 'px',
      '--desktop-border-radius': settings.desktopBorderShape === 'rounded' ? '12px' : '0px',
      '--desktop-font-size': settings.desktopFontSize + 'px',
      '--desktop-width': settings.desktopWidth > 0 ? settings.desktopWidth + 'px' : 'auto',
      '--desktop-height': settings.desktopHeight > 0 ? settings.desktopHeight + 'px' : 'auto',
      '--desktop-alignment': settings.desktopAlignment,
      '--mobile-padding': settings.mobilePaddingInside + 'px',
      '--mobile-padding-h': mobilePaddingH + 'px',
      '--mobile-padding-outside': settings.mobilePaddingOutside + 'px',
      '--mobile-border-radius': settings.mobileBorderShape === 'rounded' ? '12px' : '0px',
      '--mobile-font-size': settings.mobileFontSize + 'px',
      '--mobile-width': settings.mobileWidth > 0 ? settings.mobileWidth + 'px' : 'auto',
      '--mobile-height': settings.mobileHeight > 0 ? settings.mobileHeight + 'px' : 'auto',
      '--mobile-alignment': settings.mobileAlignment
    };
    
    // Apply CSS variables
    Object.keys(cssVars).forEach(function(key) {
      container.style.setProperty(key, cssVars[key]);
    });
    
    // Build HTML
    const html = `
      <div class="live-visitor-widget" 
           data-widget-id="${widgetId}"
           data-min-count="${settings.countMin}"
           data-max-count="${settings.countMax}"
           data-desktop-font="${settings.desktopFont}"
           data-mobile-font="${settings.mobileFont}"
           ${settings.desktopHeight > 0 ? 'data-desktop-height' : ''}
           ${settings.mobileHeight > 0 ? 'data-mobile-height' : ''}>
        <svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="#667eea"/>
          <circle cx="12" cy="12" r="2.5" fill="white"/>
          <circle cx="12" cy="12" r="1.5" fill="#667eea"/>
        </svg>
        <span class="visitor-count" data-count="${settings.countMin}">${settings.countMin}</span>
        <span class="visitor-text desktop-text">${settings.desktopText}</span>
        <span class="visitor-text mobile-text">${settings.mobileText}</span>
      </div>
    `;
    
    container.innerHTML = html;
  }

  function initWidget(container) {
    const widget = container.querySelector('.live-visitor-widget');
    if (!widget) return;
    
    const countElement = widget.querySelector('.visitor-count');
    if (!countElement) return;
    
    const minCount = parseInt(widget.dataset.minCount) || 40;
    const maxCount = parseInt(widget.dataset.maxCount) || 60;
    
    const validMin = Math.min(minCount, maxCount);
    const validMax = Math.max(minCount, maxCount);
    
    let currentCount = Math.max(validMin, Math.min(validMax, parseInt(countElement.dataset.count) || validMin));
    countElement.textContent = currentCount;
    countElement.dataset.count = currentCount;
    
    function updateVisitorCount() {
      const change = Math.floor(Math.random() * 5) - 2;
      let newCount = currentCount + change;
      newCount = Math.max(validMin, Math.min(validMax, newCount));
      
      if (newCount !== currentCount) {
        countElement.classList.add('updating');
        currentCount = newCount;
        
        setTimeout(function() {
          countElement.textContent = currentCount;
          countElement.dataset.count = currentCount;
          countElement.classList.remove('updating');
        }, 150);
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

  function getSettings(container, overrides) {
    const dataset = container.dataset;
    const baseSettings = {
      countMin: parseInt(dataset.countMin) || 40,
      countMax: parseInt(dataset.countMax) || 60,
      desktopText: dataset.desktopText || 'people currently looking at this product',
      mobileText: dataset.mobileText || 'people currently looking at this product',
      desktopBorderShape: dataset.desktopBorderShape || 'rounded',
      mobileBorderShape: dataset.mobileBorderShape || 'rounded',
      desktopPaddingInside: parseInt(dataset.desktopPaddingInside) || 12,
      desktopPaddingOutside: parseInt(dataset.desktopPaddingOutside) || 0,
      mobilePaddingInside: parseInt(dataset.mobilePaddingInside) || 10,
      mobilePaddingOutside: parseInt(dataset.mobilePaddingOutside) || 0,
      desktopFont: dataset.desktopFont || 'system',
      mobileFont: dataset.mobileFont || 'system',
      desktopFontSize: parseInt(dataset.desktopFontSize) || 14,
      mobileFontSize: parseInt(dataset.mobileFontSize) || 12,
      desktopWidth: parseInt(dataset.desktopWidth) || 400,
      mobileWidth: parseInt(dataset.mobileWidth) || 300,
      desktopHeight: parseInt(dataset.desktopHeight) || 60,
      mobileHeight: parseInt(dataset.mobileHeight) || 48,
      desktopAlignment: dataset.desktopAlignment || 'left',
      mobileAlignment: dataset.mobileAlignment || 'left'
    };

    if (!overrides) {
      return baseSettings;
    }

    const merged = Object.assign({}, baseSettings);
    Object.keys(overrides).forEach(function(key) {
      if (overrides[key] !== undefined && overrides[key] !== null) {
        merged[key] = overrides[key];
      }
    });
    return merged;
  }

  function decodeConfigValue(value) {
    try {
      const json = decodeURIComponent(escape(window.atob(value)));
      return JSON.parse(json);
    } catch (error) {
      console.warn('Live Visitor Count: Failed to decode widget config', error);
      return null;
    }
  }

  function getWidgetOverride() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.has(CONFIG_PARAM)) {
        const payload = decodeConfigValue(params.get(CONFIG_PARAM));
        if (payload && payload.widgetType === WIDGET_TYPE) {
          return payload.settings || null;
        }
      }
    } catch (error) {
      console.warn('Live Visitor Count: Unable to read preview config', error);
    }

    const hasVariantMatch = !window.ABTestVariantTemplate || !window.currentVariant || window.currentVariant === window.ABTestVariantTemplate;
    if (window.ABTestWidgetConfig && window.ABTestWidgetConfig.widgetType === WIDGET_TYPE && hasVariantMatch) {
      return window.ABTestWidgetConfig.settings || null;
    }

    return null;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
