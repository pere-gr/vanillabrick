import Brick from './brick/brick.js';
import ExtensionsRegistry from './controllers/extensionsRegistry.js';
import * as optionsUtils from './utils/options.js';

// Startup Logic
import { setupServices } from './startup/services.js';
import { setupBootstrap } from './startup/bootstrap.js';

// Auto-generated manifest (at build time)
import { registerBuiltins } from './_manifest.js';

const VanillaBrick = {
    brick: Brick,
    registry: ExtensionsRegistry,
    utils: optionsUtils,
    extensions: {},
    services: {},
    configs: {},
    runtime: {
        bricks: [],
        services: {}
    },
    base: {}
};

// 1. Expose to global for extensions to find it if needed
globalThis.VanillaBrick = VanillaBrick;

// 2. Register all extensions, components and services from manifest
registerBuiltins(VanillaBrick);

// 3. Wire up core systems
setupServices(VanillaBrick);
setupBootstrap(VanillaBrick);

export default VanillaBrick;
export { Brick };
