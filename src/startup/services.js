export function setupServices(VanillaBrick) {
    // Ensure runtime services registry
    VanillaBrick.runtime.services = VanillaBrick.runtime.services || {};

    // Public accessor
    VanillaBrick.service = function (name) {
        // Check if running
        if (VanillaBrick.runtime.services[name]) {
            return VanillaBrick.runtime.services[name];
        }
        // Try to start
        return VanillaBrick.base.serviceStart(name);
    };

    // Internal helpers in base
    VanillaBrick.base.serviceStart = function (name) {
        if (VanillaBrick.runtime.services[name]) {
            return VanillaBrick.runtime.services[name];
        }

        const def = VanillaBrick.services[name];
        if (!def) {
            console.warn("Service definition not found:", name);
            return null;
        }

        const opts = Object.assign({}, def);
        opts.id = name; // Service name as ID
        opts.host = 'service';
        opts.kind = opts.kind || 'service';

        // Create brick instance
        const brick = new VanillaBrick.brick(opts);

        // Register instance
        VanillaBrick.runtime.services[name] = brick;

        if (VanillaBrick.runtime.bricks && Array.isArray(VanillaBrick.runtime.bricks)) {
            VanillaBrick.runtime.bricks.push(brick);
        }

        return brick;
    };

    VanillaBrick.base.serviceStop = function (name) {
        const service = VanillaBrick.runtime.services[name];
        if (!service) return;

        if (service.destroy) service.destroy();

        delete VanillaBrick.runtime.services[name];
    };
}
