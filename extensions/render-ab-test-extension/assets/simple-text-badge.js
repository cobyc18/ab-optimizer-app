// Simple Text Badge Widget JavaScript
(function() {
  'use strict';

  var CONFIG_PARAM = 'ab_widget_config';
  var WIDGET_TYPE = 'simple-text-badge';
  var FONT_MAP = {
    system: 'inherit',
    poppins: "'Poppins', sans-serif",
    inter: "'Inter', sans-serif",
    serif: "'Georgia', serif"
  };
  var ICON_LIBRARY = {
    star: '⭐',
    trophy: '🏆',
    gift: '🎁'
  };
  var ALLOWED_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'];

  function init() {
    refreshBadges();
    registerConfigListener();
  }

  function refreshBadges() {
    document.querySelectorAll('.simple-text-badge-widget').forEach(function(container) {
      renderBadge(container);
    });
  }

  function registerConfigListener() {
    if (window.__simpleTextBadgeConfigListenerAdded) return;
    window.addEventListener('abTestWidgetConfigUpdate', refreshBadges);
    window.__simpleTextBadgeConfigListenerAdded = true;
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
    if (settings.iconChoice === 'custom' && settings.iconUrl) {
      return `
        <div class="badge-icon-container${blinkClass}">
          <img src="${settings.iconUrl}" alt="${escapeAttribute(settings.iconAlt || 'Badge icon')}" class="badge-icon-img" loading="lazy">
        </div>
      `;
    }

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
    var tag = sanitizeTag(settings.headerTag);
    var content = formatTextForHtml(settings.headerText);
    var wrappedContent = wrapWithLink(content, settings.headerLink);
    var styles = [
      'color:' + settings.headerColor,
      'font-size:' + settings.headerFontSize + 'px',
      'font-family:' + (FONT_MAP[settings.headerFont] || 'inherit'),
      'font-weight:' + (settings.headerBold ? 700 : 500),
      'font-style:' + (settings.headerItalic ? 'italic' : 'normal'),
      'text-decoration:' + (settings.headerUnderline ? 'underline' : 'none')
    ].join(';');

    return `<${tag} class="badge-heading" style="${styles}">${wrappedContent}</${tag}>`;
  }

  function buildBodyMarkup(settings) {
    if (!settings.bodyText) return '';
    var content = formatTextForHtml(settings.bodyText);
    var wrappedContent = wrapWithLink(content, settings.bodyLink);
    var styles = [
      'color:' + settings.textColor,
      'font-size:' + settings.bodyFontSize + 'px',
      'font-family:' + (FONT_MAP[settings.bodyFont] || 'inherit'),
      'font-weight:' + (settings.bodyBold ? 600 : 400),
      'font-style:' + (settings.bodyItalic ? 'italic' : 'normal'),
      'text-decoration:' + (settings.bodyUnderline ? 'underline' : 'none')
    ].join(';');

    return `<p class="badge-body" style="${styles}">${wrappedContent}</p>`;
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
    var base = {
      headerText: formatRichText(dataset.headerText, 'Store Announcement'),
      headerTag: sanitizeTag(dataset.headerTag || 'p'),
      headerFont: dataset.headerFont || 'system',
      headerFontSize: parseNumber(dataset.headerFontSize, 24),
      headerBold: parseBoolean(dataset.headerBold, true),
      headerItalic: parseBoolean(dataset.headerItalic, false),
      headerUnderline: parseBoolean(dataset.headerUnderline, false),
      headerLink: dataset.headerLink || '',
      headerColor: dataset.headerColor || '#0f172a',
      bodyText: formatRichText(dataset.bodyText, 'Describe the promotion or offer details here.'),
      bodyFont: dataset.bodyFont || 'system',
      bodyFontSize: parseNumber(dataset.bodyFontSize, 16),
      bodyBold: parseBoolean(dataset.bodyBold, false),
      bodyItalic: parseBoolean(dataset.bodyItalic, false),
      bodyUnderline: parseBoolean(dataset.bodyUnderline, false),
      bodyLink: dataset.bodyLink || '',
      textColor: dataset.textColor || '#1a5f5f',
      backgroundColor: dataset.backgroundColor || '#f5f5f0',
      borderColor: dataset.borderColor || '#d4d4d8',
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
      iconSize: parseNumber(dataset.iconSize, 36),
      iconSizeMobile: parseNumber(dataset.iconSizeMobile, 30),
      borderRadius: parseNumber(dataset.borderRadius, 8),
      borderThickness: parseNumber(dataset.borderThickness, 1),
      hoverEffect: parseBoolean(dataset.hoverEffect, true),
      dropShadow: parseNumber(dataset.dropShadow, 10)
    };

    var normalizedOverrides = normalizeOverrides(overrides);
    Object.assign(base, normalizedOverrides);

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

  function formatRichText(value, fallback) {
    var decoded = decodeHtmlEntities(value || '');
    var stripped = stripHtml(decoded).trim();
    return stripped || fallback || '';
  }

  function formatTextForHtml(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function wrapWithLink(content, href) {
    if (!href) return content;
    var safeHref = escapeAttribute(href);
    return `<a href="${safeHref}" target="_self" rel="noopener">${content}</a>`;
  }

  function sanitizeTag(tag) {
    var safeTag = (tag || '').toLowerCase();
    return ALLOWED_TAGS.includes(safeTag) ? safeTag : 'p';
  }

  function decodeHtmlEntities(str) {
    if (!str) return '';
    var txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  function stripHtml(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('script, style').forEach(function(node) { node.remove(); });
    return temp.textContent || temp.innerText || '';
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

