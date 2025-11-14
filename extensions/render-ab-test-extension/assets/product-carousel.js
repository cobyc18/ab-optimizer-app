// Product Carousel Widget JavaScript
(function() {
  'use strict';

  function init() {
    const containers = document.querySelectorAll('.product-carousel-widget');
    containers.forEach(function(container) {
      renderCarousel(container);
      initCarousel(container);
    });
  }

  function renderCarousel(container) {
    const settings = getSettings(container);
    const carouselId = container.dataset.carouselId;
    
    // Get products from JSON script tag
    const productsScript = container.querySelector('[data-products-json]');
    let products = [];
    
    if (productsScript) {
      try {
        products = JSON.parse(productsScript.textContent);
      } catch (error) {
        console.error('Error parsing products JSON:', error);
      }
    }
    
    if (products.length === 0) {
      container.innerHTML = '<div class="carousel-empty">No products selected</div>';
      return;
    }
    
    renderProducts(container, products, settings);
    initCarousel(container);
  }

  function renderProducts(container, products, settings) {
    const carouselId = container.dataset.carouselId;
    
    let slidesHtml = '';
    let paginationHtml = '';
    
    products.forEach(function(product, index) {
      const featuredImage = product.featured_image || '';
      const imageUrl = featuredImage ? featuredImage : '';
      const variants = product.variants || [];
      const availableVariant = variants.find(function(v) { return v.available; }) || variants[0];
      
      // Price calculation (prices are in cents)
      const price = availableVariant ? (availableVariant.price / 100).toFixed(2) : (product.price / 100).toFixed(2);
      const comparePrice = (availableVariant && availableVariant.compare_at_price) ? (availableVariant.compare_at_price / 100).toFixed(2) : (product.compare_at_price && product.compare_at_price > product.price ? (product.compare_at_price / 100).toFixed(2) : null);
      const discountPercent = comparePrice ? Math.round(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100) : 0;
      
      slidesHtml += `
        <div class="carousel-slide">
          <div class="product-card">
            ${imageUrl ? `<img src="${imageUrl}" alt="${product.title}" class="product-image" loading="lazy">` : ''}
            <div class="product-info">
              <div class="product-header">
                <h4 class="product-title">${product.title}</h4>
              </div>
              <div class="product-content">
                ${variants.length > 1 ? `
                  <div class="product-options">
                    ${variants.slice(0, 2).map(function(variant) {
                      return `<button class="variant-option" data-variant-id="${variant.id}">${variant.title}</button>`;
                    }).join('')}
                  </div>
                ` : ''}
              </div>
              <div class="product-footer">
                <div class="product-price">
                  ${comparePrice ? `
                    <span class="price-original">$${comparePrice}</span>
                    <span class="price-sale">$${price}</span>
                    <span class="sale-badge">${discountPercent}% OFF</span>
                  ` : `
                    <span class="price-regular">$${price}</span>
                  `}
                </div>
                ${availableVariant && availableVariant.available ? `
                  <button class="add-to-cart-btn${index > 3 ? ' plus' : ''}" 
                          data-product-id="${product.id}"
                          data-variant-id="${availableVariant.id}"
                          data-variant-title="${availableVariant.title}"
                          data-product-title="${product.title}">
                    ${index > 3 ? '+ ' : ''}Add
                  </button>
                ` : `
                  <button class="add-to-cart-btn disabled" disabled>Sold Out</button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
      
      if (settings.showPagination) {
        paginationHtml += `<button class="pagination-dot" data-slide="${index}"></button>`;
      }
    });
    
    const html = `
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
          ${slidesHtml}
        </div>
      </div>
      ${settings.showPagination ? `
        <div class="carousel-pagination" data-carousel-pagination>
          ${paginationHtml}
        </div>
      ` : ''}
    `;
    
    container.innerHTML = html;
  }

  function initCarousel(container) {
    const carousel = container.querySelector('.product-carousel-widget') || container;
    const track = carousel.querySelector('[data-carousel-track]');
    if (!track) return;
    
    const slides = carousel.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    
    const prevBtn = carousel.querySelector('.nav-prev');
    const nextBtn = carousel.querySelector('.nav-next');
    const dots = carousel.querySelectorAll('.pagination-dot');
    
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

  function getSettings(container) {
    const dataset = container.dataset;
    return {
      carouselTitle: dataset.carouselTitle || 'You may also like',
      showNavigation: dataset.showNavigation !== 'false',
      showPagination: dataset.showPagination !== 'false'
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

