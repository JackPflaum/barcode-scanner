/**
 * Barcode Scanner Module
 * Handles camera access, barcode detection, and camera controls
 */

class BarcodeScanner {
    constructor() {
        this.isScanning = false;
        this.stream = null;
        this.videoTrack = null;
        this.barcodeDetector = null;
        this.scanInterval = null;
        this.lastScanTime = 0;
        this.scanCooldown = 1000; // Prevent duplicate scans
        this.onScanCallback = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkBrowserSupport();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.video = document.getElementById('video');
        this.toggleButton = document.getElementById('mobile-camera-toggle');
        this.cameraContainer = document.getElementById('camera-container');
        this.zoomControl = document.getElementById('zoom-control');
        this.zoomValue = document.getElementById('zoom-value');
        this.flashlightToggle = document.getElementById('flashlight-toggle');
        this.resetZoomButton = document.getElementById('reset-zoom');
    }

    /**
     * Setup event listeners for camera controls
     */
    setupEventListeners() {
        this.toggleButton.addEventListener('click', () => this.toggleCamera());
        this.zoomControl.addEventListener('input', (e) => this.handleZoomChange(e));
        this.flashlightToggle.addEventListener('click', () => this.toggleFlashlight());
        this.resetZoomButton.addEventListener('click', () => this.resetZoom());
        

    }

    /**
     * Check if browser supports barcode detection
     */
    checkBrowserSupport() {
        if (!('BarcodeDetector' in window)) {
            console.warn('BarcodeDetector API not supported');
            this.showError('Your browser doesn\'t support barcode detection. Please use Chrome 83+ or Edge 83+');
            return false;
        }
        return true;
    }

    /**
     * Toggle camera on/off
     */
    async toggleCamera() {
        if (this.isScanning) {
            this.stopScanner();
        } else {
            await this.startScanner();
        }
    }

    /**
     * Start barcode scanner
     */
    async startScanner() {
        if (this.isScanning || !this.checkBrowserSupport()) return;

        try {
            // Create barcode detector
            this.barcodeDetector = new BarcodeDetector({
                formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'data_matrix']
            });

            // Get camera stream
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.video.srcObject = this.stream;
            this.videoTrack = this.stream.getVideoTracks()[0];

            // Setup camera controls
            this.setupCameraControls();

            // Wait for video to be ready before starting scan loop
            this.video.addEventListener('loadedmetadata', () => {
                this.scanInterval = setInterval(() => this.detectBarcodes(), 300);
            }, { once: true });

            this.isScanning = true;
            this.toggleButton.textContent = 'Stop Camera';
            this.cameraContainer.style.display = 'block';

            console.log('Scanner started successfully');

        } catch (error) {
            console.error('Failed to start scanner:', error);
            this.showError('Failed to access camera: ' + error.message);
        }
    }

    /**
     * Stop barcode scanner
     */
    stopScanner() {
        if (!this.isScanning) return;

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.videoTrack = null;
        this.isScanning = false;
        this.toggleButton.textContent = 'Start Camera';
        this.cameraContainer.style.display = 'none';

        console.log('Scanner stopped');
    }

    /**
     * Detect barcodes in video stream
     */
    async detectBarcodes() {
        if (!this.barcodeDetector || !this.video || this.video.readyState !== 4) return;

        try {
            // Create canvas to capture current video frame
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            
            // Draw current video frame to canvas
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
            
            // Detect barcodes from the canvas (which reflects the actual displayed frame)
            const barcodes = await this.barcodeDetector.detect(canvas);
            
            if (barcodes.length > 0) {
                const now = Date.now();
                if (now - this.lastScanTime < this.scanCooldown) return;

                const barcode = barcodes[0];
                this.lastScanTime = now;
                
                // Visual feedback
                this.showScanSuccess();
                
                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }

                // Callback to main application
                if (this.onScanCallback) {
                    this.onScanCallback(barcode.rawValue);
                }

                console.log('Barcode detected:', barcode.rawValue);
            }
        } catch (error) {
            // Silently handle detection errors to prevent flickering
            if (error.name !== 'InvalidStateError') {
                console.error('Barcode detection error:', error);
            }
        }
    }

    /**
     * Setup camera controls based on capabilities
     */
    setupCameraControls() {
        if (!this.videoTrack) return;

        const capabilities = this.videoTrack.getCapabilities();
        console.log('Camera capabilities:', capabilities);

        // Setup zoom control
        if (capabilities.zoom) {
            this.zoomControl.min = capabilities.zoom.min;
            this.zoomControl.max = capabilities.zoom.max;
            this.zoomControl.step = capabilities.zoom.step || 0.1;

            // Load saved zoom level
            const savedZoom = localStorage.getItem('camera-zoom') || capabilities.zoom.min;
            this.zoomControl.value = savedZoom;
            this.updateZoomDisplay(savedZoom);
            this.applyZoom(parseFloat(savedZoom));
        } else {
            this.zoomControl.disabled = true;
        }

        // Setup flashlight control
        if (!capabilities.torch) {
            this.flashlightToggle.disabled = true;
            this.flashlightToggle.textContent = '💡 Not Available';
        } else {
            this.flashlightToggle.disabled = false;
            this.flashlightToggle.textContent = '💡 OFF';
        }
    }

    /**
     * Handle zoom control changes
     */
    async handleZoomChange(event) {
        const zoomLevel = parseFloat(event.target.value);
        await this.applyZoom(zoomLevel);
        this.updateZoomDisplay(zoomLevel);
        localStorage.setItem('camera-zoom', zoomLevel);
    }

    /**
     * Apply zoom constraint to camera
     */
    async applyZoom(zoomLevel) {
        if (!this.videoTrack) return;

        try {
            await this.videoTrack.applyConstraints({
                advanced: [{ zoom: zoomLevel }]
            });
            
            // Small delay to ensure zoom is applied before next detection
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Failed to apply zoom:', error);
        }
    }

    /**
     * Update zoom display value
     */
    updateZoomDisplay(zoomLevel) {
        this.zoomValue.textContent = zoomLevel + 'x';
        
        // Update slider background
        const percent = ((zoomLevel - this.zoomControl.min) / (this.zoomControl.max - this.zoomControl.min)) * 100;
        this.zoomControl.style.setProperty('--zoom-percent', percent + '%');
    }

    /**
     * Reset zoom to minimum level
     */
    async resetZoom() {
        if (!this.videoTrack) return;

        const capabilities = this.videoTrack.getCapabilities();
        if (capabilities.zoom) {
            const minZoom = capabilities.zoom.min;
            this.zoomControl.value = minZoom;
            await this.applyZoom(minZoom);
            this.updateZoomDisplay(minZoom);
            localStorage.setItem('camera-zoom', minZoom);
        }
    }

    /**
     * Toggle device flashlight
     */
    async toggleFlashlight() {
        if (!this.videoTrack) {
            this.flashlightToggle.textContent = '💡 No Camera';
            return;
        }

        try {
            const capabilities = this.videoTrack.getCapabilities();
            
            if (!capabilities.torch) {
                this.flashlightToggle.textContent = '💡 Not Supported';
                return;
            }

            const settings = this.videoTrack.getSettings();
            const newTorchState = !settings.torch;

            await this.videoTrack.applyConstraints({
                advanced: [{ torch: newTorchState }]
            });

            // Update button appearance
            if (newTorchState) {
                this.flashlightToggle.classList.add('flashlight-active');
                this.flashlightToggle.textContent = '💡 ON';
            } else {
                this.flashlightToggle.classList.remove('flashlight-active');
                this.flashlightToggle.textContent = '💡 OFF';
            }

        } catch (error) {
            this.flashlightToggle.textContent = '💡 Error: ' + error.name;
            // Try alternative approach
            try {
                await this.videoTrack.applyConstraints({
                    torch: !this.videoTrack.getSettings().torch
                });
                this.flashlightToggle.textContent = '💡 ON (Alt)';
            } catch (altError) {
                this.flashlightToggle.textContent = '💡 Failed';
            }
        }
    }

    /**
     * Show visual feedback for successful scan
     */
    showScanSuccess() {
        this.video.classList.add('scan-success');
        setTimeout(() => {
            this.video.classList.remove('scan-success');
        }, 500);
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('Scanner error:', message);
        const statusArea = document.getElementById('status-area');
        if (statusArea) {
            statusArea.className = 'alert alert-danger';
            statusArea.textContent = message;
        }
    }

    /**
     * Set callback for barcode scan events
     */
    onScan(callback) {
        this.onScanCallback = callback;
    }

    /**
     * Get current scanner status
     */
    getStatus() {
        return {
            isScanning: this.isScanning,
            hasCamera: !!this.stream,
            supportsBarcode: 'BarcodeDetector' in window
        };
    }
}