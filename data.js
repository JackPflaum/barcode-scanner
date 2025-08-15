/**
 * Mock Data for Warehouse Scanner Application
 * Contains test data for orders, stock counts, locations, and items
 */

// Orders Data - Picking Workflow
const ORDERS = {
    'ord_1001': {
        order_id: 1001,
        customer: 'ACME Corp',
        items: [
            {
                barcode: '34623636436',
                name: 'Red Widget',
                sku: 'SKU-RED-001',
                location: 'QM1-1-1A',
                quantity_needed: 5,
                quantity_picked: 0
            },
            {
                barcode: '354#%&23_23',
                name: 'Blue Widget',
                sku: 'SKU-BLUE-002',
                location: 'QM1-1-2B',
                quantity_needed: 2,
                quantity_picked: 0
            }
        ]
    },
    'ord_1002': {
        order_id: 1002,
        customer: 'TechCorp Ltd',
        items: [
            {
                barcode: '789ABC123XYZ',
                name: 'Green Gadget',
                sku: 'SKU-GREEN-003',
                location: 'QM1-2-1A',
                quantity_needed: 3,
                quantity_picked: 0
            }
        ]
    }
};

// Stock Counts Data - Stock Count Workflow
const STOCK_COUNTS = {
    'stc_2001': {
        stock_count_id: 2001,
        location: 'QM1-1-1A',
        items: [
            {
                barcode: '34623636436',
                name: 'Red Widget',
                sku: 'SKU-RED-001',
                expected_quantity: 10,
                counted_quantity: null
            },
            {
                barcode: 'YLW-987654321',
                name: 'Yellow Tool',
                sku: 'SKU-YELLOW-004',
                expected_quantity: 15,
                counted_quantity: null
            }
        ]
    },
    'stc_2002': {
        stock_count_id: 2002,
        location: 'QM1-2-1A',
        items: [
            {
                barcode: '789ABC123XYZ',
                name: 'Green Gadget',
                sku: 'SKU-GREEN-003',
                expected_quantity: 8,
                counted_quantity: null
            }
        ]
    }
};

// Locations Data - Location Move Workflow
const LOCATIONS = {
    'loc_3001': {
        location_id: 'QM1-1-1A',
        zone: 'QM1',
        aisle: '1',
        shelf: '1A',
        capacity: 100,
        current_items: ['34623636436', '354#%&23_23']
    },
    'loc_3002': {
        location_id: 'QM1-1-2B',
        zone: 'QM1',
        aisle: '1',
        shelf: '2B',
        capacity: 50,
        current_items: ['354#%&23_23']
    },
    'loc_3003': {
        location_id: 'QM1-2-1A',
        zone: 'QM1',
        aisle: '2',
        shelf: '1A',
        capacity: 75,
        current_items: ['789ABC123XYZ']
    },
    'loc_3004': {
        location_id: 'QM1-2-2B',
        zone: 'QM1',
        aisle: '2',
        shelf: '2B',
        capacity: 60,
        current_items: []
    }
};

// Items Data - All Items
const ITEMS = {
    '34623636436': {
        barcode: '34623636436',
        name: 'Red Widget',
        sku: 'SKU-RED-001',
        description: 'Premium red widget for industrial use',
        weight: 0.5,
        dimensions: '10x5x2 cm'
    },
    '354#%&23_23': {
        barcode: '354#%&23_23',
        name: 'Blue Widget',
        sku: 'SKU-BLUE-002',
        description: 'Standard blue widget for general applications',
        weight: 0.3,
        dimensions: '8x4x2 cm'
    },
    '789ABC123XYZ': {
        barcode: '789ABC123XYZ',
        name: 'Green Gadget',
        sku: 'SKU-GREEN-003',
        description: 'Advanced green gadget with multiple functions',
        weight: 1.2,
        dimensions: '15x8x5 cm'
    },
    'YLW-987654321': {
        barcode: 'YLW-987654321',
        name: 'Yellow Tool',
        sku: 'SKU-YELLOW-004',
        description: 'Precision yellow tool for specialized tasks',
        weight: 0.8,
        dimensions: '12x6x3 cm'
    },
    'PRP@456DEF789': {
        barcode: 'PRP@456DEF789',
        name: 'Purple Device',
        sku: 'SKU-PURPLE-005',
        description: 'Compact purple device for mobile operations',
        weight: 0.4,
        dimensions: '9x5x2 cm'
    }
};

/**
 * Get barcode prefix (first 4 characters including underscore)
 * @param {string} barcode - The barcode to analyze
 * @returns {string} The prefix (ord_, stc_, loc_) or empty string for items
 */
function getBarcodePrefix(barcode) {
    if (!barcode || typeof barcode !== 'string') return '';
    const prefix = barcode.substring(0, 4);
    return ['ord_', 'stc_', 'loc_'].includes(prefix) ? prefix : '';
}

/**
 * Validate barcode format
 * @param {string} barcode - The barcode to validate
 * @returns {boolean} True if barcode has valid format
 */
function isValidBarcode(barcode) {
    if (!barcode || typeof barcode !== 'string') return false;
    return barcode.length > 0;
}

/**
 * Get order by barcode
 * @param {string} barcode - Order barcode (ord_xxxx)
 * @returns {object|null} Order data or null if not found
 */
function getOrder(barcode) {
    return ORDERS[barcode] || null;
}

/**
 * Get stock count by barcode
 * @param {string} barcode - Stock count barcode (stc_xxxx)
 * @returns {object|null} Stock count data or null if not found
 */
function getStockCount(barcode) {
    return STOCK_COUNTS[barcode] || null;
}

/**
 * Get location by barcode
 * @param {string} barcode - Location barcode (loc_xxxx)
 * @returns {object|null} Location data or null if not found
 */
function getLocation(barcode) {
    return LOCATIONS[barcode] || null;
}

/**
 * Get item by barcode
 * @param {string} barcode - Item barcode (any format)
 * @returns {object|null} Item data or null if not found
 */
function getItem(barcode) {
    // First try direct lookup
    if (ITEMS[barcode]) return ITEMS[barcode];
    
    // Then try with itm_ prefix for backward compatibility
    const withPrefix = 'itm_' + barcode;
    return ITEMS[withPrefix] || null;
}

/**
 * Check if item exists in order
 * @param {object} order - Order object
 * @param {string} itemBarcode - Item barcode to check
 * @returns {object|null} Order item or null if not found
 */
function findItemInOrder(order, itemBarcode) {
    if (!order || !order.items) return null;
    return order.items.find(item => 
        item.barcode === itemBarcode || 
        item.barcode === 'itm_' + itemBarcode
    ) || null;
}

/**
 * Check if item exists in stock count
 * @param {object} stockCount - Stock count object
 * @param {string} itemBarcode - Item barcode to check
 * @returns {object|null} Stock count item or null if not found
 */
function findItemInStockCount(stockCount, itemBarcode) {
    if (!stockCount || !stockCount.items) return null;
    return stockCount.items.find(item => 
        item.barcode === itemBarcode || 
        item.barcode === 'itm_' + itemBarcode
    ) || null;
}