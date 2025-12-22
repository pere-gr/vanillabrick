export const htmlRender = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['html'],
  ns: 'html',
  options: {},

  brick: {
    attr: function (el, key, value) {
      if (!el) return el;

      // Permet passar objecte: attr(el, { id:"x", title:"y" })
      if (key && typeof key === "object") {
        for (const k in key) attr(el, k, key[k]);
        return el;
      }

      if (value === undefined || value === null || value === false) {
        el.removeAttribute(key);
        return el;
      }

      // boolean attribute (checked, disabled, readonly, etc.)
      if (value === true) {
        el.setAttribute(key, "");
        return el;
      }

      el.setAttribute(key, String(value));
      return el;
    },
    // Safe getters/creators
    get: function (selectorOrTag, root) {
      if (!selectorOrTag) return null;
      if (root == null){
        root = this.html && typeof this.html.element === 'function' ? this.html.element() : null;
      }
      if (!root || !root.querySelector) return null;
      // If it's a tag name and root matches, return root
      if (selectorOrTag.toLowerCase && root.tagName && selectorOrTag.toLowerCase() === root.tagName.toLowerCase()) {
        return root;
      }
      return root.querySelector(selectorOrTag) || null;
    },
    create: function (tag, props) {
      if (!tag || typeof document === 'undefined') return null;
      const el = document.createElement(tag);
      const cfg = props || {};
      if (cfg.text !== undefined && cfg.text !== null) {
        el.textContent = cfg.text;
      }
      if (cfg.html !== undefined && cfg.html !== null && this.html && typeof this.html.sanitize === 'function') {
        el.innerHTML = this.html.sanitize(String(cfg.html));
      }
      if (cfg.attrs && typeof cfg.attrs === 'object') {
        for (const k in cfg.attrs) {
          if (Object.prototype.hasOwnProperty.call(cfg.attrs, k) && cfg.attrs[k] !== undefined) {
            el.setAttribute(k, cfg.attrs[k]);
          }
        }
      }
      if (cfg.classList && Array.isArray(cfg.classList)) {
        el.classList.add.apply(el.classList, cfg.classList);
      }
      if (cfg.dataset && typeof cfg.dataset === 'object') {
        for (const k in cfg.dataset) {
          if (Object.prototype.hasOwnProperty.call(cfg.dataset, k) && cfg.dataset[k] !== undefined) {
            el.dataset[k] = cfg.dataset[k];
          }
        }
      }
      return el;
    },
    frag: function () {
      return (typeof document !== 'undefined' && document.createDocumentFragment) ? document.createDocumentFragment() : null;
    },
    append: function (target, nodeOrFrag) {
      if (!target || !nodeOrFrag || !target.appendChild) return;
      target.appendChild(nodeOrFrag);
    },
    prepend: function (target, nodeOrFrag) {
      if (!target || !nodeOrFrag || !target.insertBefore) return;
      if (!target.firstChild) {
        target.appendChild(nodeOrFrag);
      } else {
        target.insertBefore(nodeOrFrag, target.firstChild);
      }
    },
    replace: function (target, nodeOrFrag) {
      if (!target || !target.replaceChildren) return;
      target.replaceChildren(nodeOrFrag);
    },
    clear: function (target) {
      if (!target || !target.replaceChildren) return;
      target.replaceChildren();
    },
    detach: function (el) {
      if (!el) return el || null;
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
      return el;
    },
    setSafe: function (el, htmlString) {
      if (!el) return;
      if (!htmlString) {
        el.innerHTML = '';
        return;
      }
      if (this.html && typeof this.html.sanitize === 'function') {
        el.innerHTML = this.html.sanitize(String(htmlString));
      } else {
        el.textContent = String(htmlString);
      }
    },
    sanitize: function (htmlString) {
      if (!htmlString) return '';
      // Simple sanitizer: strip scripts/inline handlers/javascript: URLs
      if (typeof DOMParser === 'undefined') {
        return String(htmlString).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(htmlString), 'text/html');
      const scripts = doc.querySelectorAll('script, style, iframe, object, embed');
      scripts.forEach(function (node) { if (node && node.parentNode) node.parentNode.removeChild(node); });
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        // Remove inline event handlers
        const attrs = Array.prototype.slice.call(node.attributes || []);
        for (let i = 0; i < attrs.length; i++) {
          const a = attrs[i];
          const name = a.name.toLowerCase();
          const val = a.value || '';
          if (name.startsWith('on')) {
            node.removeAttribute(a.name);
            continue;
          }
          if ((name === 'href' || name === 'src') && /^javascript:/i.test(val)) {
            node.removeAttribute(a.name);
          }
        }
      }
      return doc.body.innerHTML || '';
    },
    // Render helpers
    queueRender: function (fn) {
      if (typeof fn !== 'function') return;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(fn);
      } else {
        setTimeout(fn, 0);
      }
    },
    batch: function (items, chunkSize, renderChunk) {
      const arr = Array.isArray(items) ? items : [];
      const size = typeof chunkSize === 'number' && chunkSize > 0 ? chunkSize : 100;
      const render = typeof renderChunk === 'function' ? renderChunk : null;
      if (!render) return Promise.resolve();
      let index = 0;
      return new Promise((resolve) => {
        const step = () => {
          const slice = arr.slice(index, index + size);
          if (slice.length) {
            render(slice, index);
            index += size;
            this.queueRender(step.bind(this));
          } else {
            resolve();
          }
        };
        step();
      });
    }
  },

  extension: {},
  events: [],
  init: function () { return true; },
  destroy: function () { }
};

export default htmlRender;
