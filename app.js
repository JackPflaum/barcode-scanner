// Main Application Logic
let scannerVisible = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  // Setup scanner callback
  scanner.onScan(handleBarcodeScan);
  
  // Initialize workflow manager
  workflowManager.renderDefaultView();
});

// Scanner Controls
function toggleScanner() {
  const scannerSection = document.getElementById('scanner-section');
  const toggleText = document.getElementById('scanner-toggle-text');
  
  if (scannerVisible) {
    scannerSection.className = 'scanner-hidden';
    toggleText.textContent = 'Show Scanner';
    scanner.stop();
  } else {
    scannerSection.className = 'scanner-visible';
    toggleText.textContent = 'Hide Scanner';
  }
  
  scannerVisible = !scannerVisible;
}

async function startScanner() {
  try {
    await scanner.start();
    showNotification('Scanner started - point camera at barcode', 'success');
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

function stopScanner() {
  scanner.stop();
  showNotification('Scanner stopped', 'info');
}

function toggleSettings() {
  const settings = document.getElementById('camera-settings');
  settings.classList.toggle('d-none');
}

async function resetZoom() {
  await scanner.resetZoom();
}

async function toggleTorch() {
  await scanner.toggleTorch();
}

// Barcode Handling
async function handleBarcodeScan(barcode) {
  showNotification(`Scanned: ${barcode}`, 'info');
  
  // Add processing delay for better UX
  setTimeout(async () => {
    await workflowManager.handleBarcode(barcode);
  }, 500);
}

// Notification System
function showNotification(message, type = 'info') {
  const container = document.getElementById('notifications');
  const notification = document.createElement('div');
  
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <span>${message}</span>
      <button type="button" class="btn-close btn-close-sm" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Workflow Actions
function startAdHocCount() {
  const barcode = prompt('Scan or enter item barcode:');
  if (barcode) {
    const quantity = prompt('Enter new quantity:');
    if (quantity !== null && !isNaN(quantity)) {
      showNotification(`Ad-hoc count: ${barcode} = ${quantity}`, 'success');
    }
  }
}

function showHelp() {
  const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
  helpModal.show();
}

// Utility Functions
function clearNotifications() {
  document.getElementById('notifications').innerHTML = '';
}

// Error Handling
window.addEventListener('error', function(e) {
  console.error('Application error:', e.error);
  showNotification('An error occurred. Check console for details.', 'error');
});

// Service Worker Registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful');
      })
      .catch(function(err) {
        console.log('ServiceWorker registration failed:', err);
      });
  });
}