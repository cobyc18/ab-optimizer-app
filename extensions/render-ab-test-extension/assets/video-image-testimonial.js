// Video Image Testimonial Widget JavaScript
(function() {
  'use strict';

  function init() {
    refreshReviews();
    registerThemeEditorListeners();
  }

  function refreshReviews() {
    document.querySelectorAll('.video-image-testimonial-widget').forEach(function(container) {
      var containerSettings = getContainerSettings(container);
      applyCssVariables(container, containerSettings);
      
      var reviewItems = container.querySelectorAll('.review-item');
      if (reviewItems.length === 0) return;
      
      // Render all reviews
      reviewItems.forEach(function(item, index) {
        var isActive = item.dataset.active === 'true';
        renderReviewItem(item, containerSettings, isActive);
      });
      
      // Setup carousel navigation
      setupCarousel(container, reviewItems);
      
      // Setup play button handlers
      setupPlayButtons(container);
    });
  }

  function renderReviewItem(item, containerSettings, isActive) {
    var itemSettings = getItemSettings(item);
    
    var videoMarkup = buildVideoMarkup(itemSettings, containerSettings);
    var imageMarkup = buildImageMarkup(itemSettings, containerSettings);
    var starsMarkup = buildStarsMarkup(itemSettings, containerSettings);
    var authorMarkup = buildAuthorMarkup(itemSettings, containerSettings);
    var textMarkup = buildTextMarkup(itemSettings, containerSettings);
    var carouselArrow = buildCarouselArrow(containerSettings);

    var classes = ['video-image-review'];
    if (!isActive) {
      classes.push('review-hidden');
    }

    item.innerHTML = `
      <div class="${classes.join(' ')}">
        ${videoMarkup || imageMarkup || ''}
        <div class="review-content">
          ${starsMarkup}
          ${textMarkup}
          ${authorMarkup}
        </div>
        ${carouselArrow}
      </div>
    `;
  }

  function setupCarousel(container, items) {
    if (items.length <= 1) {
      container.querySelectorAll('.review-carousel-arrow').forEach(function(arrow) {
        arrow.style.display = 'none';
      });
      return;
    }
    
    container.querySelectorAll('.review-carousel-arrow').forEach(function(arrow) {
      arrow.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        var currentActive = container.querySelector('.review-item[data-active="true"]');
        if (!currentActive) return;
        
        var currentIndex = Array.from(items).indexOf(currentActive);
        var nextIndex = (currentIndex + 1) % items.length;
        var nextItem = items[nextIndex];
        
        // Hide current
        currentActive.dataset.active = 'false';
        var currentReview = currentActive.querySelector('.video-image-review');
        if (currentReview) {
          currentReview.classList.add('review-hidden');
        }
        
        // Show next
        nextItem.dataset.active = 'true';
        var nextReview = nextItem.querySelector('.video-image-review');
        if (nextReview) {
          nextReview.classList.remove('review-hidden');
        }
      });
    });
  }

  function setupPlayButtons(container) {
    container.addEventListener('click', function(e) {
      var playButton = e.target.closest('.review-play-button');
      if (playButton) {
        e.preventDefault();
        e.stopPropagation();
        
        var mediaContainer = playButton.closest('.review-media-container');
        var thumbnail = mediaContainer.querySelector('.review-video-thumbnail');
        var video = mediaContainer.querySelector('.review-video');
        var iframe = mediaContainer.querySelector('.review-video-embed');
        
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
    if (window.__videoImageTestimonialThemeEditorListenersAdded) return;
    
    document.addEventListener('shopify:section:load', function(event) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshReviews();
        });
      });
    });

    document.addEventListener('shopify:block:select', function(event) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshReviews();
        });
      });
    });

    document.addEventListener('shopify:block:deselect', function(event) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshReviews();
        });
      });
    });

    window.__videoImageTestimonialThemeEditorListenersAdded = true;
  }

  function buildVideoMarkup(settings, containerSettings) {
    var hasVideo = false;
    var videoSource = '';
    
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
        thumbnailMarkup = `<img src="${escapeAttribute(thumbnailSrc)}" alt="Video thumbnail" class="review-thumbnail-image" ${containerSettings.lazy ? 'loading="lazy"' : ''}>`;
      } else {
        thumbnailMarkup = '<div class="review-thumbnail-placeholder"></div>';
      }
      
      var playIconMarkup = buildPlayIcon(containerSettings);
      
      var videoRatio = containerSettings.videoRatio || 'original';
      var videoRatioMobile = containerSettings.videoRatioMobile || 'original';
      
      if (settings.video) {
        return `
          <div class="review-media-container" data-ratio="${videoRatio}" data-ratio-mobile="${videoRatioMobile}">
            <div class="review-video-thumbnail">
              ${thumbnailMarkup}
              <button class="review-play-button" aria-label="Play video">
                ${playIconMarkup}
              </button>
            </div>
            <video class="review-video" controls style="display: none;">
              <source src="${escapeAttribute(videoSource)}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
        `;
      } else {
        return `
          <div class="review-media-container" data-ratio="${videoRatio}" data-ratio-mobile="${videoRatioMobile}">
            <div class="review-video-thumbnail">
              ${thumbnailMarkup}
              <button class="review-play-button" aria-label="Play video">
                ${playIconMarkup}
              </button>
            </div>
            <iframe 
              class="review-video-embed" 
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

  function buildImageMarkup(settings, containerSettings) {
    if (!settings.image || settings.video || settings.videoUrl) return '';
    
    var imageRatio = containerSettings.imageRatio || 'square';
    
    return `
      <div class="review-media-container" data-ratio="${imageRatio}" data-ratio-mobile="${imageRatio}">
        <img src="${escapeAttribute(settings.image)}" alt="Review" class="review-image" ${containerSettings.lazy ? 'loading="lazy"' : ''}>
      </div>
    `;
  }

  function buildPlayIcon(containerSettings) {
    if (containerSettings.playIconUrl) {
      return `<img src="${escapeAttribute(containerSettings.playIconUrl)}" alt="Play" class="review-play-icon-img">`;
    }
    return `
      <svg width="${containerSettings.playIconSize}" height="${containerSettings.playIconSize}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="currentColor"/>
        <path d="M9 7L17 12L9 17V7Z" fill="${containerSettings.playIconColor}"/>
      </svg>
    `;
  }

  function buildStarsMarkup(settings, containerSettings) {
    if (!settings.starsCount || settings.starsCount === 0) return '';
    
    var stars = '';
    var starIcon = containerSettings.starsIconUrl 
      ? `<img src="${escapeAttribute(containerSettings.starsIconUrl)}" alt="Star" class="review-star-icon">`
      : '★';
    
    for (var i = 0; i < settings.starsCount; i++) {
      stars += `<span class="review-star" style="color: ${containerSettings.starsColor}">${starIcon}</span>`;
    }
    
    return `<div class="review-stars">${stars}</div>`;
  }

  function buildAuthorMarkup(settings, containerSettings) {
    if (!settings.author) return '';
    
    return `<div class="review-author">${escapeHtml(settings.author)}</div>`;
  }

  function buildTextMarkup(settings, containerSettings) {
    if (!settings.text) return '';
    
    return `<div class="review-text">${escapeHtml(settings.text)}</div>`;
  }

  function buildCarouselArrow(containerSettings) {
    var showDesktop = containerSettings.arrowShowDesktop ? '' : 'review-arrow-hide-desktop';
    var showMobile = containerSettings.arrowShowMobile ? '' : 'review-arrow-hide-mobile';
    var classes = ['review-carousel-arrow', showDesktop, showMobile].filter(Boolean).join(' ');
    
    return `
      <button class="${classes}" aria-label="Next review">
        <svg width="${containerSettings.arrowIconSize}" height="${containerSettings.arrowIconSize}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
  }

  function getEmbedUrl(url) {
    if (!url) return null;
    
    var youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (youtubeMatch) {
      return 'https://www.youtube.com/embed/' + youtubeMatch[1];
    }
    
    var vimeoMatch = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
    if (vimeoMatch) {
      return 'https://player.vimeo.com/video/' + vimeoMatch[1];
    }
    
    return null;
  }

  function applyCssVariables(container, settings) {
    // Review container styles
    container.style.setProperty('--review-bg-color', settings.reviewBgColor);
    container.style.setProperty('--review-border-color', settings.reviewBorderColor);
    container.style.setProperty('--review-border-radius', settings.reviewsRadius + 'px');
    container.style.setProperty('--review-padding-vertical', settings.reviewPaddingVertical + 'px');
    container.style.setProperty('--review-padding-horizontal', settings.reviewPaddingHorizontal + 'px');
    container.style.setProperty('--review-radius', settings.reviewRadius + 'px');
    container.style.setProperty('--review-border-thickness', settings.reviewBorderThickness + 'px');
    
    // Image styles
    container.style.setProperty('--image-width', settings.imageWidth + 'px');
    container.style.setProperty('--image-radius', settings.imageRadius + 'px');
    container.style.setProperty('--image-border-thickness', settings.imageBorderThickness + 'px');
    container.style.setProperty('--image-border-color', settings.imageBorderColor);
    container.style.setProperty('--image-ratio', settings.imageRatio);
    
    // Video styles
    container.style.setProperty('--video-radius', settings.videoRadius + 'px');
    container.style.setProperty('--video-border-thickness', settings.videoBorderThickness + 'px');
    container.style.setProperty('--video-border-color', settings.videoBorderColor);
    container.style.setProperty('--video-ratio', settings.videoRatio);
    container.style.setProperty('--video-ratio-mobile', settings.videoRatioMobile);
    
    // Play icon
    container.style.setProperty('--play-icon-size', settings.playIconSize + 'px');
    container.style.setProperty('--play-icon-color', settings.playIconColor);
    
    // Stars
    container.style.setProperty('--stars-size', settings.starsSize + 'px');
    container.style.setProperty('--stars-color', settings.starsColor);
    
    // Author styles
    container.style.setProperty('--author-color', settings.authorColor);
    container.style.setProperty('--author-size', settings.authorSize + 'px');
    container.style.setProperty('--author-size-mobile', settings.authorSizeMobile + 'px');
    container.style.setProperty('--author-height', settings.authorHeight + '%');
    if (settings.authorCustom) {
      container.style.setProperty('--author-font-family', getFontFamily(settings.authorFont));
    }
    
    // Text styles
    container.style.setProperty('--text-color', settings.textColor);
    container.style.setProperty('--text-size', settings.textSize + 'px');
    container.style.setProperty('--text-size-mobile', settings.textSizeMobile + 'px');
    container.style.setProperty('--text-height', settings.textHeight + '%');
    container.style.setProperty('--text-mt', settings.textMt + 'px');
    if (settings.textCustom) {
      container.style.setProperty('--text-font-family', getFontFamily(settings.textFont));
    }
    
    // Arrow styles
    container.style.setProperty('--arrow-size', settings.arrowSize + 'px');
    container.style.setProperty('--arrow-size-mobile', settings.arrowSizeMobile + 'px');
    container.style.setProperty('--arrow-icon-size', settings.arrowIconSize + 'px');
    container.style.setProperty('--arrow-icon-size-mobile', settings.arrowIconSizeMobile + 'px');
    container.style.setProperty('--arrow-border-thickness', settings.arrowBorderThickness + 'px');
    container.style.setProperty('--arrow-color', settings.arrowColor);
    container.style.setProperty('--arrow-hover-color', settings.arrowHoverColor);
    container.style.setProperty('--arrow-bg-color', settings.arrowBgColor);
    container.style.setProperty('--arrow-bg-hover-color', settings.arrowBgHoverColor);
    container.style.setProperty('--arrow-border-color', settings.arrowBorderColor);
    container.style.setProperty('--arrow-border-hover-color', settings.arrowBorderHoverColor);
    
    
    // Section styles
    container.style.setProperty('--background-color', settings.backgroundColor);
    container.style.setProperty('--border-color', settings.borderColor);
    container.style.setProperty('--border-thickness', settings.borderThickness + 'px');
    container.style.setProperty('--margin-top', settings.marginTop + 'px');
    container.style.setProperty('--margin-bottom', settings.marginBottom + 'px');
    container.style.setProperty('--padding-top', settings.paddingTop + 'px');
    container.style.setProperty('--padding-bottom', settings.paddingBottom + 'px');
    container.style.setProperty('--padding-horizontal', settings.paddingHorizontal + 'rem');
    container.style.setProperty('--padding-horizontal-mobile', settings.paddingHorizontalMobile + 'rem');
  }

  function getFontFamily(fontValue) {
    // Convert Shopify font picker value to CSS font-family
    // Format is usually like "josefin_sans_n4" which needs conversion
    if (!fontValue) return 'inherit';
    // Basic conversion - replace underscores and handle common patterns
    var font = fontValue.replace(/_/g, ' ');
    return font;
  }

  function getContainerSettings(container) {
    var dataset = container.dataset;
    
    return {
      reviewsRadius: parseNumber(dataset.reviewsRadius, 0),
      reviewPaddingVertical: parseNumber(dataset.reviewPaddingVertical, 8),
      reviewPaddingHorizontal: parseNumber(dataset.reviewPaddingHorizontal, 8),
      reviewRadius: parseNumber(dataset.reviewRadius, 8),
      reviewBorderThickness: parseNumber(dataset.reviewBorderThickness, 0),
      imageWidth: parseNumber(dataset.imageWidth, 60),
      imageRadius: parseNumber(dataset.imageRadius, 8),
      imageBorderThickness: parseNumber(dataset.imageBorderThickness, 0),
      imageRatio: dataset.imageRatio || 'square',
      playIconSize: parseNumber(dataset.playIconSize, 30),
      playIconUrl: dataset.playIconUrl || '',
      playIconColor: dataset.playIconColor || '#FFFFFF',
      starsSize: parseNumber(dataset.starsSize, 14),
      starsIconUrl: dataset.starsIconUrl || '',
      starsColor: dataset.starsColor || '#000000',
      authorCustom: parseBoolean(dataset.authorCustom, false),
      authorFont: dataset.authorFont || 'josefin_sans_n4',
      authorSize: parseNumber(dataset.authorSize, 14),
      authorSizeMobile: parseNumber(dataset.authorSizeMobile, 14),
      authorHeight: parseNumber(dataset.authorHeight, 130),
      authorColor: dataset.authorColor || '#000000',
      textCustom: parseBoolean(dataset.textCustom, false),
      textFont: dataset.textFont || 'josefin_sans_n4',
      textSize: parseNumber(dataset.textSize, 12),
      textSizeMobile: parseNumber(dataset.textSizeMobile, 12),
      textHeight: parseNumber(dataset.textHeight, 130),
      textMt: parseNumber(dataset.textMt, 4),
      textColor: dataset.textColor || '#000000',
      arrowSize: parseNumber(dataset.arrowSize, 24),
      arrowSizeMobile: parseNumber(dataset.arrowSize, 24), // Use desktop value for mobile
      arrowIconSize: parseNumber(dataset.arrowIconSize, 16),
      arrowIconSizeMobile: parseNumber(dataset.arrowIconSize, 16), // Use desktop value for mobile
      arrowBorderThickness: parseNumber(dataset.arrowBorderThickness, 0),
      arrowShowDesktop: parseBoolean(dataset.arrowShowDesktop, true),
      arrowShowMobile: parseBoolean(dataset.arrowShowMobile, true),
      arrowColor: dataset.arrowColor || '#000000',
      arrowHoverColor: dataset.arrowHoverColor || '#000000',
      arrowBgColor: dataset.arrowBgColor || '#F3F3F3',
      arrowBgHoverColor: dataset.arrowBgHoverColor || '#DDDDDD',
      arrowBorderColor: dataset.arrowBorderColor || '#F3F3F3',
      arrowBorderHoverColor: dataset.arrowBorderHoverColor || '#DDDDDD',
      videoRadius: parseNumber(dataset.videoRadius, 8),
      videoBorderThickness: parseNumber(dataset.videoBorderThickness, 0),
      videoRatio: dataset.videoRatio || 'original',
      videoRatioMobile: dataset.videoRatioMobile || 'original',
      videoBorderColor: dataset.videoBorderColor || '#000000',
      reviewBgColor: dataset.reviewBgColor || '#F3F3F3',
      reviewBorderColor: dataset.reviewBorderColor || '#000000',
      imageBorderColor: dataset.imageBorderColor || '#000000',
      backgroundColor: dataset.backgroundColor || '#F3F3F3',
      backgroundGradient: dataset.backgroundGradient || '',
      borderColor: dataset.borderColor || '#000000',
      marginTop: parseNumber(dataset.marginTop, 10),
      marginBottom: parseNumber(dataset.marginBottom, 10),
      paddingTop: parseNumber(dataset.paddingTop, 0),
      paddingBottom: parseNumber(dataset.paddingBottom, 0),
      paddingHorizontal: parseNumber(dataset.paddingHorizontal, 0),
      paddingHorizontalMobile: parseNumber(dataset.paddingHorizontalMobile, 0),
      borderThickness: parseNumber(dataset.borderThickness, 0),
      lazy: true // Always lazy load
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
      text: dataset.text || 'Text'
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
