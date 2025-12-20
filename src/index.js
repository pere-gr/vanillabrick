import Brick from './brick/brick.js';
import ExtensionsRegistry from './controllers/extensionsRegistry.js';
import RuntimeController from './controllers/runtimeController.js';
import StatusController from './controllers/statusController.js';
import OptionsController from './controllers/optionsController.js';
import EventBusController from './controllers/eventsController.js';
import ExtensionsController from './controllers/extensionsController.js';
import * as optionsUtils from './utils/options.js';

// Startup Logic
import { setupServices } from './startup/services.js';
import { setupBootstrap } from './startup/bootstrap.js';

// Auto-generated manifest (at build time)
import { registerBuiltins } from './_manifest.js';

const runtimeCtrl = new RuntimeController();

const VanillaBrick = {
    brick: Brick,
    registry: ExtensionsRegistry,
    utils: optionsUtils,
    extensions: {},
    services: {},
    configs: {},
    runtime: runtimeCtrl, // Global execution motor
    base: {}
};

// Internal reference for tracking
VanillaBrick.runtime.bricks = [];
VanillaBrick.runtime.services = {};
VanillaBrick.runtime.prototypes = {};
VanillaBrick.runtime.controllers = {
    status: new StatusController(),
    options: new OptionsController(),
    events: new EventBusController(),
    extensions: new ExtensionsController()
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
