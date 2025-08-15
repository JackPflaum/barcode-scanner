// Scanner Module
class BarcodeScanner {
  constructor() {
    this.isScanning = false;
    this.stream = null;
    this.videoTrack = null;
    this.barcodeDetector = null;
    this.scanInterval = null;
    this.lastScanTime = 0;
    this.scanCooldown = 750;
    this.onScanCallback = null;
  }

  async init() {
    if (!('BarcodeDetector' in window)) {
      throw new Error('BarcodeDetector API not supported. Use Chrome 83+ or Edge 83+');
    }

    this.barcodeDetector = new BarcodeDetector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'data_matrix']
    });
  }

  async start() {
    if (this.isScanning) return;

    try {
      await this.init();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      const video = document.getElementById('video');
      video.srcObject = this.stream;
      this.videoTrack = this.stream.getVideoTracks()[0];

      this.setupCameraControls();
      this.startScanLoop();

      this.isScanning = true;
      this.updateUI();

    } catch (error) {
      throw new Error(`Camera access failed: ${error.message}`);
    }
  }

  stop() {
    if (!this.isScanning) return;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    this.isScanning = false;
    this.updateUI();
  }

  startScanLoop() {
    this.scanInterval = setInterval(async () => {
      try {
        const now = Date.now();
        if (now - this.lastScanTime < this.scanCooldown) {
          return;
        }

        const video = document.getElementById('video');
        const barcodes = await this.barcodeDetector.detect(video);

        if (barcodes.length > 0) {
          const barcode = barcodes[0];
          this.lastScanTime = now;
          this.handleScan(barcode.rawValue);
          
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        }
      } catch (error) {
        console.error('Scan detection error:', error);
      }
    }, 200);
  }

  handleScan(barcode) {
    if (this.onScanCallback) {
      this.onScanCallback(barcode);
    }
  }

  onScan(callback) {
    this.onScanCallback = callback;
  }

  updateUI() {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    if (this.isScanning) {
      startBtn.classList.add('d-none');
      stopBtn.classList.remove('d-none');
    } else {
      startBtn.classList.remove('d-none');
      stopBtn.classList.add('d-none');
    }
  }

  setupCameraControls() {
    if (!this.videoTrack) return;

    const capabilities = this.videoTrack.getCapabilities();
    
    if (capabilities.zoom) {
      const zoomSlider = document.getElementById('zoom');
      zoomSlider.min = capabilities.zoom.min;
      zoomSlider.max = capabilities.zoom.max;
      zoomSlider.step = capabilities.zoom.step || 0.1;

      const savedZoom = localStorage.getItem('cameraZoom') || capabilities.zoom.min;
      zoomSlider.value = savedZoom;
      document.getElementById('zoom-value').textContent = savedZoom + 'x';

      this.videoTrack.applyConstraints({
        advanced: [{ zoom: parseFloat(savedZoom) }]
      }).catch(err => console.error('Apply saved zoom error:', err));

      zoomSlider.addEventListener('input', async (e) => {
        try {
          await this.videoTrack.applyConstraints({
            advanced: [{ zoom: parseFloat(e.target.value) }]
          });
          document.getElementById('zoom-value').textContent = e.target.value + 'x';
          localStorage.setItem('cameraZoom', e.target.value);
        } catch (err) {
          console.error('Zoom error:', err);
        }
      });
    }
  }

  async resetZoom() {
    if (!this.videoTrack) return;

    try {
      const capabilities = this.videoTrack.getCapabilities();
      const minZoom = capabilities.zoom ? capabilities.zoom.min : 1;

      await this.videoTrack.applyConstraints({
        advanced: [{ zoom: minZoom }]
      });

      document.getElementById('zoom').value = minZoom;
      document.getElementById('zoom-value').textContent = minZoom + 'x';
      localStorage.setItem('cameraZoom', minZoom);
    } catch (err) {
      console.error('Reset zoom error:', err);
    }
  }

  async toggleTorch() {
    if (!this.videoTrack) return;

    try {
      const capabilities = this.videoTrack.getCapabilities();
      if (capabilities.torch) {
        const settings = this.videoTrack.getSettings();
        await this.videoTrack.applyConstraints({
          advanced: [{ torch: !settings.torch }]
        });
      } else {
        showNotification('Flashlight not supported on this device', 'warning');
      }
    } catch (err) {
      console.error('Torch error:', err);
    }
  }
}

// Global scanner instance
const scanner = new BarcodeScanner();