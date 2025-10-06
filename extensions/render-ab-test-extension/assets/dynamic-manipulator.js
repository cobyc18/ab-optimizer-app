// A/B Dynamic Manipulator - Ultra Compact
class ABDynamicManipulator {
  constructor(blockId) {
    this.blockId = blockId;
    this.controls = {};
    this.defaults = { layout: 'grid', primary: '#3b82f6', secondary: '#f3f4f6', font: 16, animation: 'none' };
    this.init();
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.apply();
  }

  cacheElements() {
    const id = this.blockId;
    this.controls = {
      layout: document.getElementById(`ab-layout-${id}`),
      primary: document.getElementById(`ab-primary-${id}`),
      secondary: document.getElementById(`ab-secondary-${id}`),
      font: document.getElementById(`ab-font-${id}`),
      animation: document.getElementById(`ab-animation-${id}`),
      toggle: document.getElementById(`toggle-ab-${id}`),
      reset: document.getElementById(`ab-reset-${id}`),
      apply: document.getElementById(`ab-apply-${id}`),
      controls: document.getElementById(`ab-controls-${id}`)
    };
    this.styles = document.getElementById(`ab-styles-${id}`);
    this.productPage = document.querySelector('.product') || document.querySelector('[data-product]');
  }

  bindEvents() {
    Object.values(this.controls).forEach(c => c?.addEventListener('input', () => this.update()));
    Object.values(this.controls).forEach(c => c?.addEventListener('change', () => this.update()));
    this.controls.toggle?.addEventListener('click', () => this.toggle());
    this.controls.reset?.addEventListener('click', () => this.reset());
    this.controls.apply?.addEventListener('click', () => this.apply());
  }

  update() {
    if (!this.styles || !this.productPage) return;
    const l = this.controls.layout?.value || 'grid';
    const p = this.controls.primary?.value || '#3b82f6';
    const s = this.controls.secondary?.value || '#f3f4f6';
    const f = this.controls.font?.value || 16;
    const a = this.controls.animation?.value || 'none';
    this.productPage.className = this.productPage.className.replace(/ab-\w+/g, '');
    this.productPage.classList.add(`ab-${l}`);
    if (a !== 'none') this.productPage.classList.add(`ab-${a}`);
    this.styles.textContent = `.product{font-size:${f}px;transition:all 0.3s}.product.ab-grid{display:grid;grid-template-columns:1fr 1fr;gap:2rem}.product.ab-stack{display:flex;flex-direction:column;gap:1.5rem}.product.ab-side{display:flex;gap:2rem;align-items:center}.product.ab-center{display:flex;flex-direction:column;align-items:center;text-align:center}.product .product-title,.product h1{color:${p}}.product .product-price,.product .price{color:${p}}.product button,.product .btn{background-color:${p};border-color:${p}}.product .product-info,.product .product-details{background-color:${s};padding:1rem;border-radius:8px}.product.ab-fade{animation:abFade 0.5s}.product.ab-slide{animation:abSlide 0.5s}.product.ab-bounce{animation:abBounce 0.6s}@keyframes abFade{from{opacity:0}to{opacity:1}}@keyframes abSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes abBounce{0%,20%,53%,80%,100%{transform:translate3d(0,0,0)}40%,43%{transform:translate3d(0,-8px,0)}70%{transform:translate3d(0,-4px,0)}90%{transform:translate3d(0,-2px,0)}}@media (max-width:768px){.product.ab-grid,.product.ab-side{grid-template-columns:1fr;flex-direction:column}}`;
  }

  apply() {
    this.update();
    this.showFeedback('Applied!', 'success');
  }

  reset() {
    Object.keys(this.defaults).forEach(k => {
      if (this.controls[k]) this.controls[k].value = this.defaults[k];
    });
    this.apply();
    this.showFeedback('Reset!', 'info');
  }

  toggle() {
    const c = this.controls.controls.style.display === 'none';
    this.controls.controls.style.display = c ? 'block' : 'none';
    this.controls.toggle.textContent = c ? '➖' : '➕';
  }

  showFeedback(m, t) {
    const f = document.createElement('div');
    f.style.cssText = `position:fixed;top:80px;right:20px;padding:8px 16px;border-radius:4px;color:white;font-size:12px;z-index:10000;background:${t==='success'?'#10b981':'#3b82f6'}`;
    f.textContent = m;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 2000);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[id^="ab-dynamic-manipulator-"]').forEach(block => {
    new ABDynamicManipulator(block.id.replace('ab-dynamic-manipulator-', ''));
  });
});
