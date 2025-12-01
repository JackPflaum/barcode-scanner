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
            // 1️⃣ Create BarcodeDetector
            this.barcodeDetector = new BarcodeDetector({
                formats: [
                    'code_128', 'code_39', 'ean_13', 'ean_8',
                    'upc_a', 'upc_e', 'qr_code', 'data_matrix'
                ]
            });
            this.showDebug('QM2: BarcodeDetector created');

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
            this.focusInterval = setInterval(async () => {
                if (!this.videoTrack) return;
                try {
                    const caps = this.videoTrack.getCapabilities();
                    if (caps.focusMode && caps.focusMode.includes("continuous")) {
                        await this.videoTrack.applyConstraints({
                            advanced: [{ focusMode: "continuous" }]
                        });
                        this.showDebug("QM2: Focus nudged");
                    }
                } catch (err) {
                    // Silent fail for focus nudging
                }
            }, 3000);

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
        if (this.focusInterval) {
            clearInterval(this.focusInterval);
            this.focusInterval = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.videoTrack = null;
        this.video.srcObject = null;
    }

    async scanLoop() {
        if (!this.isScanning) return;
        if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
            requestAnimationFrame(() => this.scanLoop());
            return;
        }

        try {
            // Show scan attempts every 60 loops
            this.scanAttempts = (this.scanAttempts || 0) + 1;
            if (this.scanAttempts % 60 === 0) {
                this.showDebug(`QM2: Scanning... ${this.scanAttempts}`);
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
            const barcodes = await this.barcodeDetector.detect(canvas);
            if (barcodes.length > 0) {
                const now = Date.now();
                if (now - this.lastScanTime >= this.cooldown) {
                    this.lastScanTime = now;

                    const barcode = barcodes[0]; // or pick most centered
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    this.showDebug(`QM2 SUCCESS: ${barcode.rawValue}`);
                    this.onScan(barcode.rawValue);
                }
            }
        } catch (error) {
            this.showDebug(`QM2 Error: ${error.message}`);
        }

        // ▪️ Repeat loop
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