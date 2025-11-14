// Simple Text Badge Widget JavaScript
(function() {
  'use strict';

  function init() {
    const containers = document.querySelectorAll('.simple-text-badge-widget');
    containers.forEach(function(container) {
      renderBadge(container);
    });
  }

  function renderBadge(container) {
    const settings = getSettings(container);
    
    // Set CSS variables for colors
    container.style.setProperty('--badge-text-color', settings.textColor);
    container.style.setProperty('--badge-background-color', settings.backgroundColor);
      container.style.setProperty('--badge-border-color', settings.borderColor);
      container.style.setProperty('--badge-border-radius', getBorderRadiusFromShape(settings.borderShape));
      container.style.setProperty('--badge-alignment', getAlignmentValue(settings.alignment));
    container.style.setProperty('--badge-ribbon-color', settings.ribbonColor);
    
    // Parse text to identify bold and link portions
    const textParts = parseText(settings.text);
    
    // Build icon HTML if image is provided
    let iconHtml = '';
    if (settings.iconUrl) {
      iconHtml = `
        <div class="badge-icon-container">
          <img src="${settings.iconUrl}" alt="${settings.iconAlt || 'Badge icon'}" class="badge-icon" loading="lazy">
        </div>
      `;
    }
    
    // Build text HTML with formatting
    let textHtml = '';
    textParts.forEach(function(part, index) {
      if (part.type === 'bold') {
        textHtml += `<span class="badge-text-bold">${escapeHtml(part.text)}</span>`;
      } else if (part.type === 'link') {
        textHtml += `<span class="badge-text-link">${escapeHtml(part.text)}</span>`;
      } else {
        textHtml += escapeHtml(part.text);
      }
    });
    
    // Build complete HTML
    const hasIcon = !!settings.iconUrl;
    const html = `
      <div class="simple-text-badge ${hasIcon ? 'has-icon' : 'no-icon'}">
        ${iconHtml}
        <div class="badge-content">
          <p class="badge-text">${textHtml}</p>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }

  function parseText(text) {
    if (!text) return [{ type: 'normal', text: '' }];
    
    const parts = [];
    let currentIndex = 0;
    
    // Simple parsing: Look for common patterns
    // Pattern 1: Text before colon might be bold
    // Pattern 2: "Learn More" or similar at the end might be a link
    
    const colonIndex = text.indexOf(':');
    const learnMoreMatch = text.match(/\b(Learn More|Learn more|learn more|View More|View more|view more|See More|See more|see more|Shop Now|Shop now|shop now)\b/i);
    
    if (colonIndex > 0) {
      // Text before colon is bold
      parts.push({ type: 'bold', text: text.substring(0, colonIndex + 1) });
      currentIndex = colonIndex + 1;
    }
    
    if (learnMoreMatch && learnMoreMatch.index !== undefined) {
      // Text before "Learn More" is normal
      if (learnMoreMatch.index > currentIndex) {
        const beforeLink = text.substring(currentIndex, learnMoreMatch.index).trim();
        if (beforeLink) {
          parts.push({ type: 'normal', text: beforeLink + ' ' });
        }
      }
      
      // "Learn More" is a link
      parts.push({ type: 'link', text: learnMoreMatch[0] });
      currentIndex = learnMoreMatch.index + learnMoreMatch[0].length;
      
      // Any remaining text
      if (currentIndex < text.length) {
        const remaining = text.substring(currentIndex).trim();
        if (remaining) {
          parts.push({ type: 'normal', text: ' ' + remaining });
        }
      }
    } else {
      // No special formatting found, just use the text as normal
      if (currentIndex < text.length) {
        parts.push({ type: 'normal', text: text.substring(currentIndex) });
      }
    }
    
    return parts.length > 0 ? parts : [{ type: 'normal', text: text }];
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getSettings(container) {
    const dataset = container.dataset;
    return {
      text: dataset.text || 'Up to 25% Off Everything: Our biggest savings of the year are here. Learn More',
      textColor: dataset.textColor || '#1a5f5f',
      backgroundColor: dataset.backgroundColor || '#f5f5f0',
      ribbonColor: dataset.ribbonColor || '#dc2626',
      borderColor: dataset.borderColor || '#d4d4d4',
      borderShape: dataset.borderShape || 'sharp',
      alignment: dataset.alignment || 'left',
      iconUrl: dataset.iconUrl || '',
      iconAlt: dataset.iconAlt || 'Badge icon'
    };
  }

  function getBorderRadiusFromShape(shape) {
    if (shape === 'pill') return '999px';
    if (shape === 'rounded') return '12px';
    return '0px';
  }

  function getAlignmentValue(alignment) {
    if (alignment === 'center') return 'center';
    if (alignment === 'right') return 'flex-end';
    return 'flex-start';
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

