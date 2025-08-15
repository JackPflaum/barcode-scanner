# Warehouse Barcode Scanner

A proof-of-concept browser-based barcode scanning application for warehouse workflows, built using the Chrome BarcodeDetector API.

## Features

- **Native Barcode Detection**: Uses Chrome's BarcodeDetector API for fast, accurate scanning
- **Multiple Workflows**: Supports picking, stock counting, location moves, and returns
- **Responsive Design**: Works on mobile devices with half-screen scanner mode
- **Camera Controls**: Zoom, focus, and flashlight controls
- **PWA Ready**: Can be installed as a mobile app

## Supported Workflows

### 1. Picking Slip Workflow (`ord_` prefix)
- Scan picking slip to load order
- Scan items to track collection progress
- Manual entry for high-quantity items (>10)
- Visual progress tracking

### 2. Stock Count Workflow (`stc_` prefix)
- Scan stock count slip to load items
- Scan items and enter quantities
- Track completion progress

### 3. Location Move Workflow (`loc_` prefix)
- Scan source location
- Scan item to move
- Scan destination location
- Confirm move operation

### 4. Returns Workflow (`itm_` prefix)
- Scan item barcode
- Scan destination location
- Confirm placement

## Test Barcodes

- `ord_1001` - Sample picking order
- `ord_1002` - Sample picking order with high quantity item
- `stc_2001` - Sample stock count
- `loc_3001` - Sample location (QM1-1-1A)
- `loc_3002` - Sample location (QM1-1-2B)
- `itm_501` - Red Widget
- `itm_502` - Blue Widget
- `itm_503` - Green Widget

## Browser Requirements

- Chrome 83+ or Edge 83+ (for BarcodeDetector API)
- Camera permissions required
- HTTPS required for camera access (except localhost)

## Installation

1. Clone or download the files to your web server
2. Ensure PHP 8.3+ is available for the API backend
3. Access via HTTPS (required for camera permissions)
4. Grant camera permissions when prompted

## File Structure

```
scanner/
├── index.html          # Main application interface
├── styles.css          # Styling and responsive design
├── scanner.js          # Barcode scanner module
├── workflows.js        # Workflow management system
├── app.js             # Main application logic
├── api.php            # PHP backend API
├── manifest.json      # PWA manifest
├── sw.js              # Service worker
└── README.md          # This file
```

## Usage

1. Open the application in Chrome/Edge
2. Click "Show Scanner" to reveal camera interface
3. Click "Start Scanner" and grant camera permissions
4. Scan a barcode to begin a workflow
5. Follow on-screen instructions for each workflow type

## Camera Controls

- **Zoom**: Adjust camera zoom level (saved between sessions)
- **Reset**: Reset zoom to minimum level
- **Flashlight**: Toggle device flashlight (if supported)

## API Endpoints

- `GET /api.php/orders/{id}` - Get order data
- `GET /api.php/stockcounts/{id}` - Get stock count data
- `GET /api.php/locations/{id}` - Get location data
- `POST /api.php/scan` - Process barcode scan
- `POST /api.php/update` - Update workflow data

## Development Notes

- Uses Bootstrap 5 for responsive UI
- Modular JavaScript architecture
- Mock data for POC testing
- Service worker for offline capabilities
- Local storage for camera settings

## Future Enhancements

- Real database integration
- User authentication
- Advanced reporting
- Batch operations
- Voice feedback
- Barcode generation