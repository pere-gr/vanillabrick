/**
 * Runtime controller - wraps all developer code execution from extensions.
 * Provides centralized error handling and metadata capture for debugging.
 * @constructor
 * @param {Object} brick - The brick instance this controller belongs to
 */
function RuntimeController(brick) {
    this.brick = brick || null;
}

/**
 * Execute developer code with error handling and metadata capture.
 * 
 * @param {Function} fn - The function to execute
 * @param {Object} context - The 'this' context for the function
 * @param {Array} args - Arguments to pass to the function
 * @param {Object} meta - Metadata for debugging
 *   - type: 'event' | 'init' | 'destroy' | 'brick-api' | 'extension-private'
 *   - ext: extension name
 *   - brick: brick.id (optional)
 *   - event: event name (optional, for event handlers)
 *   - phase: event phase (optional, for event handlers)
 *   - fnName: function name (optional)
 * @returns {*} The result of the function execution
 */
RuntimeController.prototype.execute = function (fn, context, args, meta) {
    "use strict";
    if (typeof fn !== 'function') {
        console.warn('[RuntimeController] Attempted to execute non-function', meta);
        return undefined;
    }

    try {
        const result = fn.apply(context, args);

        // Support async functions
        if (result && typeof result.then === 'function') {
            return result.catch(function (err) {
                this._handleError(err, fn, context, meta);
                return Promise.reject(err);
            }.bind(this));
        }

        return result;
    } catch (err) {
        this._handleError(err, fn, context, meta);
        throw err;
    }
};

/**
 * Handle errors from developer code execution.
 * Logs detailed information including source code for debugging.
 * 
 * @param {Error} err - The error that occurred
 * @param {Function} fn - The function that threw the error
 * @param {Object} context - The context the function was executed in
 * @param {Object} meta - Metadata about the execution
 * @private
 */
RuntimeController.prototype._handleError = function (err, fn, context, meta) {
    var brickCtx = (context && context.brick) ? context.brick : context;
    const errorInfo = {
        error: err,
        message: err.message || String(err),
        stack: err.stack,
        meta: meta || {},
        context: {
            brick: brickCtx && brickCtx.id ? brickCtx.id : null,
            kind: brickCtx && brickCtx.kind ? brickCtx.kind : null
        }
    };

    // Try to capture function source for debugging
    try {
        errorInfo.fnSource = fn.toString();
    } catch (e) {
        errorInfo.fnSource = '[unable to capture source]';
    }

    console.error('[RuntimeController] Error executing developer code:', errorInfo);

    // Future: delegate to errorController
    // if (this.errorController && typeof this.errorController.handle === 'function') {
    //   this.errorController.handle(errorInfo);
    // }
};

/**
 * Wrap a function with runtime execution protection.
 * Returns a new function that will execute through the runtime controller.
 * 
 * @param {Function} fn - The function to wrap
 * @param {Object} context - The 'this' context for the function
 * @param {Object} meta - Metadata for debugging
 * @returns {Function} Wrapped function
 */
RuntimeController.prototype.wrap = function (fn, context, meta) {
    if (typeof fn !== 'function') {
        return fn;
    }

    const runtime = this;
    return function wrappedFunction() {
        const args = Array.prototype.slice.call(arguments);
        return runtime.execute(fn, context, args, meta);
    };
};

// Expose constructor for per-brick instantiation
VanillaBrick.controllers = VanillaBrick.controllers || {};
VanillaBrick.controllers.runtime = RuntimeController;
