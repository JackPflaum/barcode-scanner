/**
 * Workflow Management Module
 * Handles all warehouse workflows: Picking, Stock Count, Location Move, Returns
 */

class WorkflowManager {
    constructor() {
        this.currentWorkflow = null;
        this.workflowData = null;
        this.workflowState = 'ready'; // ready, picking, stockcount, locationmove, returns
        this.moveWorkflowStep = null; // For location move workflow steps
        this.moveSourceLocation = null;
        this.moveItem = null;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.statusArea = document.getElementById('status-area');
        this.workflowContent = document.getElementById('workflow-content');
        this.cancelButton = document.getElementById('cancel-workflow');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.cancelButton.addEventListener('click', () => this.cancelWorkflow());
    }

    /**
     * Handle barcode scan based on current workflow state
     */
    handleBarcodeScan(barcode) {
        console.log('Processing barcode:', barcode, 'State:', this.workflowState);

        if (!isValidBarcode(barcode)) {
            this.showError('Invalid barcode format');
            return;
        }

        const prefix = getBarcodePrefix(barcode);

        // Route to appropriate workflow handler
        switch (this.workflowState) {
            case 'ready':
                this.handleReadyState(barcode, prefix);
                break;
            case 'picking':
                this.handlePickingWorkflow(barcode, prefix);
                break;
            case 'stockcount':
                this.handleStockCountWorkflow(barcode, prefix);
                break;
            case 'locationmove':
                this.handleLocationMoveWorkflow(barcode, prefix);
                break;
            case 'returns':
                this.handleReturnsWorkflow(barcode, prefix);
                break;
        }
    }

    /**
     * Handle barcode scans when no workflow is active
     */
    handleReadyState(barcode, prefix) {
        // Check if it's a JSON order (QR code)
        if (barcode.startsWith('{') && barcode.includes('order_id')) {
            this.startPickingWorkflow(barcode);
            return;
        }
        
        switch (prefix) {
            case 'ord_':
                this.startPickingWorkflow(barcode);
                break;
            case 'stc_':
                this.startStockCountWorkflow(barcode);
                break;
            case 'loc_':
                this.startLocationMoveWorkflow(barcode);
                break;
            default:
                // Any barcode without ord_, stc_, loc_ prefix is treated as item
                this.startReturnsWorkflow(barcode);
        }
    }

    /**
     * Start Picking Workflow
     */
    startPickingWorkflow(orderBarcode) {
        let order;
        
        // Try to parse as JSON (QR code with embedded order data)
        try {
            order = JSON.parse(orderBarcode);
            // Validate it's an order object
            if (!order.order_id || !order.items) {
                throw new Error('Invalid order format');
            }
        } catch (e) {
            // Fallback to database lookup for ord_ prefixed barcodes
            order = getOrder(orderBarcode);
            if (!order) {
                this.showError('Order not found: ' + orderBarcode);
                return;
            }
        }

        this.currentWorkflow = 'picking';
        this.workflowData = order;
        this.workflowState = 'picking';

        this.showSuccess(`Order ${order.order_id} loaded for ${order.customer}`);
        this.showCancelButton();
        this.renderPickingWorkflow();
    }

    /**
     * Handle picking workflow barcode scans
     */
    handlePickingWorkflow(barcode, prefix) {
        // Only allow items (non-prefixed) during picking
        if (prefix === 'ord_' || prefix === 'stc_' || prefix === 'loc_') {
            this.showError('Item doesn\'t exist in order');
            return;
        }

        const orderItem = findItemInOrder(this.workflowData, barcode);
        if (!orderItem) {
            this.showError('Item doesn\'t appear in the order');
            return;
        }

        // Increment picked quantity
        if (orderItem.quantity_picked < orderItem.quantity_needed) {
            orderItem.quantity_picked++;
            this.showSuccess(`Picked ${orderItem.name} (${orderItem.quantity_picked}/${orderItem.quantity_needed})`);
            this.renderPickingWorkflow();
            
            // Check if order is complete
            this.checkOrderCompletion();
        } else {
            this.showWarning(`${orderItem.name} already complete`);
        }
    }

    /**
     * Check if picking order is complete
     */
    checkOrderCompletion() {
        const allComplete = this.workflowData.items.every(item => 
            item.quantity_picked >= item.quantity_needed
        );

        if (allComplete) {
            this.showCompleteOrderButton();
        }
    }

    /**
     * Start Stock Count Workflow
     */
    startStockCountWorkflow(stockCountBarcode) {
        const stockCount = getStockCount(stockCountBarcode);
        if (!stockCount) {
            this.showError('Stock count not found: ' + stockCountBarcode);
            return;
        }

        this.currentWorkflow = 'stockcount';
        this.workflowData = stockCount;
        this.workflowState = 'stockcount';

        this.showSuccess(`Stock count ${stockCount.stock_count_id} loaded for location ${stockCount.location}`);
        this.showCancelButton();
        this.renderStockCountWorkflow();
    }

    /**
     * Handle stock count workflow barcode scans
     */
    handleStockCountWorkflow(barcode, prefix) {
        // Only allow items (non-prefixed) during stock count
        if (prefix === 'ord_' || prefix === 'stc_' || prefix === 'loc_') {
            this.showError('Item doesn\'t exist in stock count');
            return;
        }

        const stockItem = findItemInStockCount(this.workflowData, barcode);
        if (!stockItem) {
            this.showError('Item not in this stock count');
            return;
        }

        // Prompt for quantity
        this.promptForQuantity(stockItem);
    }

    /**
     * Start Location Move Workflow
     */
    startLocationMoveWorkflow(locationBarcode) {
        const location = getLocation(locationBarcode);
        if (!location) {
            this.showError('Location not found: ' + locationBarcode);
            return;
        }

        this.currentWorkflow = 'locationmove';
        this.workflowData = location;
        this.workflowState = 'locationmove';
        this.moveWorkflowStep = 'confirm';
        this.moveSourceLocation = location;

        this.showLocationMoveConfirmation(location);
    }

    /**
     * Handle location move workflow barcode scans
     */
    handleLocationMoveWorkflow(barcode, prefix) {
        switch (this.moveWorkflowStep) {
            case 'scan_item':
                if (prefix === 'ord_' || prefix === 'stc_' || prefix === 'loc_') {
                    this.showError('Please scan an item to move');
                    return;
                }
                this.handleMoveItemScan(barcode);
                break;
            case 'scan_destination':
                if (prefix !== 'loc_') {
                    this.showError('Please scan a location barcode (loc_)');
                    return;
                }
                this.handleMoveDestinationScan(barcode);
                break;
        }
    }

    /**
     * Start Returns Workflow
     */
    startReturnsWorkflow(itemBarcode) {
        const item = getItem(itemBarcode);
        if (!item) {
            this.showError('Item not found: ' + itemBarcode);
            return;
        }

        this.currentWorkflow = 'returns';
        this.workflowData = item;
        this.workflowState = 'returns';
        this.moveItem = item;

        this.showInfo(`Scan the destination location for ${item.name}`);
        this.showCancelButton();
        this.renderReturnsWorkflow();
    }

    /**
     * Handle returns workflow barcode scans
     */
    handleReturnsWorkflow(barcode, prefix) {
        if (prefix !== 'loc_') {
            this.showError('Please scan a location barcode (loc_)');
            return;
        }

        const location = getLocation(barcode);
        if (!location) {
            this.showError('Location not found: ' + barcode);
            return;
        }

        this.showReturnsConfirmation(location);
    }

    /**
     * Render picking workflow UI
     */
    renderPickingWorkflow() {
        const order = this.workflowData;
        let html = `
            <div class="workflow-progress">
                <h5>Order ${order.order_id} - ${order.customer}</h5>
                <div class="row">
        `;

        order.items.forEach(item => {
            const isComplete = item.quantity_picked >= item.quantity_needed;
            const progressClass = isComplete ? 'completed' : (item.quantity_picked > 0 ? 'in-progress' : '');
            
            html += `
                <div class="col-12 mb-2">
                    <div class="workflow-item ${progressClass} p-3 rounded" onclick="workflowManager.manualQuantityEntry('${item.barcode}')" style="cursor: pointer;">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${item.name}</strong><br>
                                <small class="text-muted">${item.sku} • ${item.location}</small>
                            </div>
                            <div class="text-end">
                                <div class="progress-circle ${isComplete ? 'completed' : (item.quantity_picked > 0 ? 'in-progress' : 'pending')}">
                                    ${item.quantity_picked}/${item.quantity_needed}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        this.workflowContent.innerHTML = html;
    }

    /**
     * Render stock count workflow UI
     */
    renderStockCountWorkflow() {
        const stockCount = this.workflowData;
        let html = `
            <div class="workflow-progress">
                <h5>Stock Count ${stockCount.stock_count_id}</h5>
                <p class="text-muted">Location: ${stockCount.location}</p>
                <div class="row">
        `;

        stockCount.items.forEach(item => {
            const isComplete = item.counted_quantity !== null;
            
            html += `
                <div class="col-12 mb-2">
                    <div class="workflow-item ${isComplete ? 'completed' : ''} p-3 rounded">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${item.name}</strong><br>
                                <small class="text-muted">${item.sku} • Expected: ${item.expected_quantity}</small>
                            </div>
                            <div class="text-end">
                                ${isComplete ? 
                                    `<span class="badge bg-success">Counted: ${item.counted_quantity}</span>` :
                                    `<span class="badge bg-secondary">Pending</span>`
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <button class="btn btn-success w-100 mt-3" onclick="workflowManager.completeStockCount()">
                    Complete Count
                </button>
            </div>
        `;

        this.workflowContent.innerHTML = html;
    }

    /**
     * Render returns workflow UI
     */
    renderReturnsWorkflow() {
        const item = this.workflowData;
        const html = `
            <div class="workflow-progress">
                <h5>Returns Processing</h5>
                <div class="alert alert-info">
                    <strong>Item:</strong> ${item.name}<br>
                    <strong>SKU:</strong> ${item.sku}<br>
                    <strong>Next:</strong> Scan destination location
                </div>
            </div>
        `;
        this.workflowContent.innerHTML = html;
    }

    /**
     * Show location move confirmation
     */
    showLocationMoveConfirmation(location) {
        const html = `
            <div class="workflow-progress">
                <h5>Location Move</h5>
                <div class="alert alert-warning">
                    Do you want to move an item from <strong>${location.location_id}</strong>?
                </div>
                <div class="d-grid gap-2">
                    <button class="btn btn-primary" onclick="workflowManager.confirmLocationMove()">
                        Yes, Move Item
                    </button>
                    <button class="btn btn-secondary" onclick="workflowManager.cancelWorkflow()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        this.workflowContent.innerHTML = html;
        this.showCancelButton();
    }

    /**
     * Confirm location move and proceed to item scan
     */
    confirmLocationMove() {
        this.moveWorkflowStep = 'scan_item';
        this.showInfo(`Scan the item you want to move from ${this.moveSourceLocation.location_id}`);
        
        const html = `
            <div class="workflow-progress">
                <h5>Location Move - Step 2</h5>
                <div class="alert alert-info">
                    <strong>Source:</strong> ${this.moveSourceLocation.location_id}<br>
                    <strong>Next:</strong> Scan item to move
                </div>
            </div>
        `;
        this.workflowContent.innerHTML = html;
    }

    /**
     * Handle item scan in location move workflow
     */
    handleMoveItemScan(itemBarcode) {
        const item = getItem(itemBarcode);
        if (!item) {
            this.showError('Item not found: ' + itemBarcode);
            return;
        }

        this.moveItem = item;
        this.moveWorkflowStep = 'scan_destination';
        this.showInfo(`Now scan the destination location for ${item.name}`);
        
        const html = `
            <div class="workflow-progress">
                <h5>Location Move - Step 3</h5>
                <div class="alert alert-info">
                    <strong>Item:</strong> ${item.name}<br>
                    <strong>From:</strong> ${this.moveSourceLocation.location_id}<br>
                    <strong>Next:</strong> Scan destination location
                </div>
            </div>
        `;
        this.workflowContent.innerHTML = html;
    }

    /**
     * Handle destination scan in location move workflow
     */
    handleMoveDestinationScan(locationBarcode) {
        const location = getLocation(locationBarcode);
        if (!location) {
            this.showError('Location not found: ' + locationBarcode);
            return;
        }

        this.showMoveConfirmation(location);
    }

    /**
     * Show move confirmation
     */
    showMoveConfirmation(destinationLocation) {
        const html = `
            <div class="workflow-progress">
                <h5>Confirm Move</h5>
                <div class="alert alert-warning">
                    Move <strong>${this.moveItem.name}</strong><br>
                    From: <strong>${this.moveSourceLocation.location_id}</strong><br>
                    To: <strong>${destinationLocation.location_id}</strong>
                </div>
                <div class="d-grid gap-2">
                    <button class="btn btn-success" onclick="workflowManager.executeMove('${destinationLocation.location_id}')">
                        Confirm Move
                    </button>
                    <button class="btn btn-secondary" onclick="workflowManager.cancelWorkflow()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        this.workflowContent.innerHTML = html;
    }

    /**
     * Show returns confirmation
     */
    showReturnsConfirmation(location) {
        const html = `
            <div class="workflow-progress">
                <h5>Confirm Returns</h5>
                <div class="alert alert-warning">
                    Place <strong>${this.moveItem.name}</strong><br>
                    In location: <strong>${location.location_id}</strong>
                </div>
                <div class="d-grid gap-2">
                    <button class="btn btn-success" onclick="workflowManager.executeReturns('${location.location_id}')">
                        Confirm Placement
                    </button>
                    <button class="btn btn-secondary" onclick="workflowManager.cancelWorkflow()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        this.workflowContent.innerHTML = html;
    }

    /**
     * Manual quantity entry for picking workflow
     */
    manualQuantityEntry(itemBarcode) {
        const userPin = prompt('Enter user PIN (1234):');
        if (userPin !== '1234') {
            this.showError('Invalid PIN');
            return;
        }
        
        const orderItem = findItemInOrder(this.workflowData, itemBarcode);
        if (!orderItem) return;
        
        const quantity = prompt(`Enter quantity for ${orderItem.name}:`, orderItem.quantity_picked.toString());
        if (quantity !== null) {
            const count = parseInt(quantity);
            if (!isNaN(count) && count >= 0 && count <= orderItem.quantity_needed) {
                orderItem.quantity_picked = count;
                this.showSuccess(`Updated ${orderItem.name}: ${count}/${orderItem.quantity_needed}`);
                this.renderPickingWorkflow();
                this.checkOrderCompletion();
            } else {
                this.showError('Invalid quantity');
            }
        }
    }

    /**
     * Prompt for quantity input
     */
    promptForQuantity(stockItem) {
        const quantity = prompt(`Enter count for ${stockItem.name}:`, '0');
        if (quantity !== null) {
            const count = parseInt(quantity);
            if (!isNaN(count) && count >= 0) {
                stockItem.counted_quantity = count;
                this.showSuccess(`Counted ${stockItem.name}: ${count}`);
                this.renderStockCountWorkflow();
            } else {
                this.showError('Invalid quantity entered');
            }
        }
    }

    /**
     * Show complete order button
     */
    showCompleteOrderButton() {
        const button = document.createElement('button');
        button.className = 'btn btn-success w-100 mt-3';
        button.textContent = 'Complete Order';
        button.onclick = () => this.completeOrder();
        
        const workflowProgress = this.workflowContent.querySelector('.workflow-progress');
        if (workflowProgress && !workflowProgress.querySelector('.btn-success')) {
            workflowProgress.appendChild(button);
        }
    }

    /**
     * Complete picking order
     */
    completeOrder() {
        // Check if any items are incomplete
        const incompleteItems = this.workflowData.items.filter(item => item.quantity_picked < item.quantity_needed);
        
        if (incompleteItems.length > 0) {
            const proceed = confirm(`${incompleteItems.length} items incomplete. Complete anyway?`);
            if (!proceed) return;
        }
        
        // Reset order quantities for testing
        this.workflowData.items.forEach(item => {
            item.quantity_picked = 0;
        });
        this.showSuccess(`Order ${this.workflowData.order_id} completed successfully!`);
        this.resetWorkflow();
    }

    /**
     * Complete stock count
     */
    completeStockCount() {
        // Check if any items are uncounted
        const uncounteditems = this.workflowData.items.filter(item => item.counted_quantity === null);
        
        if (uncounteditems.length > 0) {
            const proceed = confirm(`${uncounteditems.length} items not counted. Complete anyway?`);
            if (!proceed) return;
        }
        
        // Reset stock count for testing
        this.workflowData.items.forEach(item => {
            item.counted_quantity = null;
        });
        this.showSuccess(`Stock count ${this.workflowData.stock_count_id} completed!`);
        this.resetWorkflow();
    }

    /**
     * Execute location move
     */
    executeMove(destinationLocationId) {
        const proceed = confirm(`Confirm: Move ${this.moveItem.name} from ${this.moveSourceLocation.location_id} to ${destinationLocationId}?`);
        if (!proceed) return;
        
        this.showSuccess(`${this.moveItem.name} moved from ${this.moveSourceLocation.location_id} to ${destinationLocationId}`);
        this.resetWorkflow();
    }

    /**
     * Execute returns placement
     */
    executeReturns(locationId) {
        const proceed = confirm(`Confirm: Place ${this.moveItem.name} in location ${locationId}?`);
        if (!proceed) return;
        
        this.showSuccess(`${this.moveItem.name} placed in location ${locationId}`);
        this.resetWorkflow();
    }

    /**
     * Cancel current workflow
     */
    cancelWorkflow() {
        this.showWarning('Workflow cancelled');
        this.resetWorkflow();
    }

    /**
     * Reset workflow to ready state
     */
    resetWorkflow() {
        this.currentWorkflow = null;
        this.workflowData = null;
        this.workflowState = 'ready';
        this.moveWorkflowStep = null;
        this.moveSourceLocation = null;
        this.moveItem = null;
        
        this.hideCancelButton();
        this.workflowContent.innerHTML = '';
        document.getElementById('status-row').style.display = 'none';
    }

    /**
     * Show/hide cancel button
     */
    showCancelButton() {
        this.cancelButton.style.display = 'block';
    }

    hideCancelButton() {
        this.cancelButton.style.display = 'none';
    }

    /**
     * Status message helpers
     */
    showSuccess(message) {
        this.statusArea.className = 'alert alert-success status-success';
        this.statusArea.textContent = message;
        document.getElementById('status-row').style.display = 'block';
    }

    showError(message) {
        this.statusArea.className = 'alert alert-danger status-error';
        this.statusArea.textContent = message;
        document.getElementById('status-row').style.display = 'block';
    }

    showWarning(message) {
        this.statusArea.className = 'alert alert-warning status-warning';
        this.statusArea.textContent = message;
        document.getElementById('status-row').style.display = 'block';
    }

    showInfo(message) {
        this.statusArea.className = 'alert alert-info';
        this.statusArea.textContent = message;
        document.getElementById('status-row').style.display = 'block';
    }
}