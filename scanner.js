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
        this._scanCount = 0; // Track scans for focus nudging
        
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

    // /**
    //  * Start barcode scanner
    //  */
    // async startScanner() {
    //     if (this.isScanning || !this.checkBrowserSupport()) return;

    //     try {
    //         // Create barcode detector
    //         this.barcodeDetector = new BarcodeDetector({
    //             formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'data_matrix']
    //         });

    //         // Get camera stream with torch capability
    //         this.stream = await navigator.mediaDevices.getUserMedia({
    //             video: {
    //                 facingMode: 'environment',
    //                 width: { ideal: 1280 },
    //                 height: { ideal: 720 },
    //                 torch: false,
    //                 focusMode: 'continuous'
    //             }
    //         });

    //         this.video.srcObject = this.stream;
    //         this.videoTrack = this.stream.getVideoTracks()[0];

    //         // Setup camera controls
    //         // this.setupCameraControls();

    //         // Wait for video to be ready before starting scan loop
    //         this.video.addEventListener('loadedmetadata', () => {
    //             this.scanInterval = setInterval(() => this.detectBarcodes(), 300);
    //         }, { once: true });

    //         this.isScanning = true;
    //         this.toggleButton.textContent = 'Stop Camera';
    //         this.cameraContainer.style.display = 'block';

    //         console.log('Scanner started successfully');

    //     } catch (error) {
    //         console.error('Failed to start scanner:', error);
    //         this.showError('Failed to access camera: ' + error.message);
    //     }
    // }





/**
 * Start barcode scanner with center detection + preprocessing + safe focus nudging
 */
async startScanner() {
    if (this.isScanning || !this.checkBrowserSupport()) return;

    try {
        // 1️⃣ Create BarcodeDetector
        this.barcodeDetector = new BarcodeDetector({
            formats: [
                'code_128', 'code_39', 'ean_13', 'ean_8',
                'upc_a', 'upc_e', 'qr_code', 'data_matrix'
            ]
        });

        // 2️⃣ Get camera stream
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                focusMode: 'continuous' // safe, will no-op if unsupported
            }
        });

        this.video.srcObject = this.stream;
        this.videoTrack = this.stream.getVideoTracks()[0];

        // 3️⃣ Focus nudge interval (safe)
        setInterval(async () => {
            if (!this.videoTrack) return;
            try {
                const caps = this.videoTrack.getCapabilities();
                if (caps.focusMode && caps.focusMode.includes("continuous")) {
                    await this.videoTrack.applyConstraints({
                        advanced: [{ focusMode: "continuous" }]
                    });
                    console.log("[focus] nudged continuous AF");
                }
            } catch (err) {
                console.log("[focus] AF nudge failed:", err);
            }
        }, 3000);

        // 4️⃣ Start detection loop when video is ready
        this.video.addEventListener('loadedmetadata', () => {
            const scanLoop = async () => {
                if (!this.isScanning) return;
                if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
                    requestAnimationFrame(scanLoop);
                    return;
                }

                // ▪️ Crop to center area
                const videoWidth = this.video.videoWidth;
                const videoHeight = this.video.videoHeight;
                const scanWidth = videoWidth * 0.4;
                const scanHeight = videoHeight * 0.3;
                const scanX = (videoWidth - scanWidth) / 2;
                const scanY = (videoHeight - scanHeight) / 2;

                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = scanWidth;
                canvas.height = scanHeight;

                ctx.drawImage(
                    this.video,
                    scanX, scanY, scanWidth, scanHeight,
                    0, 0, scanWidth, scanHeight
                );

                // ▪️ Preprocessing: grayscale + simple sharpening + threshold
                const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
                const data = imageData.data;
                const copy = new Uint8ClampedArray(data);

                // Grayscale
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i+1] + data[i+2]) / 3;
                    data[i] = data[i+1] = data[i+2] = avg;
                }

                // Simple sharpening
                function idx(x, y) { return (y * scanWidth + x) * 4; }
                for (let y = 1; y < scanHeight - 1; y++) {
                    for (let x = 1; x < scanWidth - 1; x++) {
                        const i = idx(x, y);
                        for (let c = 0; c < 3; c++) {
                            const val =
                                - copy[idx(x-1, y)+c] +
                                - copy[idx(x+1, y)+c] +
                                - copy[idx(x, y-1)+c] +
                                - copy[idx(x, y+1)+c] +
                                5 * copy[i + c];
                            data[i + c] = Math.max(0, Math.min(255, val));
                        }
                    }
                }

                // Threshold
                const threshold = 128;
                for (let i = 0; i < data.length; i += 4) {
                    const v = data[i] > threshold ? 255 : 0;
                    data[i] = data[i+1] = data[i+2] = v;
                }

                ctx.putImageData(imageData, 0, 0);

                // ▪️ Detect barcodes
                try {
                    const barcodes = await this.barcodeDetector.detect(canvas);
                    if (barcodes.length > 0) {
                        const now = Date.now();
                        if (now - this.lastScanTime >= this.scanCooldown) {
                            this.lastScanTime = now;

                            const barcode = barcodes[0]; // or pick most centered
                            this.showScanSuccess?.();
                            this.showScanTargetDetection?.();
                            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                            this.onScanCallback?.(barcode.rawValue);
                            console.log("Detected barcode:", barcode.rawValue);
                        }
                    }
                } catch (e) {
                    if (e.name === "NotSupportedError") {
                        // Retry after short delay
                        setTimeout(() => scanLoop(), 100);
                        return;
                    } else {
                        console.error("Detection error:", e);
                    }
                }

                // ▪️ Repeat loop
                requestAnimationFrame(scanLoop);
            };

            scanLoop();
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
     * Detect barcodes in video stream - center area only
     */
    async detectBarcodes() {
        if (!this.barcodeDetector || !this.video || this.video.readyState !== 4) return;

        try {
            // Create canvas for center area only
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const videoWidth = this.video.videoWidth;
            const videoHeight = this.video.videoHeight;
            
            // Fixed center scan area (40% width, 30% height)
            const scanWidth = videoWidth * 0.4;
            const scanHeight = videoHeight * 0.3;
            const scanX = (videoWidth - scanWidth) / 2;
            const scanY = (videoHeight - scanHeight) / 2;
            
            // Set canvas to scan area size
            canvas.width = scanWidth;
            canvas.height = scanHeight;
            
            // Draw only the center area
            ctx.drawImage(
                this.video,
                scanX, scanY, scanWidth, scanHeight,  // source: center area
                0, 0, scanWidth, scanHeight           // destination: full canvas
            );
            
            // Detect barcodes only in center area
            const barcodes = await this.barcodeDetector.detect(canvas);
            
            if (barcodes.length > 0) {
                const now = Date.now();
                if (now - this.lastScanTime < this.scanCooldown) return;

                // Find the most centered barcode
                const centerX = scanWidth / 2;
                const centerY = scanHeight / 2;
                
                let closestBarcode = barcodes[0];
                let minDistance = Infinity;
                
                for (const bc of barcodes) {
                    const bcCenterX = bc.boundingBox.x + bc.boundingBox.width / 2;
                    const bcCenterY = bc.boundingBox.y + bc.boundingBox.height / 2;
                    const distance = Math.sqrt(
                        Math.pow(bcCenterX - centerX, 2) + Math.pow(bcCenterY - centerY, 2)
                    );
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestBarcode = bc;
                    }
                }
                
                const barcode = closestBarcode;
                this.lastScanTime = now;
                
                // Visual feedback
                this.showScanSuccess();
                this.showScanTargetDetection();
                
                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }

                // Callback to main application
                if (this.onScanCallback) {
                    this.onScanCallback(barcode.rawValue);
                }

                console.log('Barcode detected in center area:', barcode.rawValue);
                
                // Focus nudging every 5 scans
                if (this.videoTrack && this.videoTrack.getCapabilities().focusDistance) {
                    this._scanCount++;
                    if (this._scanCount % 5 === 0) {
                        try {
                            await this.videoTrack.applyConstraints({
                                advanced: [{ focusMode: 'manual', focusDistance: 0.1 }]
                            });
                            console.log('Focus nudged after', this._scanCount, 'scans');
                        } catch (e) {
                            console.warn('Focus nudge failed:', e);
                        }
                    }
                }
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
     * Show scan target detection feedback
     */
    showScanTargetDetection() {
        const scanTarget = document.getElementById('scan-target');
        if (scanTarget) {
            scanTarget.classList.add('detected');
            setTimeout(() => {
                scanTarget.classList.remove('detected');
            }, 1000);
        }
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