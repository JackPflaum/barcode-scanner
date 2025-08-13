const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const result = document.getElementById('result');
const statusEl = document.getElementById('status');

let scanning = false;

startBtn.addEventListener('click', startScanner);
stopBtn.addEventListener('click', stopScanner);

function startScanner() {
  if (scanning) return;
  
  statusEl.textContent = 'Starting camera...'
  
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#scanner-container'),
      constraints: {
        width: { min: 640 },
        height: { min: 480 },
        facingMode: "environment",
        aspectRatio: { min: 1, max: 2 }
      }
    },
    locator: {
      patchSize: "medium",
      halfSample: true
    },
    numOfWorkers: 2,
    frequency: 10,
    decoder: {
      readers: [
        "code_128_reader",
        "ean_reader", 
        "ean_8_reader",
        "code_39_reader",
        "code_39_vin_reader",
        "codabar_reader",
        "upc_reader",
        "upc_e_reader",
        "i2of5_reader"
      ]
    },
    locate: true
  }, function(err) {
    if (err) {
      statusEl.textContent = 'Camera error: ' + err.message;
      return;
    }
    
    Quagga.start();
    scanning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    statusEl.textContent = 'Scanning... Point camera at barcode';
  });

  Quagga.onDetected(function(data) {
    result.value = data.codeResult.code;
    statusEl.textContent = 'Scan successful ✅';
    if (navigator.vibrate) navigator.vibrate(200);
  });
}

function stopScanner() {
  if (!scanning) return;
  
  Quagga.stop();
  scanning = false;
  startBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  statusEl.textContent = 'Scan stopped';
}