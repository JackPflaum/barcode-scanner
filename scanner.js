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

            // Get camera stream with torch capability
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    torch: false
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
            // Create canvas and crop to center area (simulating zoom effect)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const videoWidth = this.video.videoWidth;
            const videoHeight = this.video.videoHeight;
            
            // Get current zoom level
            const zoomLevel = parseFloat(this.zoomControl.value) || 1;
            
            // Calculate crop area (center portion based on zoom)
            const cropWidth = videoWidth / zoomLevel;
            const cropHeight = videoHeight / zoomLevel;
            const cropX = (videoWidth - cropWidth) / 2;
            const cropY = (videoHeight - cropHeight) / 2;
            
            // Set canvas size to cropped area
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            
            // Draw only the cropped portion
            ctx.drawImage(
                this.video,
                cropX, cropY, cropWidth, cropHeight,  // source crop area
                0, 0, cropWidth, cropHeight           // destination
            );
            
            // Detect barcodes from the cropped canvas
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

        // Setup software zoom control (always enabled)
        this.zoomControl.min = 1;
        this.zoomControl.max = 5;
        this.zoomControl.step = 0.1;
        this.zoomControl.value = 1;
        this.updateZoomDisplay(1);

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
        this.updateZoomDisplay(zoomLevel);
        localStorage.setItem('camera-zoom', zoomLevel);
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
        this.zoomControl.value = 1;
        this.updateZoomDisplay(1);
        localStorage.setItem('camera-zoom', 1);
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