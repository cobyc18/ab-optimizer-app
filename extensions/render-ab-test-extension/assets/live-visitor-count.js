document.addEventListener('DOMContentLoaded', function() {
  const widgets = document.querySelectorAll('[data-widget-id^="visitor-"]');
  
  widgets.forEach(function(widget) {
    const countElement = widget.querySelector('.visitor-count');
    if (!countElement) return;
    
    // Get settings from data attributes (data-min-count becomes dataset.minCount)
    const minCount = parseInt(widget.dataset.minCount || countElement.dataset.count) || 40;
    const maxCount = parseInt(widget.dataset.maxCount) || 60;
    
    // Ensure min is less than max
    const validMin = Math.min(minCount, maxCount);
    const validMax = Math.max(minCount, maxCount);
    
    // Initialize count within range
    let currentCount = Math.max(validMin, Math.min(validMax, parseInt(countElement.dataset.count) || validMin));
    countElement.textContent = currentCount;
    countElement.dataset.count = currentCount;
    
    // Update visitor count within range
    function updateVisitorCount() {
      // Generate a random change between -2 and +2
      const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
      let newCount = currentCount + change;
      
      // Clamp to valid range
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
    
    // Update every 8-15 seconds
    function scheduleNextUpdate() {
      const delay = Math.random() * 7000 + 8000; // 8-15 seconds
      setTimeout(function() {
        updateVisitorCount();
        scheduleNextUpdate();
      }, delay);
    }
    
    // Start the live updates
    scheduleNextUpdate();
  });
});

