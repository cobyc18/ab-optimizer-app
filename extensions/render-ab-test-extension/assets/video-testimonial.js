// Video Testimonial Widget JavaScript
(function() {
  'use strict';

  function init() {
    refreshTestimonials();
    registerThemeEditorListeners();
  }

  function refreshTestimonials() {
    document.querySelectorAll('.video-testimonial-widget').forEach(function(container) {
      var containerSettings = getContainerSettings(container);
      applyCssVariables(container, containerSettings);
      
      var testimonialItems = container.querySelectorAll('.testimonial-item');
      if (testimonialItems.length === 0) return;
      
      // Render all testimonials
      testimonialItems.forEach(function(item, index) {
        var isActive = item.dataset.active === 'true';
        renderTestimonialItem(item, containerSettings, isActive);
      });
      
      // Setup carousel navigation
      setupCarousel(container, testimonialItems);
      
      // Setup play button handlers
      setupPlayButtons(container);
    });
  }

  function renderTestimonialItem(item, containerSettings, isActive) {
    var itemSettings = getItemSettings(item);
    
    var videoMarkup = buildVideoMarkup(itemSettings);
    var imageMarkup = buildImageMarkup(itemSettings);
    var starsMarkup = buildStarsMarkup(itemSettings, containerSettings);
    var authorMarkup = buildAuthorMarkup(itemSettings, containerSettings);
    var dateMarkup = buildDateMarkup(itemSettings, containerSettings);
    var verifiedBadge = buildVerifiedBadge(itemSettings);
    var textMarkup = buildTextMarkup(itemSettings, containerSettings);
    var titleMarkup = buildTitleMarkup(itemSettings, containerSettings);
    var checkmarkIcon = buildCheckmarkIcon(itemSettings);
    var carouselArrow = buildCarouselArrow();

    var classes = ['video-testimonial'];
    if (containerSettings.hoverEffect) {
      classes.push('hover-enabled');
    }
    if (!isActive) {
      classes.push('testimonial-hidden');
    }
    
    var testimonialPlacement = containerSettings.testimonialPlacement || 'layout_1';
    var contentMarkup = buildContentMarkup(testimonialPlacement, itemSettings, containerSettings, videoMarkup || imageMarkup || '', starsMarkup, authorMarkup, dateMarkup, verifiedBadge, titleMarkup, checkmarkIcon, textMarkup);

    item.innerHTML = `
      <div class="${classes.join(' ')}" data-testimonial-placement="${testimonialPlacement}">
        ${contentMarkup}
        ${carouselArrow}
      </div>
    `;
  }
  
  function buildContentMarkup(placement, itemSettings, containerSettings, mediaHtml, starsMarkup, authorMarkup, dateMarkup, verifiedBadge, titleMarkup, checkmarkIcon, textMarkup) {
    // Layout 1: Image/Video Left - Stars & Text Right (with checkmark and author)
    if (placement === 'layout_1') {
      var authorWithCheckmark = itemSettings.checkmark ? checkmarkIcon + authorMarkup : authorMarkup;
      var authorWithBadge = authorWithCheckmark + (itemSettings.verified ? verifiedBadge : '');
      return `
        ${mediaHtml}
        <div class="testimonial-content">
          <div class="testimonial-header">
            <div class="testimonial-author-wrapper">
              ${authorWithBadge}
              ${dateMarkup}
            </div>
            ${starsMarkup}
          </div>
          ${textMarkup}
        </div>
      `;
    }
    // Layout 2: No Media - Stars, Title, Text, Author (with verified badge to the right of author)
    else if (placement === 'layout_2') {
      return `
        <div class="testimonial-content no-media">
          <div class="testimonial-header-vertical">
            ${starsMarkup}
          </div>
          ${titleMarkup}
          ${textMarkup}
          <div class="testimonial-author-section-bottom">
            ${authorMarkup}
            ${itemSettings.verified ? verifiedBadge : ''}
          </div>
        </div>
      `;
    }
    // Layout 3: No Media - Stars Left, Author Right
    else if (placement === 'layout_3') {
      return `
        <div class="testimonial-content no-media-split">
          <div class="testimonial-header-split">
            <div class="testimonial-header-left-stars">
              ${starsMarkup}
              ${titleMarkup}
            </div>
            <div class="testimonial-header-right-author">
              ${authorMarkup}
              ${dateMarkup}
            </div>
          </div>
          ${textMarkup}
        </div>
      `;
    }
    // Default fallback (original layout)
    return `
      ${mediaHtml}
      <div class="testimonial-content">
        <div class="testimonial-header">
          <div class="testimonial-author-wrapper">
            ${authorMarkup}
            ${dateMarkup}
          </div>
          ${starsMarkup}
        </div>
        ${textMarkup}
      </div>
    `;
  }
  
  function buildDateMarkup(settings, containerSettings) {
    if (!settings.date) return '';
    return `<div class="testimonial-date">${escapeHtml(settings.date)}</div>`;
  }
  
  function buildVerifiedBadge(settings) {
    if (!settings.verified) return '';
    return `
      <div class="testimonial-verified-badge">
        <svg class="verified-checkmark" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Verified Buyer</span>
      </div>
    `;
  }

  function buildTitleMarkup(settings, containerSettings) {
    if (!settings.title) return '';
    var titleSize = containerSettings.titleFontSize || 18;
    var titleColor = containerSettings.titleColor || '#0f172a';
    return `<div class="testimonial-title" style="font-size: ${titleSize}px; color: ${titleColor};">${escapeHtml(settings.title)}</div>`;
  }

  function buildCheckmarkIcon(settings) {
    if (!settings.checkmark) return '';
    return `
      <svg class="testimonial-checkmark-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="8" fill="#10b981"/>
        <path d="M5 8L7 10L11 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function setupCarousel(container, items) {
    if (items.length <= 1) {
      // Hide arrows if only one testimonial
      container.querySelectorAll('.testimonial-carousel-arrow').forEach(function(arrow) {
        arrow.style.display = 'none';
      });
      return;
    }
    
    container.querySelectorAll('.testimonial-carousel-arrow').forEach(function(arrow) {
      arrow.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        var currentActive = container.querySelector('.testimonial-item[data-active="true"]');
        if (!currentActive) return;
        
        var currentIndex = Array.from(items).indexOf(currentActive);
        var nextIndex = (currentIndex + 1) % items.length;
        var nextItem = items[nextIndex];
        
        // Hide current
        currentActive.dataset.active = 'false';
        var currentTestimonial = currentActive.querySelector('.video-testimonial');
        if (currentTestimonial) {
          currentTestimonial.classList.add('testimonial-hidden');
        }
        
        // Show next
        nextItem.dataset.active = 'true';
        var nextTestimonial = nextItem.querySelector('.video-testimonial');
        if (nextTestimonial) {
          nextTestimonial.classList.remove('testimonial-hidden');
        }
      });
    });
  }

  function setupPlayButtons(container) {
    container.addEventListener('click', function(e) {
      var playButton = e.target.closest('.testimonial-play-button');
      if (playButton) {
        e.preventDefault();
        e.stopPropagation();
        
        var mediaContainer = playButton.closest('.testimonial-media-container');
        var thumbnail = mediaContainer.querySelector('.testimonial-video-thumbnail');
        var video = mediaContainer.querySelector('.testimonial-video');
        var iframe = mediaContainer.querySelector('.testimonial-video-embed');
        
        if (thumbnail) thumbnail.style.display = 'none';
        if (video) {
          video.style.display = 'block';
          video.play();
        }
        if (iframe) {
          iframe.style.display = 'block';
          iframe.src = iframe.dataset.embedUrl;
        }
      }
    });
  }

  function registerThemeEditorListeners() {
    // Prevent duplicate listeners
    if (window.__videoTestimonialThemeEditorListenersAdded) return;
    
    // Listen for section load events (fires when section is added/re-rendered)
    document.addEventListener('shopify:section:load', function(event) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshTestimonials();
        });
      });
    });

    // Listen for block select (when merchant selects the block in editor)
    document.addEventListener('shopify:block:select', function(event) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshTestimonials();
        });
      });
    });

    // Listen for block deselect to ensure settings are synced
    document.addEventListener('shopify:block:deselect', function(event) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshTestimonials();
        });
      });
    });

    window.__videoTestimonialThemeEditorListenersAdded = true;
  }

  function buildVideoMarkup(settings) {
    var hasVideo = false;
    var videoSource = '';
    
    // Priority: Shopify video > video URL embed
    if (settings.video) {
      hasVideo = true;
      videoSource = settings.video;
    } else if (settings.videoUrl) {
      var embedUrl = getEmbedUrl(settings.videoUrl);
      if (embedUrl) {
        hasVideo = true;
        videoSource = embedUrl;
      }
    }
    
    if (hasVideo) {
      var thumbnailSrc = settings.image || '';
      var thumbnailMarkup = '';
      
      if (thumbnailSrc) {
        thumbnailMarkup = `<img src="${escapeAttribute(thumbnailSrc)}" alt="Video thumbnail" class="testimonial-thumbnail-image" loading="lazy">`;
      } else {
        // Placeholder if no image provided
        thumbnailMarkup = '<div class="testimonial-thumbnail-placeholder"></div>';
      }
      
      if (settings.video) {
        // Shopify video - show thumbnail with play button
        return `
          <div class="testimonial-media-container">
            <div class="testimonial-video-thumbnail">
              ${thumbnailMarkup}
              <button class="testimonial-play-button" aria-label="Play video">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="12" fill="white"/>
                  <path d="M9 7L17 12L9 17V7Z" fill="#000"/>
                </svg>
              </button>
            </div>
            <video class="testimonial-video" controls style="display: none;">
              <source src="${escapeAttribute(videoSource)}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
        `;
      } else {
        // Embedded video - show thumbnail with play button
        return `
          <div class="testimonial-media-container">
            <div class="testimonial-video-thumbnail">
              ${thumbnailMarkup}
              <button class="testimonial-play-button" aria-label="Play video">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="12" fill="white"/>
                  <path d="M9 7L17 12L9 17V7Z" fill="#000"/>
                </svg>
              </button>
            </div>
            <iframe 
              class="testimonial-video-embed" 
              src="" 
              data-embed-url="${escapeAttribute(videoSource)}"
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen
              style="display: none;">
            </iframe>
          </div>
        `;
      }
    }
    
    return '';
  }

  function buildImageMarkup(settings) {
    if (!settings.image || settings.video || settings.videoUrl) return '';
    
    return `
      <div class="testimonial-media-container">
        <img src="${escapeAttribute(settings.image)}" alt="Testimonial" class="testimonial-image" loading="lazy">
      </div>
    `;
  }

  function buildStarsMarkup(settings, containerSettings) {
    if (!settings.starsCount || settings.starsCount === 0) return '';
    
    var starColor = containerSettings.starColor || '#000000';
    var stars = '';
    for (var i = 0; i < settings.starsCount; i++) {
      stars += `<span class="testimonial-star" style="color: ${starColor}">★</span>`;
    }
    
    return `<div class="testimonial-stars">${stars}</div>`;
  }

  function buildCarouselArrow() {
    return `
      <button class="testimonial-carousel-arrow" aria-label="Next testimonial">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
  }

  function buildAuthorMarkup(settings, containerSettings) {
    if (!settings.author) return '';
    
    return `<div class="testimonial-author">${escapeHtml(settings.author)}</div>`;
  }

  function buildTextMarkup(settings, containerSettings) {
    if (!settings.text) return '';
    
    return `<div class="testimonial-text">${escapeHtml(settings.text)}</div>`;
  }

  function getEmbedUrl(url) {
    if (!url) return null;
    
    // YouTube
    var youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (youtubeMatch) {
      return 'https://www.youtube.com/embed/' + youtubeMatch[1];
    }
    
    // Vimeo
    var vimeoMatch = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
    if (vimeoMatch) {
      return 'https://player.vimeo.com/video/' + vimeoMatch[1];
    }
    
    return null;
  }

  function applyCssVariables(container, settings) {
    container.style.setProperty('--testimonial-background-color', settings.backgroundColor);
    container.style.setProperty('--testimonial-border-color', settings.borderColor);
    container.style.setProperty('--testimonial-text-color', settings.textColor);
    container.style.setProperty('--testimonial-author-color', settings.authorColor);
    container.style.setProperty('--testimonial-border-radius', settings.borderRadius + 'px');
    container.style.setProperty('--testimonial-border-thickness', settings.borderThickness + 'px');

    container.style.setProperty('--testimonial-inner-padding-x', settings.innerPaddingX + 'px');
    container.style.setProperty('--testimonial-inner-padding-y', settings.innerPaddingY + 'px');
    container.style.setProperty('--testimonial-inner-padding-x-mobile', settings.innerPaddingXMobile + 'px');
    container.style.setProperty('--testimonial-inner-padding-y-mobile', settings.innerPaddingYMobile + 'px');

    container.style.setProperty('--testimonial-outer-padding-x', settings.outerPaddingX + 'px');
    container.style.setProperty('--testimonial-outer-padding-y', settings.outerPaddingY + 'px');
    container.style.setProperty('--testimonial-outer-padding-x-mobile', settings.outerPaddingXMobile + 'px');
    container.style.setProperty('--testimonial-outer-padding-y-mobile', settings.outerPaddingYMobile + 'px');

    var dropShadow = settings.dropShadow > 0
      ? `0 ${Math.max(4, settings.dropShadow / 3)}px ${Math.max(10, settings.dropShadow)}px rgba(15,23,42,0.16)`
      : 'none';
    var dropShadowHover = settings.dropShadow > 0
      ? `0 ${Math.max(6, settings.dropShadow / 2)}px ${Math.max(12, settings.dropShadow * 1.2)}px rgba(15,23,42,0.2)`
      : dropShadow;

    container.style.setProperty('--testimonial-drop-shadow', dropShadow);
    container.style.setProperty('--testimonial-drop-shadow-hover', dropShadowHover);
    container.style.setProperty('--testimonial-media-size', settings.mediaSize + 'px');
    container.style.setProperty('--testimonial-star-color', settings.starColor);
  }

  function getContainerSettings(container) {
    var dataset = container.dataset;
    
    return {
      innerPaddingX: parseNumber(dataset.innerPaddingX, 24),
      innerPaddingY: parseNumber(dataset.innerPaddingY, 16),
      innerPaddingXMobile: parseNumber(dataset.innerPaddingXMobile, 16),
      innerPaddingYMobile: parseNumber(dataset.innerPaddingYMobile, 12),
      outerPaddingX: parseNumber(dataset.outerPaddingX, 0),
      outerPaddingY: parseNumber(dataset.outerPaddingY, 0),
      outerPaddingXMobile: parseNumber(dataset.outerPaddingXMobile, 0),
      outerPaddingYMobile: parseNumber(dataset.outerPaddingYMobile, 0),
      borderRadius: parseNumber(dataset.borderRadius, 20),
      borderThickness: parseNumber(dataset.borderThickness, 0),
      hoverEffect: parseBoolean(dataset.hoverEffect, true),
      dropShadow: parseNumber(dataset.dropShadow, 10),
      textColor: dataset.textColor || '#1a5f5f',
      authorColor: dataset.authorColor || '#0f172a',
      backgroundColor: dataset.backgroundColor || '#ffffff',
      borderColor: dataset.borderColor || '#d4d4d8',
      mediaSize: parseNumber(dataset.mediaSize, 100),
      testimonialPlacement: dataset.testimonialPlacement || 'layout_1',
      starColor: dataset.starColor || '#000000',
      titleFontSize: parseNumber(dataset.titleFontSize, 18),
      titleColor: dataset.titleColor || '#0f172a'
    };
  }

  function getItemSettings(item) {
    var dataset = item.dataset;
    
    return {
      image: dataset.image || '',
      video: dataset.video || '',
      videoUrl: dataset.videoUrl || '',
      author: dataset.author || 'Author',
      starsCount: parseNumber(dataset.starsCount, 5),
      text: dataset.text || 'Text',
      date: dataset.date || '',
      verified: parseBoolean(dataset.verified, false),
      title: dataset.title || '',
      checkmark: parseBoolean(dataset.checkmark, false)
    };
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

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttribute(value) {
    return value.replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
