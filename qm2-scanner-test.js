/**
 * QM2 Barcode Scanner Utility - Test Implementation
 * This is the QM2 version for comparison testing
 */

class QM2BarcodeScanner {
    constructor(videoElementId, onScan, onError) {
        this.video = document.getElementById(videoElementId);
        this.onScan = onScan;
        this.onError = onError || ((err) => console.error(err));
        this.stream = null;
        this.isScanning = false;
        this.barcodeDetector = null;
        this.lastScan = null;
        this.lastScanTime = 0;
        this.cooldown = 1000;
    }

    async start() {
        if (this.isScanning) return;

        if (!('BarcodeDetector' in window)) {
            this.onError('Barcode scanning not supported. Use Android Chrome/Edge.');
            return;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            this.video.srcObject = this.stream;
            this.barcodeDetector = new BarcodeDetector({
                formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code']
            });
            this.showDebug('QM2: BarcodeDetector created');

            this.video.addEventListener('loadedmetadata', () => {
                this.showDebug(`QM2: Video ready: ${this.video.videoWidth}x${this.video.videoHeight}`);
                this.isScanning = true;
                this.scanLoop();
            }, { once: true });

        } catch (error) {
            this.onError(error.name === 'NotAllowedError' 
                ? 'Camera permission denied' 
                : 'Failed to access camera: ' + error.message);
        }
    }

    stop() {
        this.isScanning = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
    }

    async scanLoop() {
        if (!this.isScanning) return;

        try {
            // Check if video is ready
            if (this.video.readyState < 2) {
                requestAnimationFrame(() => this.scanLoop());
                return;
            }

            // Show scan attempts every 30 loops
            this.scanAttempts = (this.scanAttempts || 0) + 1;
            if (this.scanAttempts % 30 === 0) {
                this.showDebug(`QM2: Scanning... ${this.scanAttempts} attempts`);
            }

            let barcodes = [];
            
            // Try direct video detection first
            try {
                barcodes = await this.barcodeDetector.detect(this.video);
                if (barcodes.length > 0) this.showDebug(`QM2 Direct: ${barcodes.length} found`);
            } catch (directError) {
                // Silent fail for direct detection
            }
            
            // Try larger crop area for 1D barcodes (they need more width)
            if (barcodes.length === 0 && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
                try {
                    const videoWidth = this.video.videoWidth;
                    const videoHeight = this.video.videoHeight;
                    const scanWidth = videoWidth * 0.8;  // Wider for 1D barcodes
                    const scanHeight = videoHeight * 0.4; // Taller for 1D barcodes
                    const scanX = (videoWidth - scanWidth) / 2;
                    const scanY = (videoHeight - scanHeight) / 2;

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        canvas.width = scanWidth;
                        canvas.height = scanHeight;

                        ctx.drawImage(
                            this.video,
                            scanX, scanY, scanWidth, scanHeight,
                            0, 0, scanWidth, scanHeight
                        );

                        barcodes = await this.barcodeDetector.detect(canvas);
                        if (barcodes.length > 0) this.showDebug(`QM2 Crop: ${barcodes.length} found`);
                    }
                } catch (cropError) {
                    // Silent fail for crop detection
                }
            }
            
            if (barcodes.length > 0) {
                const now = Date.now();
                const barcode = barcodes[0].rawValue;
                this.showDebug(`QM2 SUCCESS: ${barcode}`);
                
                if (this.lastScan !== barcode || (now - this.lastScanTime) > this.cooldown) {
                    this.lastScan = barcode;
                    this.lastScanTime = now;
                    this.onScan(barcode);
                }
            }
        } catch (error) {
            this.showDebug(`QM2 Error: ${error.message}`);
        }

        if (this.isScanning) {
            requestAnimationFrame(() => this.scanLoop());
        }
    }

    showDebug(message) {
        // Create or update debug overlay
        let debugEl = document.getElementById('qm2-scanner-debug');
        if (!debugEl) {
            debugEl = document.createElement('div');
            debugEl.id = 'qm2-scanner-debug';
            debugEl.style.cssText = `
                position: fixed;
                top: 50px;
                left: 10px;
                background: rgba(0,0,255,0.9);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-size: 14px;
                font-weight: bold;
                z-index: 99999;
                max-width: 250px;
                word-wrap: break-word;
                border: 2px solid white;
            `;
            document.body.appendChild(debugEl);
        }
        debugEl.style.display = 'block';
        debugEl.textContent = message;
        
        // Auto-hide after 5 seconds (longer)
        clearTimeout(this.debugTimeout);
        this.debugTimeout = setTimeout(() => {
            if (debugEl) debugEl.style.display = 'none';
        }, 5000);
    }
}