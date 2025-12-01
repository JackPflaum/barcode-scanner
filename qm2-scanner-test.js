/**
 * QM2 Barcode Scanner Utility - Ultra Simple Implementation
 * Based on the working ultra-simple approach
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
        this.cooldown = 500; // Faster response
    }

    async start() {
        if (this.isScanning) return;

        if (!('BarcodeDetector' in window)) {
            this.onError('Barcode scanning not supported. Use Android Chrome/Edge.');
            return;
        }

        try {
            this.showDebug('QM2: Starting...');
            
            // Use default formats (like ultra-simple)
            this.barcodeDetector = new BarcodeDetector();
            this.showDebug('QM2: Detector created');

            // Simple camera stream
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            this.video.srcObject = this.stream;
            this.showDebug('QM2: Camera started');

            this.isScanning = true;
            this.scanLoop();

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
        this.showDebug('QM2: Stopped');
    }

    async scanLoop() {
        if (!this.isScanning) return;

        try {
            // Direct video detection (like ultra-simple)
            const barcodes = await this.barcodeDetector.detect(this.video);
            if (barcodes.length > 0) {
                const now = Date.now();
                if (now - this.lastScanTime >= this.cooldown) {
                    this.lastScanTime = now;
                    
                    const barcode = barcodes[0];
                    const code = barcode.rawValue;
                    const format = barcode.format;
                    
                    this.showDebug(`QM2: ${format} - ${code}`);
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    this.onScan(code);
                }
            }
        } catch (error) {
            this.showDebug(`QM2 Error: ${error.message}`);
        }

        // Fast loop (like ultra-simple)
        setTimeout(() => this.scanLoop(), 100);
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