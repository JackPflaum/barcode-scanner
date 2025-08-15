/**
 * Main Application Module
 * Coordinates scanner and workflow components
 */

// Global instances
let scanner;
let workflowManager;

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Warehouse Scanner Application');
    
    // Initialize components
    scanner = new BarcodeScanner();
    workflowManager = new WorkflowManager();
    
    // Connect scanner to workflow manager
    scanner.onScan((barcode) => {
        console.log('Barcode scanned:', barcode);
        workflowManager.handleBarcodeScan(barcode);
    });
    
    // Setup manual input
    setupManualInput();
    
    // Register service worker for PWA
    registerServiceWorker();
    
    console.log('Application initialized successfully');
});

/**
 * Setup manual barcode input functionality
 */
function setupManualInput() {
    const manualInput = document.getElementById('manual-input');
    const manualSubmit = document.getElementById('manual-submit');
    
    // Handle manual submit button
    manualSubmit.addEventListener('click', function() {
        const barcode = manualInput.value.trim();
        if (barcode) {
            console.log('Manual barcode entry:', barcode);
            workflowManager.handleBarcodeScan(barcode);
            manualInput.value = '';
        }
    });
    
    // Handle Enter key in manual input
    manualInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            manualSubmit.click();
        }
    });
    
    // Auto-focus manual input when not scanning
    manualInput.addEventListener('focus', function() {
        // Temporarily stop scanner to avoid conflicts
        if (scanner && scanner.isScanning) {
            console.log('Pausing scanner for manual input');
        }
    });
}

/**
 * Register service worker for PWA functionality
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('Service Worker registered successfully:', registration);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

/**
 * Handle application errors
 */
window.addEventListener('error', function(event) {
    console.error('Application error:', event.error);
    
    // Show user-friendly error message
    const statusArea = document.getElementById('status-area');
    if (statusArea) {
        statusArea.className = 'alert alert-danger';
        statusArea.textContent = 'An error occurred. Please refresh the page.';
    }
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

/**
 * Application lifecycle management
 */
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // App is hidden - pause scanner to save battery
        if (scanner && scanner.isScanning) {
            console.log('App hidden - pausing scanner');
        }
    } else {
        // App is visible - resume scanner if it was running
        console.log('App visible - resuming scanner');
    }
});

/**
 * Handle page unload - cleanup resources
 */
window.addEventListener('beforeunload', function() {
    if (scanner) {
        scanner.stopScanner();
    }
});

/**
 * Utility functions for global access
 */
window.appUtils = {
    /**
     * Get current application state
     */
    getAppState: function() {
        return {
            scanner: scanner ? scanner.getStatus() : null,
            workflow: workflowManager ? {
                state: workflowManager.workflowState,
                type: workflowManager.currentWorkflow
            } : null
        };
    },
    
    /**
     * Reset application to initial state
     */
    resetApp: function() {
        if (scanner) {
            scanner.stopScanner();
        }
        if (workflowManager) {
            workflowManager.resetWorkflow();
        }
        console.log('Application reset to initial state');
    },
    
    /**
     * Enable debug mode
     */
    enableDebug: function() {
        window.debugMode = true;
        console.log('Debug mode enabled');
        
        // Add debug info to status area
        const statusArea = document.getElementById('status-area');
        if (statusArea) {
            const debugInfo = document.createElement('small');
            debugInfo.className = 'text-muted d-block mt-2';
            debugInfo.textContent = 'Debug mode: ON';
            statusArea.appendChild(debugInfo);
        }
    },
    
    /**
     * Test all workflows with sample data
     */
    testWorkflows: function() {
        console.log('Testing all workflows...');
        
        // Test data
        const testSequence = [
            'ord_1001', // Start picking
            'itm_501',  // Pick item
            'stc_2001', // Should show error
            'loc_3001'  // Should show error
        ];
        
        let index = 0;
        const runTest = () => {
            if (index < testSequence.length) {
                const barcode = testSequence[index];
                console.log(`Test ${index + 1}: Scanning ${barcode}`);
                workflowManager.handleBarcodeScan(barcode);
                index++;
                setTimeout(runTest, 2000);
            } else {
                console.log('Workflow tests completed');
            }
        };
        
        runTest();
    }
};

/**
 * Keyboard shortcuts
 */
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + K: Toggle camera
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (scanner) {
            scanner.toggleCamera();
        }
    }
    
    // Escape: Cancel workflow
    if (event.key === 'Escape') {
        if (workflowManager && workflowManager.workflowState !== 'ready') {
            workflowManager.cancelWorkflow();
        }
    }
    
    // Ctrl/Cmd + R: Reset app (prevent default refresh)
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        if (workflowManager && workflowManager.workflowState !== 'ready') {
            event.preventDefault();
            window.appUtils.resetApp();
        }
    }
});

/**
 * Touch gesture support for mobile
 */
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', function(event) {
    touchStartY = event.changedTouches[0].screenY;
});

document.addEventListener('touchend', function(event) {
    touchEndY = event.changedTouches[0].screenY;
    handleSwipeGesture();
});

function handleSwipeGesture() {
    const swipeThreshold = 50;
    const swipeDistance = touchStartY - touchEndY;
    
    // Swipe up to start camera
    if (swipeDistance > swipeThreshold) {
        if (scanner && !scanner.isScanning) {
            scanner.startScanner();
        }
    }
    
    // Swipe down to stop camera
    if (swipeDistance < -swipeThreshold) {
        if (scanner && scanner.isScanning) {
            scanner.stopScanner();
        }
    }
}

/**
 * Performance monitoring
 */
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(function() {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('App load time:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
        }, 0);
    });
}

/**
 * Network status monitoring
 */
window.addEventListener('online', function() {
    console.log('Network connection restored');
});

window.addEventListener('offline', function() {
    console.log('Network connection lost - app will continue to work offline');
});