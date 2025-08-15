<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Mock API for barcode scanner workflows
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($path, '/'));

// Mock data
$orders = [
    'ord_1001' => [
        'barcode_id' => 'ord_1001',
        'order_id' => 1001,
        'items' => [
            ['barcode' => 'itm_501', 'SKU' => 'SKU-RED-001', 'name' => 'Red Widget', 'location' => 'QM1-1-1A', 'qty_needed' => 5],
            ['barcode' => 'itm_502', 'SKU' => 'SKU-BLU-002', 'name' => 'Blue Widget', 'location' => 'QM1-1-2B', 'qty_needed' => 2]
        ]
    ],
    'ord_1002' => [
        'barcode_id' => 'ord_1002',
        'order_id' => 1002,
        'items' => [
            ['barcode' => 'itm_503', 'SKU' => 'SKU-GRN-003', 'name' => 'Green Widget', 'location' => 'QM2-1-1C', 'qty_needed' => 12]
        ]
    ]
];

$stockCounts = [
    'stc_2001' => [
        'barcode_id' => 'stc_2001',
        'stock_count_id' => 2001,
        'items' => [
            ['barcode' => 'itm_501', 'SKU' => 'SKU-RED-001', 'name' => 'Red Widget', 'location' => 'QM1-1-1A'],
            ['barcode' => 'itm_502', 'SKU' => 'SKU-BLU-002', 'name' => 'Blue Widget', 'location' => 'QM1-1-2B']
        ]
    ]
];

$locations = [
    'loc_3001' => ['barcode' => 'loc_3001', 'location' => 'QM1-1-1A', 'items' => ['itm_501', 'itm_502']],
    'loc_3002' => ['barcode' => 'loc_3002', 'location' => 'QM1-1-2B', 'items' => []]
];

// Route handling
switch ($method) {
    case 'GET':
        if (isset($segments[1])) {
            $endpoint = $segments[1];
            $id = $segments[2] ?? null;
            
            switch ($endpoint) {
                case 'orders':
                    if ($id && isset($orders[$id])) {
                        echo json_encode($orders[$id]);
                    } else {
                        echo json_encode($orders);
                    }
                    break;
                    
                case 'stockcounts':
                    if ($id && isset($stockCounts[$id])) {
                        echo json_encode($stockCounts[$id]);
                    } else {
                        echo json_encode($stockCounts);
                    }
                    break;
                    
                case 'locations':
                    if ($id && isset($locations[$id])) {
                        echo json_encode($locations[$id]);
                    } else {
                        echo json_encode($locations);
                    }
                    break;
                    
                default:
                    http_response_code(404);
                    echo json_encode(['error' => 'Endpoint not found']);
            }
        } else {
            echo json_encode(['message' => 'Barcode Scanner API', 'version' => '1.0']);
        }
        break;
        
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (isset($segments[1])) {
            $endpoint = $segments[1];
            
            switch ($endpoint) {
                case 'scan':
                    // Handle barcode scan
                    $barcode = $input['barcode'] ?? '';
                    $prefix = substr($barcode, 0, 4);
                    
                    $response = ['barcode' => $barcode, 'type' => 'unknown'];
                    
                    switch ($prefix) {
                        case 'ord_':
                            $response['type'] = 'order';
                            $response['data'] = $orders[$barcode] ?? null;
                            break;
                        case 'stc_':
                            $response['type'] = 'stockcount';
                            $response['data'] = $stockCounts[$barcode] ?? null;
                            break;
                        case 'loc_':
                            $response['type'] = 'location';
                            $response['data'] = $locations[$barcode] ?? null;
                            break;
                        case 'itm_':
                            $response['type'] = 'item';
                            break;
                    }
                    
                    echo json_encode($response);
                    break;
                    
                case 'update':
                    // Handle workflow updates
                    echo json_encode(['success' => true, 'message' => 'Update processed']);
                    break;
                    
                default:
                    http_response_code(404);
                    echo json_encode(['error' => 'Endpoint not found']);
            }
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
?>