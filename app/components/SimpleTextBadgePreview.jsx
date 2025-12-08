import { useEffect, useRef, useState } from 'react';

const FONT_MAP = {
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

const ICON_LIBRARY = {
  star: '⭐',
  trophy: '🏆',
  gift: '🎁'
};

export default function SimpleTextBadgePreview({ 
  widgetSettings, 
  conversionPlayType = '',
  countMin = 40,
  countMax = 60
}) {
  const containerRef = useRef(null);
  const [currentCount, setCurrentCount] = useState(null);
  const countIntervalRef = useRef(null);

  // Format rich text (handle HTML)
  const formatRichText = (text) => {
    if (!text || text.trim() === '') return '';
    if (text.trim().startsWith('<')) return text;
    return `<p>${text}</p>`;
  };

  // Parse number with default
  const parseNumber = (value, defaultValue) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // Parse boolean with default
  const parseBoolean = (value, defaultValue) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return defaultValue;
  };

  // Get settings from widgetSettings
  const getSettings = () => {
    return {
      headerText: formatRichText(widgetSettings.headerText || ''),
      headerFont: widgetSettings.header_font || 'system',
      headerFontSize: parseNumber(widgetSettings.header_font_size, 24),
      headerUnderline: parseBoolean(widgetSettings.header_underline, false),
      headerColor: widgetSettings.header_color || '#0f172a',
      bodyText: formatRichText(widgetSettings.bodyText || ''),
      bodyFont: widgetSettings.body_font || 'system',
      bodyFontSize: parseNumber(widgetSettings.body_font_size, 16),
      bodyUnderline: parseBoolean(widgetSettings.body_underline, false),
      textColor: widgetSettings.textColor || '#1a5f5f',
      backgroundColor: widgetSettings.backgroundColor || '#f5f5f0',
      borderColor: widgetSettings.border_color || '#d4d4d8',
      headerBodySpacing: parseNumber(widgetSettings.header_body_spacing, 6),
      iconTextSpacing: parseNumber(widgetSettings.icon_text_spacing, 20),
      innerPaddingX: parseNumber(widgetSettings.inner_padding_horizontal, 24),
      innerPaddingY: parseNumber(widgetSettings.inner_padding_vertical, 16),
      innerPaddingXMobile: parseNumber(widgetSettings.inner_padding_horizontal_mobile, 16),
      innerPaddingYMobile: parseNumber(widgetSettings.inner_padding_vertical_mobile, 12),
      outerPaddingX: parseNumber(widgetSettings.outer_padding_horizontal, 0),
      outerPaddingY: parseNumber(widgetSettings.outer_padding_vertical, 0),
      outerPaddingXMobile: parseNumber(widgetSettings.outer_padding_horizontal_mobile, 0),
      outerPaddingYMobile: parseNumber(widgetSettings.outer_padding_vertical_mobile, 0),
      iconChoice: widgetSettings.icon_choice || 'star',
      iconUrl: widgetSettings.icon_custom || '',
      iconAlt: 'Badge icon',
      iconBlink: parseBoolean(widgetSettings.icon_blink, false),
      iconBlinkIntensity: parseNumber(widgetSettings.icon_blink_intensity, 50),
      iconSize: parseNumber(widgetSettings.icon_size, 36),
      iconSizeMobile: parseNumber(widgetSettings.icon_size_mobile, 30),
      borderRadius: parseNumber(widgetSettings.border_radius, 8),
      borderThickness: parseNumber(widgetSettings.border_thickness, 1),
      hoverEffect: parseBoolean(widgetSettings.hover_effect, true),
      dropShadow: parseNumber(widgetSettings.drop_shadow, 10)
    };
  };

  // Apply CSS variables to container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const settings = getSettings();

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
    
    container.style.setProperty('--badge-header-body-spacing', settings.headerBodySpacing + 'px');
    container.style.setProperty('--badge-icon-text-spacing', settings.iconTextSpacing + 'px');
    
    const intensity = settings.iconBlinkIntensity / 100;
    const blinkOpacity = 1 - (intensity * 0.7);
    const blinkScale = 1 - (intensity * 0.15);
    container.style.setProperty('--badge-blink-opacity', blinkOpacity);
    container.style.setProperty('--badge-blink-scale', blinkScale);
    
    container.style.setProperty('--badge-header-color', settings.headerColor);
    container.style.setProperty('--badge-header-font-size', settings.headerFontSize + 'px');
    container.style.setProperty('--badge-header-font-family', FONT_MAP[settings.headerFont] || 'inherit');
    container.style.setProperty('--badge-header-text-decoration', settings.headerUnderline ? 'underline' : 'none');
    
    container.style.setProperty('--badge-body-font-size', settings.bodyFontSize + 'px');
    container.style.setProperty('--badge-body-font-family', FONT_MAP[settings.bodyFont] || 'inherit');
    container.style.setProperty('--badge-body-text-decoration', settings.bodyUnderline ? 'underline' : 'none');

    const dropShadow = settings.dropShadow > 0
      ? `0 ${Math.max(4, settings.dropShadow / 3)}px ${Math.max(10, settings.dropShadow)}px rgba(15,23,42,0.16)`
      : 'none';
    const dropShadowHover = settings.dropShadow > 0
      ? `0 ${Math.max(6, settings.dropShadow / 2)}px ${Math.max(12, settings.dropShadow * 1.2)}px rgba(15,23,42,0.2)`
      : dropShadow;

    container.style.setProperty('--badge-drop-shadow', dropShadow);
    container.style.setProperty('--badge-drop-shadow-hover', dropShadowHover);
  }, [widgetSettings]);

  // Live visitor count logic
  useEffect(() => {
    if (conversionPlayType !== 'live-visitor-count' && conversionPlayType !== 'how-many-in-cart') {
      return;
    }

    const validMin = Math.min(countMin, countMax);
    const validMax = Math.max(countMin, countMax);
    
    // Initialize count
    if (currentCount === null) {
      const bodyText = widgetSettings.bodyText || '';
      const countMatch = bodyText.match(/\d+/);
      let initialCount;
      
      if (!countMatch || parseInt(countMatch[0]) === 0) {
        initialCount = Math.floor((validMin + validMax) / 2);
      } else {
        initialCount = Math.max(validMin, Math.min(validMax, parseInt(countMatch[0]) || validMin));
      }
      
      setCurrentCount(initialCount);
    }

    // Update count periodically
    const updateCount = () => {
      setCurrentCount(prev => {
        if (prev === null) return prev;
        const change = Math.floor(Math.random() * 5) - 2;
        const newCount = prev + change;
        return Math.max(validMin, Math.min(validMax, newCount));
      });
    };

    const delay = Math.random() * 7000 + 8000;
    countIntervalRef.current = setTimeout(() => {
      updateCount();
      const scheduleNext = () => {
        const nextDelay = Math.random() * 7000 + 8000;
        countIntervalRef.current = setTimeout(() => {
          updateCount();
          scheduleNext();
        }, nextDelay);
      };
      scheduleNext();
    }, delay);

    return () => {
      if (countIntervalRef.current) {
        clearTimeout(countIntervalRef.current);
      }
    };
  }, [conversionPlayType, countMin, countMax, widgetSettings.bodyText]);

  // Get body text with updated count
  const getBodyText = () => {
    let bodyText = widgetSettings.bodyText || '';
    
    if ((conversionPlayType === 'live-visitor-count' || conversionPlayType === 'how-many-in-cart') && currentCount !== null) {
      // Replace any number in the body text with the current count
      const numberMatch = bodyText.match(/\d+/);
      if (numberMatch) {
        bodyText = bodyText.replace(/\b\d+\b/g, String(currentCount));
      }
    }
    
    return formatRichText(bodyText);
  };

  const settings = getSettings();
  const bodyText = getBodyText();

  // Build icon markup
  const buildIconMarkup = () => {
    const blinkClass = settings.iconBlink ? ' blinking' : '';
    
    if (settings.iconUrl) {
      return (
        <div className={`badge-icon-container${blinkClass}`}>
          <img 
            src={settings.iconUrl} 
            alt={settings.iconAlt} 
            className="badge-icon-img" 
            loading="lazy"
          />
        </div>
      );
    }

    if (settings.iconChoice === 'none') {
      return null;
    }

    const iconSymbol = ICON_LIBRARY[settings.iconChoice];
    if (!iconSymbol) {
      return null;
    }

    return (
      <div className={`badge-icon-container${blinkClass}`}>
        <span className="badge-icon-swatch" aria-hidden="true">{iconSymbol}</span>
      </div>
    );
  };

  const iconMarkup = buildIconMarkup();
  const classes = ['simple-text-badge', iconMarkup ? 'has-icon' : 'no-icon'];
  if (settings.hoverEffect) {
    classes.push('hover-enabled');
  }

  return (
    <div 
      ref={containerRef}
      className="simple-text-badge-widget"
      style={{
        width: '100%',
        margin: 0,
        padding: `${settings.outerPaddingY}px ${settings.outerPaddingX}px`,
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      <div className={classes.join(' ')}>
        {iconMarkup}
        <div className="badge-content">
          {settings.headerText && (
            <div 
              className="badge-heading"
              dangerouslySetInnerHTML={{ __html: settings.headerText }}
            />
          )}
          {bodyText && (
            <div 
              className="badge-body"
              dangerouslySetInnerHTML={{ __html: bodyText }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

