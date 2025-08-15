// Workflow Management
class WorkflowManager {
  constructor() {
    this.currentWorkflow = null;
    this.workflowData = null;
  }

  async handleBarcode(barcode) {
    const prefix = barcode.substring(0, 4);
    
    // If we're in an active workflow, validate the scan
    if (this.currentWorkflow) {
      return await this.handleWorkflowScan(barcode);
    }
    
    // Start new workflows only when no workflow is active
    switch (prefix) {
      case 'ord_':
        await this.startPickingWorkflow(barcode);
        break;
      case 'stc_':
        await this.startStockCountWorkflow(barcode);
        break;
      case 'loc_':
        await this.startLocationMoveWorkflow(barcode);
        break;
      case 'itm_':
        await this.handleItemScan(barcode);
        break;
      default:
        showNotification(`Unknown barcode format: ${barcode}`, 'error');
    }
  }

  async startPickingWorkflow(barcode) {
    try {
      const orderData = await this.loadOrderData(barcode);
      if (!orderData) {
        showNotification(`Order not found: ${barcode}`, 'error');
        return;
      }

      this.currentWorkflow = 'picking';
      this.workflowData = orderData;
      
      showNotification(`Order ${orderData.order_id} loaded successfully`, 'success');
      this.renderPickingWorkflow();
      
    } catch (error) {
      showNotification(`Error loading order: ${error.message}`, 'error');
    }
  }

  async startStockCountWorkflow(barcode) {
    try {
      const stockCountData = await this.loadStockCountData(barcode);
      if (!stockCountData) {
        showNotification(`Stock count not found: ${barcode}`, 'error');
        return;
      }

      this.currentWorkflow = 'stockcount';
      this.workflowData = stockCountData;
      
      showNotification(`Stock count ${stockCountData.stock_count_id} loaded`, 'success');
      this.renderStockCountWorkflow();
      
    } catch (error) {
      showNotification(`Error loading stock count: ${error.message}`, 'error');
    }
  }

  async startLocationMoveWorkflow(barcode) {
    try {
      const locationData = await this.loadLocationData(barcode);
      if (!locationData) {
        showNotification(`Location not found: ${barcode}`, 'error');
        return;
      }

      this.currentWorkflow = 'locationmove';
      this.workflowData = { sourceLocation: locationData, step: 'confirm' };
      
      this.renderLocationMoveWorkflow();
      
    } catch (error) {
      showNotification(`Error loading location: ${error.message}`, 'error');
    }
  }

  async handleItemScan(barcode) {
    if (this.currentWorkflow === 'locationmove' && this.workflowData.step === 'scan_item') {
      this.workflowData.item = barcode;
      this.workflowData.step = 'scan_destination';
      showNotification('Now scan the destination location', 'info');
      this.renderLocationMoveWorkflow();
    } else {
      // Start returns workflow
      this.currentWorkflow = 'returns';
      this.workflowData = { item: barcode, step: 'scan_location' };
      showNotification('Scan the destination location for this item', 'info');
      this.renderReturnsWorkflow();
    }
  }

  async handleWorkflowScan(barcode) {
    const prefix = barcode.substring(0, 4);
    
    switch (this.currentWorkflow) {
      case 'picking':
        // Only allow item scans during picking
        if (prefix === 'itm_') {
          await this.handlePickingItemScan(barcode);
        } else if (prefix === 'ord_') {
          showNotification('Order workflow already active. Scan items or cancel current workflow.', 'error');
        } else {
          showNotification('Please scan an item from your order list', 'error');
        }
        break;
      case 'stockcount':
        // Only allow item scans during stock count
        if (prefix === 'itm_') {
          await this.handleStockCountItemScan(barcode);
        } else if (prefix === 'stc_') {
          showNotification('Stock count workflow already active. Scan items or cancel current workflow.', 'error');
        } else {
          showNotification('Please scan an item from your stock count list', 'error');
        }
        break;
      case 'locationmove':
        if (prefix === 'loc_' && this.workflowData.step !== 'scan_destination') {
          showNotification('Location move workflow already active. Follow the current step or cancel workflow.', 'error');
        } else {
          await this.handleLocationMoveScan(barcode);
        }
        break;
      case 'returns':
        if (prefix === 'itm_') {
          showNotification('Returns workflow already active. Scan a location or cancel workflow.', 'error');
        } else {
          await this.handleReturnsScan(barcode);
        }
        break;
    }
  }

  async handlePickingItemScan(barcode) {
    const item = this.workflowData.items.find(i => i.barcode === barcode);
    
    if (!item) {
      showNotification('Item not in this order', 'error');
      return;
    }

    if (!item.qty_scanned) item.qty_scanned = 0;

    if (item.qty_scanned >= item.qty_needed) {
      showNotification(`${item.name} already complete (${item.qty_scanned}/${item.qty_needed})`, 'warning');
      return;
    }

    item.qty_scanned++;
    showNotification(`${item.name}: ${item.qty_scanned}/${item.qty_needed} collected`, 'success');
    
    this.renderPickingWorkflow();
    this.checkOrderComplete();
  }

  async handleStockCountItemScan(barcode) {
    const item = this.workflowData.items.find(i => i.barcode === barcode);
    
    if (!item) {
      showNotification('Item not in this stock count', 'error');
      return;
    }

    if (item.counted) {
      const recount = confirm(`${item.name} already counted. Recount?`);
      if (!recount) return;
    }

    this.promptForQuantity(item);
  }

  async handleLocationMoveScan(barcode) {
    const prefix = barcode.substring(0, 4);
    
    if (this.workflowData.step === 'scan_item') {
      if (prefix === 'itm_') {
        this.workflowData.item = barcode;
        this.workflowData.step = 'scan_destination';
        showNotification('Now scan the destination location', 'info');
        this.renderLocationMoveWorkflow();
      } else {
        showNotification('Please scan an item to move', 'error');
      }
    } else if (this.workflowData.step === 'scan_destination') {
      if (prefix === 'loc_') {
        const locationData = await this.loadLocationData(barcode);
        if (!locationData) {
          showNotification('Invalid destination location', 'error');
          return;
        }
        this.workflowData.destinationLocation = locationData;
        this.workflowData.step = 'confirm_move';
        this.renderLocationMoveWorkflow();
      } else {
        showNotification('Please scan a location barcode (loc_)', 'error');
      }
    } else {
      showNotification('Please follow the current workflow step', 'error');
    }
  }

  async handleReturnsScan(barcode) {
    const prefix = barcode.substring(0, 4);
    
    if (this.workflowData.step === 'scan_location') {
      if (prefix === 'loc_') {
        const locationData = await this.loadLocationData(barcode);
        if (!locationData) {
          showNotification('Invalid location', 'error');
          return;
        }
        this.workflowData.location = locationData;
        this.workflowData.step = 'confirm';
        this.renderReturnsWorkflow();
      } else {
        showNotification('Please scan a location barcode (loc_)', 'error');
      }
    } else {
      showNotification('Please follow the current workflow step', 'error');
    }
  }

  checkOrderComplete() {
    const allComplete = this.workflowData.items.every(item => 
      (item.qty_scanned || 0) >= item.qty_needed
    );

    if (allComplete) {
      showNotification(`🎉 Order ${this.workflowData.order_id} complete!`, 'success');
    }
  }

  promptForQuantity(item) {
    const quantity = prompt(`Enter quantity for ${item.name}:`);
    if (quantity !== null && !isNaN(quantity) && quantity >= 0) {
      item.counted_qty = parseInt(quantity);
      item.counted = true;
      showNotification(`${item.name}: ${quantity} counted`, 'success');
      this.renderStockCountWorkflow();
    }
  }

  renderPickingWorkflow() {
    const content = document.getElementById('workflow-content');
    const totalItems = this.workflowData.items.length;
    const completedItems = this.workflowData.items.filter(item => 
      (item.qty_scanned || 0) >= item.qty_needed
    ).length;

    content.innerHTML = `
      <div class="row">
        <div class="col-12">
          <div class="card workflow-card active">
            <div class="card-header">
              <h5>📋 Picking Order ${this.workflowData.order_id}</h5>
              <div class="progress-bar-custom">
                <div class="progress-fill" style="width: ${(completedItems/totalItems)*100}%"></div>
              </div>
              <small class="text-muted">${completedItems}/${totalItems} items complete</small>
              <div class="mt-2">
                <small class="text-info">📱 Scan items from the list below</small>
              </div>
            </div>
            <div class="card-body">
              <div class="item-list">
                ${this.workflowData.items.map(item => `
                  <div class="item ${(item.qty_scanned || 0) >= item.qty_needed ? 'complete' : 'pending'}">
                    <div class="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>${item.name}</strong><br>
                        <small class="text-muted">SKU: ${item.SKU} | Location: ${item.location}</small>
                      </div>
                      <div class="text-end">
                        <span class="quantity-badge badge ${(item.qty_scanned || 0) >= item.qty_needed ? 'bg-success' : 'bg-warning'}">
                          ${item.qty_scanned || 0}/${item.qty_needed}
                        </span>
                        ${item.qty_needed > 10 ? '<br><button class="btn btn-sm btn-outline-primary mt-1" onclick="workflowManager.promptManualEntry(\'' + item.barcode + '\')">Manual Entry</button>' : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="mt-3 text-center">
                <button class="btn btn-success" onclick="workflowManager.completeWorkflow()">Complete Order</button>
                <button class="btn btn-outline-danger ms-2" onclick="workflowManager.cancelWorkflow()">Cancel Workflow</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStockCountWorkflow() {
    const content = document.getElementById('workflow-content');
    const totalItems = this.workflowData.items.length;
    const countedItems = this.workflowData.items.filter(item => item.counted).length;

    content.innerHTML = `
      <div class="row">
        <div class="col-12">
          <div class="card workflow-card active">
            <div class="card-header">
              <h5>📊 Stock Count ${this.workflowData.stock_count_id}</h5>
              <div class="progress-bar-custom">
                <div class="progress-fill" style="width: ${(countedItems/totalItems)*100}%"></div>
              </div>
              <small class="text-muted">${countedItems}/${totalItems} items counted</small>
              <div class="mt-2">
                <small class="text-info">📱 Scan items from the list below</small>
              </div>
            </div>
            <div class="card-body">
              <div class="item-list">
                ${this.workflowData.items.map(item => `
                  <div class="item ${item.counted ? 'complete' : 'pending'}">
                    <div class="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>${item.name}</strong><br>
                        <small class="text-muted">SKU: ${item.SKU} | Location: ${item.location}</small>
                      </div>
                      <div class="text-end">
                        ${item.counted ? 
                          `<span class="quantity-badge badge bg-success">Counted: ${item.counted_qty}</span>` :
                          `<span class="quantity-badge badge bg-warning">Pending</span>`
                        }
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="mt-3 text-center">
                <button class="btn btn-success" onclick="workflowManager.completeWorkflow()">Complete Count</button>
                <button class="btn btn-outline-danger ms-2" onclick="workflowManager.cancelWorkflow()">Cancel Workflow</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderLocationMoveWorkflow() {
    const content = document.getElementById('workflow-content');
    const data = this.workflowData;

    let stepContent = '';
    switch (data.step) {
      case 'confirm':
        stepContent = `
          <p>Do you want to move an item from <strong>${data.sourceLocation.location}</strong>?</p>
          <button class="btn btn-primary" onclick="workflowManager.confirmLocationMove()">Yes, Move Item</button>
          <button class="btn btn-secondary ms-2" onclick="workflowManager.resetWorkflow()">Cancel</button>
        `;
        break;
      case 'scan_item':
        stepContent = `<p>Scan the item you want to move from <strong>${data.sourceLocation.location}</strong></p>`;
        break;
      case 'scan_destination':
        stepContent = `<p>Now scan the destination location for item <strong>${data.item}</strong></p>`;
        break;
      case 'confirm_move':
        stepContent = `
          <p>Move item <strong>${data.item}</strong> from <strong>${data.sourceLocation.location}</strong> to <strong>${data.destinationLocation.location}</strong>?</p>
          <button class="btn btn-success" onclick="workflowManager.executeLocationMove()">Confirm Move</button>
          <button class="btn btn-secondary ms-2" onclick="workflowManager.resetWorkflow()">Cancel</button>
        `;
        break;
    }

    content.innerHTML = `
      <div class="row">
        <div class="col-12">
          <div class="card workflow-card active">
            <div class="card-header">
              <h5>📦 Location Move</h5>
            </div>
            <div class="card-body text-center">
              ${stepContent}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderReturnsWorkflow() {
    const content = document.getElementById('workflow-content');
    const data = this.workflowData;

    let stepContent = '';
    switch (data.step) {
      case 'scan_location':
        stepContent = `<p>Scan the location where you want to place item <strong>${data.item}</strong></p>`;
        break;
      case 'confirm':
        stepContent = `
          <p>Place item <strong>${data.item}</strong> in location <strong>${data.location.location}</strong>?</p>
          <button class="btn btn-success" onclick="workflowManager.executeReturn()">Confirm</button>
          <button class="btn btn-secondary ms-2" onclick="workflowManager.resetWorkflow()">Cancel</button>
        `;
        break;
    }

    content.innerHTML = `
      <div class="row">
        <div class="col-12">
          <div class="card workflow-card active">
            <div class="card-header">
              <h5>↩️ Returns</h5>
            </div>
            <div class="card-body text-center">
              ${stepContent}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  confirmLocationMove() {
    this.workflowData.step = 'scan_item';
    showNotification('Scan the item you want to move', 'info');
    this.renderLocationMoveWorkflow();
  }

  async executeLocationMove() {
    // Simulate API call
    showNotification(`Item ${this.workflowData.item} moved to ${this.workflowData.destinationLocation.location}`, 'success');
    this.resetWorkflow();
  }

  async executeReturn() {
    // Simulate API call
    showNotification(`Item ${this.workflowData.item} placed in ${this.workflowData.location.location}`, 'success');
    this.resetWorkflow();
  }

  promptManualEntry(itemBarcode) {
    const accessCode = prompt('Enter access code for manual entry:');
    if (accessCode === '1234') { // Simple access code
      const quantity = prompt('Enter quantity:');
      if (quantity && !isNaN(quantity)) {
        const item = this.workflowData.items.find(i => i.barcode === itemBarcode);
        item.qty_scanned = Math.min(parseInt(quantity), item.qty_needed);
        showNotification(`Manual entry: ${item.name} - ${item.qty_scanned}/${item.qty_needed}`, 'success');
        this.renderPickingWorkflow();
      }
    } else {
      showNotification('Invalid access code', 'error');
    }
  }

  completeWorkflow() {
    showNotification(`${this.currentWorkflow} workflow completed!`, 'success');
    this.resetWorkflow();
  }

  cancelWorkflow() {
    showNotification('Workflow cancelled', 'info');
    this.currentWorkflow = null;
    this.workflowData = null;
    this.renderDefaultView();
  }

  resetWorkflow() {
    this.currentWorkflow = null;
    this.workflowData = null;
    this.renderDefaultView();
  }

  renderDefaultView() {
    const content = document.getElementById('workflow-content');
    content.innerHTML = `
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-body text-center">
              <h5>Ready to Scan</h5>
              <p class="text-muted">Scan a barcode to begin a workflow</p>
              <div class="workflow-buttons mt-3">
                <button class="btn btn-outline-primary me-2" onclick="startAdHocCount()">Ad-Hoc Count</button>
                <button class="btn btn-outline-secondary" onclick="showHelp()">Help</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Mock data loading functions
  async loadOrderData(barcode) {
    const orders = {
      'ord_1001': {
        barcode_id: 'ord_1001',
        order_id: 1001,
        items: [
          { barcode: 'itm_501', SKU: 'SKU-RED-001', name: 'Red Widget', location: 'QM1-1-1A', qty_needed: 5 },
          { barcode: 'itm_502', SKU: 'SKU-BLU-002', name: 'Blue Widget', location: 'QM1-1-2B', qty_needed: 2 }
        ]
      },
      'ord_1002': {
        barcode_id: 'ord_1002',
        order_id: 1002,
        items: [
          { barcode: 'itm_503', SKU: 'SKU-GRN-003', name: 'Green Widget', location: 'QM2-1-1C', qty_needed: 12 }
        ]
      }
    };
    return orders[barcode];
  }

  async loadStockCountData(barcode) {
    const stockCounts = {
      'stc_2001': {
        barcode_id: 'stc_2001',
        stock_count_id: 2001,
        items: [
          { barcode: 'itm_501', SKU: 'SKU-RED-001', name: 'Red Widget', location: 'QM1-1-1A' },
          { barcode: 'itm_502', SKU: 'SKU-BLU-002', name: 'Blue Widget', location: 'QM1-1-2B' }
        ]
      }
    };
    return stockCounts[barcode];
  }

  async loadLocationData(barcode) {
    const locations = {
      'loc_3001': { barcode: 'loc_3001', location: 'QM1-1-1A', items: ['itm_501', 'itm_502'] },
      'loc_3002': { barcode: 'loc_3002', location: 'QM1-1-2B', items: [] }
    };
    return locations[barcode];
  }
}

// Global workflow manager
const workflowManager = new WorkflowManager();