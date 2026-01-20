/**
 * Table Virtual Scroll Extension (Standard HTML Implementation)
 * Uses native table structure with Top/Bottom spacer rows to simulate scroll height.
 * Keeps semantic HTML, ensures native accessibility, sticky headers, and column alignment.
 */
export const tableVirtual = {
    for: [{ host: 'brick', kind: 'table' }],
    requires: ['html', 'store', 'columns'],
    ns: 'virtual',
    options: {
        table: {
            virtual: {
                enabled: false,
                pageSize: 25,
                maxHeight: 400,
                rowHeight: 33
            }
        }
    },

    brick: {
        isEnabled: function () {
            return this.brick.options.get('table.virtual.enabled', false) === true;
        },
        refresh: function () {
            // Trigger a render sequence
            this._renderVisibleWindow();
        }
    },

    extension: {
        _wrapper: null,
        _table: null,
        _tbody: null,
        _spacerTop: null,
        _spacerBottom: null,
        _currentPage: -1,
        _rowHeight: 33,
        _ticking: false,

        _isEnabled: function () {
            return this.brick.options.get('table.virtual.enabled', false) === true;
        },

        _initStructure: function () {
            const html = this.brick.html;
            const root = html.element();
            if (!root) return false;

            this._table = root.tagName && root.tagName.toLowerCase() === 'table' ? root : root.querySelector('table');
            if (!this._table) return false;

            // Ensure table styles for sticky header support
            // We do NOT use position absolute/transform on the table.
            // We rely on standard flow.
            this._table.style.position = '';
            this._table.style.top = '';
            this._table.style.transform = '';
            this._table.style.width = '100%';
            this._table.style.borderCollapse = 'collapse'; // Important for pixel-perfect heights

            // Wrapper setup
            const parent = this._table.parentNode;
            if (parent && parent.classList && parent.classList.contains('vb-table-wrapper')) {
                this._wrapper = parent;
            } else {
                this._wrapper = html.create('div', { classList: ['vb-table-wrapper', 'vb-virtual'] });
                parent.insertBefore(this._wrapper, this._table);
                this._wrapper.appendChild(this._table);
            }

            this._wrapper.style.maxHeight = this.brick.options.get('table.virtual.maxHeight', 400) + 'px';
            this._wrapper.style.overflowY = 'auto'; // Native scrollbar
            this._wrapper.style.position = 'relative';

            // Clean up any artifacts from previous failed attempts
            const canvas = this._wrapper.querySelector('.vb-virtual-canvas');
            if (canvas) html.detach(canvas);
            const headerTable = this._wrapper.querySelector('.vb-virtual-header-table');
            if (headerTable) {
                // If we moved thead there, move it back!
                const thead = headerTable.querySelector('thead');
                if (thead) this._table.insertBefore(thead, this._table.firstChild);
                html.detach(headerTable);
            }

            // Ensure single tbody
            let tbody = this._table.querySelector('tbody');
            if (!tbody) {
                tbody = html.create('tbody');
                this._table.appendChild(tbody);
            }
            // Remove extra tbodies if any
            const tbodies = this._table.querySelectorAll('tbody');
            if (tbodies.length > 1) {
                // Keep the first one, detach others
                for (let i = 1; i < tbodies.length; i++) html.detach(tbodies[i]);
                tbody = tbodies[0];
            }
            this._tbody = tbody;

            // Apply sticky styles to TH elements if not present (via CSS ideally, but here for safety)
            const ths = this._table.querySelectorAll('th');
            ths.forEach(th => {
                th.style.position = 'sticky';
                th.style.top = '0';
                th.style.zIndex = '2';
                // Background needed to cover scrolling content
                if (!th.style.backgroundColor) th.style.backgroundColor = '#f8f9fa';
            });

            return true;
        },

        _updateCanvas: function () {
            // No canvas to update in this model.
            // But we should refresh rendering to update spacers.
            this._renderVisibleWindow();
        },

        _renderVisibleWindow: function () {
            const scrollTop = this._wrapper.scrollTop;
            const pageSize = this.brick.options.get('table.virtual.pageSize', 50); // Larger pages for stability
            this._rowHeight = this.brick.options.get('table.virtual.rowHeight', 33);
            const totalCount = this.brick.store.count() || 0;

            // Determine render range
            // We render a window around the viewport
            // To be safe and smooth, let's render [visible - buffer, visible + buffer]
            // Or stick to the pagination/block mode: render Page N.

            const startRowComplete = Math.floor(scrollTop / this._rowHeight);
            let startRow = Math.max(0, startRowComplete - (pageSize / 2)); // Buffer above
            startRow = Math.floor(startRow / pageSize) * pageSize; // Snap to page boundary for cache coherence?

            // Actually, let's keep the logic simple: Render current page of size 'pageSize' based on scroll
            // Better: Render a "Sliding Window" of N rows
            const windowSize = pageSize;
            const index = Math.floor(scrollTop / this._rowHeight);
            // Center the window somewhat or just start near it?
            // "Recycle Rows" usually renders [start, start + limits]

            let renderStart = Math.floor(index / (windowSize / 2)) * (windowSize / 2);
            // Keep it simple: Page oriented mode to reuse previous logic structure but with spacers
            const pageNum = Math.floor(scrollTop / (pageSize * this._rowHeight));
            const maxPage = Math.ceil(totalCount / pageSize) - 1;
            const targetPage = Math.min(maxPage, Math.max(0, pageNum));

            // We render 3 pages? Or just 1 large page?
            // To ensure smooth scrolling, render Previous + Current + Next
            const renderPageStart = Math.max(0, targetPage - 1);
            const renderPageEnd = Math.min(maxPage, targetPage + 1);

            const startIndex = renderPageStart * pageSize;
            // Calculate end index (exclusive)
            let endIndex = (renderPageEnd + 1) * pageSize;
            if (endIndex > totalCount) endIndex = totalCount;

            this._renderRows(startIndex, endIndex, totalCount);
        },

        _renderRows: function (startIndex, endIndex, totalCount) {
            const html = this.brick.html;
            const itemMap = this.brick.options.get("table.rows") || {}; // Items cache
            const emptyData = this.brick.store.data() || []; // Sparse array
            const columns = this.brick.columns.get() || [];
            const uidField = this.brick.store.uidField();

            // Calculate Spacers
            const topHeight = startIndex * this._rowHeight;
            const bottomHeight = (totalCount - endIndex) * this._rowHeight;

            // Clear tbody?
            // "Recycling" usually updates existing rows.
            // But for simplicity in this brick refactor, let's rebuild the fragment 
            // (Store local rendering is fast enough for < 100 rows).

            // Reuse spacers if possible, or recreate
            html.clear(this._tbody);

            // Top Spacer
            if (topHeight > 0) {
                const tr = html.create('tr', { classList: ['vb-virtual-spacer', 'top'] });
                tr.style.height = topHeight + 'px';
                // Invisible cell to maintain table integrity
                tr.innerHTML = `<td colspan="100" style="padding:0; border:0; height:${topHeight}px;"></td>`;
                html.append(this._tbody, tr);
            }

            // Render Rows
            for (let i = startIndex; i < endIndex; i++) {
                const rowData = emptyData[i];
                // If data missing, show skeleton/loading
                if (!rowData) {
                    this._renderSkeletonRow(i);
                    continue;
                }

                // Get or create TR item config
                // (Logic borrowed/simplified from table-rows.js)
                let item = itemMap[rowData[uidField]];
                if (!item) { item = { row: rowData }; itemMap[rowData[uidField]] = item; }

                // Create TR
                const tr = html.create('tr');
                html.attr(tr, 'for', rowData[uidField]);
                html.attr(tr, 'data-index', i);
                if (window.getComputedStyle) tr.style.height = this._rowHeight + 'px'; // Enforce height

                // Cells
                for (let c = 0; c < columns.length; c++) {
                    const col = columns[c];
                    const td = html.create('td');
                    html.attr(td, 'for', col.datafield);
                    const val = rowData[col.datafield];
                    td.textContent = (val === undefined || val === null) ? '' : val;
                    html.append(tr, td);
                }

                // Fire row render events so extensions like table-rows-focused can attach listeners
                const eventData = {
                    item: { tr: tr }, // For table-rows.js
                    tr: tr,           // For table-rows-focused.js
                    row: rowData,
                    index: i,
                    columns: columns
                };
                this.brick.events.fire('table:row:render', eventData);

                html.append(this._tbody, tr);
            }

            // Bottom Spacer
            if (bottomHeight > 0) {
                const tr = html.create('tr', { classList: ['vb-virtual-spacer', 'bottom'] });
                tr.style.height = bottomHeight + 'px';
                tr.innerHTML = `<td colspan="100" style="padding:0; border:0; height:${bottomHeight}px;"></td>`;
                html.append(this._tbody, tr);
            }

            // Save render state
            this.brick.options.setSilent("table.rows", itemMap);
        },

        _renderSkeletonRow: function (index) {
            const html = this.brick.html;
            const tr = html.create('tr', { classList: ['vb-virtual-skeleton'] });
            tr.style.height = this._rowHeight + 'px';
            html.attr(tr, 'data-index', index);
            const td = html.create('td');
            td.colSpan = 100;
            td.innerHTML = `<div class="vb-skeleton-bar" style="height: 100%; width: 100%; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: vb-skeleton-loading 1.5s infinite;"></div>`;
            html.append(tr, td);
            html.append(this._tbody, tr);
        }
    },

    events: [
        {
            for: 'brick:status:ready',
            on: {
                fn: function () {
                    if (this._isEnabled()) {
                        this._initStructure();
                        this._wrapper.addEventListener('scroll', () => {
                            if (!this._ticking) {
                                window.requestAnimationFrame(() => {
                                    this._renderVisibleWindow();
                                    this._ticking = false;
                                });
                                this._ticking = true;
                            }
                        }, { passive: true });
                    }
                }
            }
        },
        // Hook into data updates to refresh the window
        {
            for: 'store:data:load',
            after: {
                fn: function () {
                    if (this._isEnabled()) this._renderVisibleWindow();
                }
            }
        },
        {
            for: 'store:data:updated',
            after: {
                fn: function () {
                    if (this._isEnabled()) this._renderVisibleWindow();
                }
            }
        },
        // Intercept standard render requests (e.g. from Sort or Filter)
        {
            for: 'table:rows:render',
            before: {
                priority: 5, // High priority (runs before table-rows at 10), but leaves room for critical hooks (0-4)
                fn: function (ev) {
                    if (this._isEnabled()) {
                        // We handle the render
                        this._renderVisibleWindow();
                        // Mark as handled so table-rows.js skips it
                        ev.virtualHandled = true;
                    }
                }
            }
        }
    ],

    init: function () { },
    destroy: function () { }
};

export default tableVirtual;
