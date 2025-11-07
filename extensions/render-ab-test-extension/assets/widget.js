// Unified Widget JavaScript - Handles multiple widget types
(function() {
  'use strict';

  // Widget Registry
  const WidgetRegistry = {
    'live-visitor-count': {
      render: renderLiveVisitorCount,
      init: initLiveVisitorCount
    },
    'product-carousel': {
      render: renderProductCarousel,
      init: initProductCarousel
    }
  };

  // Initialize all widgets when DOM is ready
  function init() {
    const containers = document.querySelectorAll('.app-widget-container');
    containers.forEach(function(container) {
      const widgetType = container.dataset.widgetType || 'live-visitor-count';
      const widgetHandler = WidgetRegistry[widgetType];
      
      if (widgetHandler) {
        widgetHandler.render(container);
        if (widgetHandler.init) {
          widgetHandler.init(container);
        }
      }
    });
  }

  // Live Visitor Count Widget
  function renderLiveVisitorCount(container) {
    const settings = getSettings(container);
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

  function initLiveVisitorCount(container) {
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

  // Product Carousel Widget
  function renderProductCarousel(container) {
    // Product carousel HTML is already rendered server-side in Liquid
    // Just check if it exists, if not, render placeholder
    const existingCarousel = container.querySelector('.product-carousel-widget');
    if (!existingCarousel) {
      const settings = getSettings(container);
      const widgetId = container.dataset.widgetId;
      
      const html = `
        <div class="product-carousel-widget" data-carousel-id="${widgetId}">
          <div class="carousel-header">
            <h3 class="carousel-title">${settings.carouselTitle}</h3>
            ${settings.showNavigation ? `
              <div class="carousel-navigation">
                <button class="nav-arrow nav-prev" data-direction="prev">‹</button>
                <button class="nav-arrow nav-next" data-direction="next">›</button>
              </div>
            ` : ''}
          </div>
          <div class="carousel-container">
            <div class="carousel-track" data-carousel-track>
              <!-- No products selected -->
            </div>
          </div>
          ${settings.showPagination ? `
            <div class="carousel-pagination" data-carousel-pagination>
            </div>
          ` : ''}
        </div>
      `;
      container.innerHTML = html;
    }
  }

  function initProductCarousel(container) {
    const carousel = container.querySelector('.product-carousel-widget');
    if (!carousel) return;
    
    const track = carousel.querySelector('[data-carousel-track]');
    const slides = carousel.querySelectorAll('.carousel-slide');
    const prevBtn = carousel.querySelector('.nav-prev');
    const nextBtn = carousel.querySelector('.nav-next');
    const dots = carousel.querySelectorAll('.pagination-dot');
    
    if (slides.length === 0) return;
    
    let currentSlide = 0;
    const maxSlide = Math.max(0, slides.length - 1);
    
    function updateCarousel() {
      const translateX = -currentSlide * 100;
      track.style.transform = `translateX(${translateX}%)`;
      
      dots.forEach(function(dot, index) {
        dot.classList.toggle('active', index === currentSlide);
      });
    }
    
    function nextSlide() {
      currentSlide = Math.min(currentSlide + 1, maxSlide);
      updateCarousel();
    }
    
    function prevSlide() {
      currentSlide = Math.max(currentSlide - 1, 0);
      updateCarousel();
    }
    
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    
    dots.forEach(function(dot, index) {
      dot.addEventListener('click', function() {
        currentSlide = index;
        updateCarousel();
      });
    });
    
    // Add to cart functionality
    carousel.addEventListener('click', function(e) {
      if (e.target.classList.contains('add-to-cart-btn') && !e.target.disabled) {
        handleAddToCart(e.target);
      }
    });
    
    updateCarousel();
  }


  function handleAddToCart(button) {
    const variantId = button.dataset.variantId;
    const variantTitle = button.dataset.variantTitle;
    const productTitle = button.dataset.productTitle;
    
    if (!variantId || variantId === 'undefined') {
      console.error('Invalid variant ID:', variantId);
      alert('This product variant is not available.');
      return;
    }
    
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Adding...';
    
    const formData = new FormData();
    formData.append('id', variantId);
    formData.append('quantity', '1');
    
    fetch('/cart/add.js', {
      method: 'POST',
      body: formData
    })
    .then(function(response) {
      if (!response.ok) {
        return response.text().then(function(text) {
          throw new Error('HTTP ' + response.status + ': ' + text);
        });
      }
      return response.json();
    })
    .then(function(data) {
      button.textContent = 'Added!';
      button.style.background = '#10b981';
      
      setTimeout(function() {
        button.textContent = originalText;
        button.style.background = '';
        button.disabled = false;
      }, 1500);
      
      document.dispatchEvent(new CustomEvent('cart:updated'));
      document.dispatchEvent(new CustomEvent('cart:refresh'));
    })
    .catch(function(error) {
      console.error('Error adding to cart:', error);
      button.textContent = originalText;
      button.disabled = false;
      alert('Sorry, this product could not be added to your cart.');
    });
  }

  // Helper function to get settings from data attributes
  function getSettings(container) {
    const dataset = container.dataset;
    return {
      // Live Visitor Count
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
      mobileAlignment: dataset.mobileAlignment || 'left',
      // Product Carousel
      carouselTitle: dataset.carouselTitle || 'You may also like',
      showNavigation: dataset.showNavigation !== 'false',
      showPagination: dataset.showPagination !== 'false',
      products: dataset.products ? dataset.products.split(',').filter(Boolean) : []
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

