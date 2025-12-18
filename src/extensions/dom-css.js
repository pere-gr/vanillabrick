export const domCss = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['dom'],
  ns: 'css',
  options: {},

  brick: {
    addClass: function (className) {
      const el = this.dom.element();
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
    removeClass: function (className) {
      const el = this.dom.element();
      if (!el || !className) return;
      if (el.classList && el.classList.remove) {
        el.classList.remove(className);
      } else {
        const cur = el.className || '';
        el.className = (' ' + cur + ' ').replace(' ' + className + ' ', ' ').trim();
      }
    },
    hasClass: function (className) {
      const el = this.dom.element();
      if (!el || !className) return false;
      if (el.classList && el.classList.contains) return el.classList.contains(className);
      const cur = el.className || '';
      return (' ' + cur + ' ').indexOf(' ' + className + ' ') !== -1;
    },
    toggleClass: function (className, force) {
      const el = this.dom.element();
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
    show: function () {
      const el = this.dom.element();
      if (!el) return;
      el.style.display = '';
    },
    hide: function () {
      const el = this.dom.element();
      if (!el) return;
      el.style.display = 'none';
    },
    setStyle: function (prop, value) {
      const el = this.dom.element();
      if (!el || !prop) return;
      el.style[prop] = value;
    },
    getStyle: function (prop) {
      const el = this.dom.element();
      if (!el || !prop || typeof window === 'undefined' || !window.getComputedStyle) return null;
      const cs = window.getComputedStyle(el);
      return cs ? (cs.getPropertyValue(prop) || cs[prop]) : null;
    },
    setVar: function (name, value) {
      const el = this.dom.element();
      if (!el || !name) return;
      if (name.indexOf('--') !== 0) name = '--' + name;
      el.style.setProperty(name, value);
    },
    getVar: function (name) {
      const el = this.dom.element();
      if (!el || !name || typeof window === 'undefined' || !window.getComputedStyle) return null;
      if (name.indexOf('--') !== 0) name = '--' + name;
      const cs = window.getComputedStyle(el);
      return cs ? cs.getPropertyValue(name) : null;
    }
  },

  extension: {},
  events: [],

  init: function () {
    if (!this.brick || !this.brick.dom || typeof this.brick.dom.element !== 'function') {
      console.warn('VanillaBrick domCss requires dom extension active', this.brick && this.brick.id);
      return false;
    }
    const el = this.brick.dom.element();
    if (!el) {
      console.warn('VanillaBrick domCss: no DOM element resolved', this.brick && this.brick.id);
      return false;
    }
    return true;
  },

  destroy: function () { }
};


export default domCss;

