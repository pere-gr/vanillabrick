// Simple "Hello World" extension for VanillaBrick.
// Load this file after ../dist/VanillaBrick.js.

(function (VanillaBrick) {
  console.warn("Installing demo extensions");
  if (!VanillaBrick || !VanillaBrick.extensions) {
    console.error('VanillaBrick is not loaded. Include ../dist/VanillaBrick.js before demo.js');
    return;
  }

  /**
   * Demo extension that logs lifecycle hooks and echoes demo events.
   * @type {object}
   */
  VanillaBrick.extensions.demoHelloWorld = {
    _name: 'demoHelloWorld',

    /**
     * Optional init hook that runs for every brick when the extension is attached.
     * @param {object} ext - Reference to the VanillaBrick extension configuration.
     * @returns {void}
     */
    init: function (brick,ext) {
      if(this.kind != "demo") return false;
      console.log('[demoHelloWorld] init per brick', this.id, 'de tipus', this.kind);
      // Es pot retornar false per saltar la instal-lacio
      return true;
    },

    // Listener d'exemple: respon als events "brick:ready:*"
    _listeners: [
      {
        for: 'brick:ready:*',
        handlers: [
          { phase: 'on', fn: 'onReady' }
        ]
      },
      {
        for: 'demo:say:*',
        handlers: [
          { phase: 'on', fn: 'say' }
        ]
      },
    ],

    /**
     * Handles "brick:ready:*" events and triggers demo:say:hello.
     * @param {object} ext - Extension configuration reference.
     * @param {VanillaBrickEvent} ev - Event object received by this brick.
     * @returns {void}
     */
    onReady: function (ext, ev) {
      console.log("event handler", ext, ev);
      console.log('[demoHelloWorld] brick ready:', this.id, ev);
      this.events.fire("demo:say:hello", { say: "Hello" });
    },

    /**
     * Responds to demo:say events and forwards a goodbye message when appropriate.
     * @param {object} ext - Extension configuration reference.
     * @param {VanillaBrickEvent} ev - Event object received by this brick.
     * @returns {void}
     */
    say: function (ext, ev) {
      console.log('[sayHello] ', ev.data.say, ev);
      if (ev.name == "demo:say:hello") this.events.fire("demo:say:goodbye", { say: "Bye, Bye..." });
    }
  };

  VanillaBrick.extensions.demoDom = {
    _name: 'demoDom',
    _for: '*',
    //_requires: ['dom'],
    init: function (ext) {
      if (this.kind !== "demo-dom") return false;
      return true;
    },

    _listeners: [
      { for: 'dom:*:*', handlers: [{ phase: 'before', fn: 'logBeforeDomEvent' }] },
      { for: 'dom:click:*', handlers: [{ phase: 'on', fn: 'logDomEvent' }] },
      //{ for: 'dom:hover:on', handlers: [{ phase: 'on', fn: 'logDomEvent' }] },
      { for: 'dom:hover:off', handlers: [{ phase: 'on', fn: 'logDomEvent' }] },
      //{ for: 'dom:mouse:down', handlers: [{ phase: 'on', fn: 'logDomEvent' }] },
      { for: 'dom:mouse:up', handlers: [{ phase: 'on', fn: 'logDomEvent' }] },
      { for: 'dom:*:*', handlers: [{ phase: 'after', fn: 'logAfterDomEvent' }] },
      
    ],
    logBeforeDomEvent: function (ext, ev) {
      console.log('[demoDom] > before >', ev.name, ev);
      this.css.setStyle("border","1px solid red");
    },
    logDomEvent: function (ext, ev) {
      console.log('[demoDom] > on >', ev.name, ev);
      this.css.toggleClass("demo");
    },
    logAfterDomEvent: function (ext, ev) {
      console.log('[demoDom] > before >', ev.name, ev);
      this.css.setStyle("border","1px dashed #888");
    },
  };
})(window.VanillaBrick);

