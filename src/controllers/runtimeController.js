/**
 * Runtime controller (Global Singleton)
 * Wraps all developer code execution from extensions.
 * Provides centralized error handling and metadata capture for debugging.
 * @constructor
 */
export default function RuntimeController() {
    // No per-brick state
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
 */
RuntimeController.prototype.execute = function (fn, context, args, meta) {
    "use strict";
    if (typeof fn !== 'function') {
        const brickId = (meta && meta.brick) || (context && context.brick && context.brick.id) || 'unknown';
        console.warn(`[RuntimeController] Attempted to execute non-function for brick ${brickId}`, meta);
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
 */
RuntimeController.prototype._handleError = function (err, fn, context, meta) {
    var brickCtx = (context && context.brick) ? context.brick : context;
    // If context is weird, try to get brick from meta or fallback
    if (!brickCtx || !brickCtx.id) {
        if (meta && meta.brick) {
            brickCtx = { id: meta.brick };
        }
    }

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
};
