const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const result = document.getElementById('result');
const statusEl = document.getElementById('status');

let scanning = false;

startBtn.addEventListener('click', startScanner);
stopBtn.addEventListener('click', stopScanner);

function startScanner() {
  if (scanning) return;
  
  result.value = ''; // Clear previous scan result
  statusEl.textContent = 'Starting camera...'
  
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#scanner-container'),
      constraints: {
        width: 640,
        height: 480,
        facingMode: "environment",
        focusMode: "continuous",
        advanced: [{
          focusMode: "continuous"
        }, {
          focusDistance: { ideal: 0.3 }
        }]
      }
    },
    locator: {
      patchSize: "medium",
      halfSample: true
    },
    numOfWorkers: 1,
    decoder: {
      readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"]
    }
  }, function(err) {
    if (err) {
      console.error('Quagga init error:', err);
      statusEl.textContent = 'Camera error: ' + err.message;
      return;
    }
    
    console.log('Quagga initialized successfully');
    
    Quagga.start();
    scanning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    statusEl.textContent = 'Scanning... Point camera at barcode';
  });

  Quagga.onDetected(function(data) {
    console.log('Barcode detected:', data.codeResult.code);
    console.log('Full data:', data);
    result.value = data.codeResult.code;
    statusEl.textContent = 'Scan successful ✅';
    if (navigator.vibrate) navigator.vibrate(200);
  });
  
  let frameCount = 0;
  Quagga.onProcessed(function(result) {
    frameCount++;
    if (frameCount % 30 === 0) { // Log every 30 frames to reduce spam
      console.log('Processed', frameCount, 'frames');
    }
    if (result && result.boxes && result.boxes.length > 0) {
      console.log('FOUND POTENTIAL BARCODE! Boxes:', result.boxes.length);
    }
    if (result && result.codeResult) {
      console.log('Code result found but not finalized:', result.codeResult);
    }
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