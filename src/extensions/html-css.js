export const htmlCss = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['html'],
  ns: 'css',
  options: {},

  brick: {
    addClass: function (el, className) {
      if (!el || !className) return;
      if (el.classList && el.classList.add) {
        el.classList.add(className);
      } else {
        const cur = el.className || '';
        if ((' ' + cur + ' ').indexOf(' ' + className + ' ') === -1) {
          el.className = (cur ? cur + ' ' : '') + className;
        }
      }
    },
    removeClass: function (el,className) {
      if (!el || !className) return;
      if (el.classList && el.classList.remove) {
        el.classList.remove(className);
      } else {
        const cur = el.className || '';
        el.className = (' ' + cur + ' ').replace(' ' + className + ' ', ' ').trim();
      }
    },
    hasClass: function (el,className) {
      if (!el || !className) return false;
      if (el.classList && el.classList.contains) return el.classList.contains(className);
      const cur = el.className || '';
      return (' ' + cur + ' ').indexOf(' ' + className + ' ') !== -1;
    },
    toggleClass: function (el, className, force) {
      if (!el || !className) return;
      if (el.classList && typeof el.classList.toggle === 'function') {
        if (typeof force === 'boolean') el.classList.toggle(className, force);
        else el.classList.toggle(className);
      } else {
        const has = this.css.hasClass(className);
        if (typeof force === 'boolean') {
          if (force && !has) this.css.addClass(className);
          if (!force && has) this.css.removeClass(className);
        } else {
          if (has) this.css.removeClass(className);
          else this.css.addClass(className);
        }
      }
    },
    show: function (el) {
      if (!el) return;
      el.style.display = '';
    },
    hide: function (el) {
      if (!el) return;
      el.style.display = 'none';
    },
    setStyle: function (el,prop, value) {
      if (!el || !prop) return;
      el.style[prop] = value;
    },
    getStyle: function (el,prop) {
      if (!el || !prop || typeof window === 'undefined' || !window.getComputedStyle) return null;
      const cs = window.getComputedStyle(el);
      return cs ? (cs.getPropertyValue(prop) || cs[prop]) : null;
    },
    setVar: function (el, name, value) {
      if (!el || !name) return;
      if (name.indexOf('--') !== 0) name = '--' + name;
      el.style.setProperty(name, value);
    },
    getVar: function (el, name) {
      if (!el || !name || typeof window === 'undefined' || !window.getComputedStyle) return null;
      if (name.indexOf('--') !== 0) name = '--' + name;
      const cs = window.getComputedStyle(el);
      return cs ? cs.getPropertyValue(name) : null;
    }
  },

  extension: {},
  events: [],

  init: function () {
    if (!this.brick || !this.brick.html || typeof this.brick.html.element !== 'function') {
      console.warn('VanillaBrick htmlCss requires html extension active', this.brick && this.brick.id);
      return false;
    }
    const el = this.brick.html.element();
    if (!el) {
      console.warn('VanillaBrick htmlCss: no DOM element resolved', this.brick && this.brick.id);
      return false;
    }
    return true;
  },

  destroy: function () { }
};


export default htmlCss;

