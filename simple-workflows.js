// Simple Workflow System
class SimpleWorkflowManager {
  constructor() {
    this.activeWorkflow = null;
    this.workflowData = null;
  }

  handleScan(barcode) {
    const prefix = barcode.substring(0, 4);
    
    // If no workflow is active, start new workflow
    if (!this.activeWorkflow) {
      this.startNewWorkflow(barcode, prefix);
      return;
    }
    
    // Handle active workflow
    if (this.activeWorkflow === 'picking') {
      this.handlePickingScan(barcode, prefix);
    }
  }
  
  startNewWorkflow(barcode, prefix) {
    if (prefix === 'ord_') {
      this.startPickingWorkflow(barcode);
    } else {
      showNotification(`Unknown barcode: ${barcode}`, 'error');
    }
  }
  
  startPickingWorkflow(barcode) {
    const orderData = this.getOrderData(barcode);
    if (!orderData) {
      showNotification(`Order not found: ${barcode}`, 'error');
      return;
    }
    
    this.activeWorkflow = 'picking';
    this.workflowData = orderData;
    
    // Show cancel button
    document.getElementById('cancel-workflow-btn').classList.remove('d-none');
    
    // Show confirmation and order items
    showNotification(`Order ${orderData.order_id} loaded`, 'success');
    this.renderPickingView();
  }
  
  handlePickingScan(barcode, prefix) {
    // Only accept item barcodes during picking
    if (prefix !== 'itm_') {
      showNotification('Item doesn\'t exist in order', 'error');
      return;
    }
    
    // Find item in order
    const item = this.workflowData.items.find(i => i.barcode === barcode);
    if (!item) {
      showNotification('Item doesn\'t appear in the order', 'error');
      return;
    }
    
    // Increment quantity
    if (!item.picked) item.picked = 0;
    if (item.picked < item.needed) {
      item.picked++;
      showNotification(`${item.name}: ${item.picked}/${item.needed} picked`, 'success');
      this.renderPickingView();
      this.checkOrderComplete();
    } else {
      showNotification(`${item.name} already complete`, 'warning');
    }
  }
  
  checkOrderComplete() {
    const allComplete = this.workflowData.items.every(item => 
      (item.picked || 0) >= item.needed
    );
    
    if (allComplete) {
      showNotification('All items collected! Click Complete Order to finish.', 'success');
    }
  }
  
  renderPickingView() {
    const content = document.getElementById('workflow-content');
    const items = this.workflowData.items;
    const allComplete = items.every(item => (item.picked || 0) >= item.needed);
    
    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h5>📋 Picking Order ${this.workflowData.order_id}</h5>
        </div>
        <div class="card-body">
          ${items.map(item => {
            const picked = item.picked || 0;
            const isComplete = picked >= item.needed;
            return `
              <div class="item ${isComplete ? 'complete' : 'pending'}" style="padding: 10px; margin: 5px 0; border-left: 4px solid ${isComplete ? '#28a745' : '#ffc107'}; background: ${isComplete ? '#d4edda' : '#fff3cd'};">
                <strong>${item.name}</strong><br>
                <small>SKU: ${item.sku} | Location: ${item.location}</small><br>
                <span>Picked: ${picked}/${item.needed} ${isComplete ? '✅' : '⏳'}</span>
              </div>
            `;
          }).join('')}
          
          <div class="mt-3 text-center">
            ${allComplete ? '<button class="btn btn-success me-2" onclick="simpleWorkflow.completeOrder()">Complete Order</button>' : ''}
            <button class="btn btn-outline-danger" onclick="simpleWorkflow.cancelWorkflow()">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }
  
  completeOrder() {
    showNotification('Order completed successfully!', 'success');
    this.resetWorkflow();
  }
  
  cancelWorkflow() {
    showNotification('Workflow cancelled', 'info');
    this.resetWorkflow();
  }
  
  resetWorkflow() {
    this.activeWorkflow = null;
    this.workflowData = null;
    
    // Hide cancel button
    document.getElementById('cancel-workflow-btn').classList.add('d-none');
    
    // Show default view
    document.getElementById('workflow-content').innerHTML = `
      <div class="card">
        <div class="card-body text-center">
          <h5>Ready to Scan</h5>
          <p class="text-muted">Scan a barcode to begin a workflow</p>
        </div>
      </div>
    `;
  }
  
  getOrderData(barcode) {
    const orders = {
      'ord_1001': {
        order_id: 1001,
        items: [
          { barcode: 'itm_501', name: 'Red Widget', sku: 'SKU-RED-001', location: 'QM1-1-1A', needed: 5 },
          { barcode: 'itm_502', name: 'Blue Widget', sku: 'SKU-BLU-002', location: 'QM1-1-2B', needed: 2 }
        ]
      },
      'ord_1002': {
        order_id: 1002,
        items: [
          { barcode: 'itm_503', name: 'Green Widget', sku: 'SKU-GRN-003', location: 'QM2-1-1C', needed: 12 }
        ]
      }
    };
    return orders[barcode];
  }
}

// Create global instance
const simpleWorkflow = new SimpleWorkflowManager();