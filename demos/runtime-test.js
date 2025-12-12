// Runtime Controller Test Extension
// This extension intentionally throws errors to test the runtime controller

(function (VanillaBrick) {
    console.log('[RuntimeTest] Installing test extension with intentional errors');

    if (!VanillaBrick || !VanillaBrick.extensions) {
        console.error('VanillaBrick is not loaded');
        return;
    }

    /**
     * Test extension that throws errors in different lifecycle points
     */
    VanillaBrick.extensions.runtimeTest = {
        ns: 'runtimeTest',
        for: ['grid'],
        requires: ['dom', 'store'],

        brick: {
            // This method will throw an error when called
            triggerError: function () {
                console.log('[RuntimeTest] triggerError() called - about to throw error');
                throw new Error('Intentional error from brick API method');
            },

            // This method works fine
            workingMethod: function () {
                console.log('[RuntimeTest] workingMethod() called - no errors');
                return 'success';
            }
        },

        extension: {
            // Private method that throws error
            _privateError: function () {
                throw new Error('Intentional error from private extension method');
            },

            _privateWorking: function () {
                return 'private method works';
            }
        },

        events: [
            {
                for: 'brick:ready:*',
                on: {
                    fn: function (ev) {
                        console.log('[RuntimeTest] brick:ready handler - testing error handling');

                        // Test 1: Call working method
                        try {
                            const result = this.brick.runtimeTest.workingMethod();
                            console.log('[RuntimeTest] ✓ Working method returned:', result);
                        } catch (err) {
                            console.error('[RuntimeTest] ✗ Working method failed:', err);
                        }

                        // Test 2: Call private working method
                        try {
                            const result = this._privateWorking();
                            console.log('[RuntimeTest] ✓ Private working method returned:', result);
                        } catch (err) {
                            console.error('[RuntimeTest] ✗ Private working method failed:', err);
                        }
                    }
                }
            },
            {
                for: 'test:error:trigger',
                before: {
                    fn: function (ev) {
                        console.log('[RuntimeTest] test:error:trigger BEFORE phase - will throw error');
                        throw new Error('Intentional error in BEFORE phase - should cancel ON phase');
                    }
                },
                on: {
                    fn: function (ev) {
                        console.log('[RuntimeTest] test:error:trigger ON phase - should NOT execute if before failed');
                    }
                },
                after: {
                    fn: function (ev) {
                        console.log('[RuntimeTest] test:error:trigger AFTER phase - should ALWAYS execute');
                        console.log('[RuntimeTest] Event errors:', ev.errors);
                        console.log('[RuntimeTest] Event cancelled:', ev.cancel);
                    }
                }
            }
        ],

        init: function () {
            console.log('[RuntimeTest] init() called for brick:', this.brick.id);

            // Setup button click handler
            if (typeof document !== 'undefined') {
                setTimeout(() => {
                    const btn = document.getElementById('testBtn');
                    if (btn) {
                        btn.addEventListener('click', () => {
                            console.log('\n=== MANUAL TEST TRIGGERED ===\n');

                            // Test brick API error
                            console.log('Test 1: Calling brick.runtimeTest.triggerError()');
                            try {
                                this.brick.runtimeTest.triggerError();
                            } catch (err) {
                                console.log('✓ Error caught as expected');
                            }

                            // Test event error handling
                            console.log('\nTest 2: Firing test:error:trigger event');
                            this.brick.events.fire('test:error:trigger', { test: true });

                            // Test private method error
                            console.log('\nTest 3: Calling private method with error');
                            try {
                                this._privateError();
                            } catch (err) {
                                console.log('✓ Private method error caught');
                            }

                            console.log('\n=== TESTS COMPLETE ===\n');
                        });
                    }
                }, 100);
            }

            return true;
        },

        destroy: function () {
            console.log('[RuntimeTest] destroy() called');
        }
    };

})(window.VanillaBrick);
