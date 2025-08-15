# Warehouse Scanner Workflow Specification

## Overview
This document defines the exact behavior for each workflow type in the warehouse barcode scanner application.

## 1. Picking Workflow (`ord_` prefix)

### Trigger
- User scans any barcode starting with `ord_` (e.g., `ord_1001`)

### Initial Behavior
1. **Load Order**: Look up order data by barcode
2. **Show Confirmation**: Display "Order [number] loaded" notification
3. **Display Items**: Show list of all items in the order with:
   - Item name
   - SKU
   - Location
   - Quantity needed
   - Quantity picked so far (starts at 0)
4. **Show Cancel Button**: Display global cancel button in header
5. **Set State**: Mark workflow as active (`picking`)

### During Workflow - Valid Scans
- **Only accept**: Barcodes with `itm_` prefix
- **Item in order**: Increment picked quantity, show progress
- **Item complete**: When picked quantity reaches needed quantity, turn item green
- **Item not in order**: Show "Item doesn't appear in the order"

### During Workflow - Invalid Scans
- **Any non-item barcode** (`ord_`, `stc_`, `loc_`, unknown): Show "Item doesn't exist in order"

### Completion
- **Auto-detect**: When all items reach required quantities
- **Show Button**: Display "Complete Order" button
- **Manual Complete**: User clicks button to finish workflow
- **Reset State**: Return to default "Ready to Scan" view

### Cancel
- **Always Available**: Red "Cancel" button in header
- **Action**: End workflow immediately, return to default state
- **Notification**: "Workflow cancelled"

---

## 2. Stock Count Workflow (`stc_` prefix)

### Trigger
- User scans any barcode starting with `stc_` (e.g., `stc_2001`)

### Initial Behavior
1. **Load Stock Count**: Look up stock count data by barcode
2. **Show Confirmation**: Display "Stock count [number] loaded" notification
3. **Display Items**: Show list of items to count with:
   - Item name
   - SKU
   - Location
   - Count status (pending/complete)
4. **Show Cancel Button**: Display global cancel button
5. **Set State**: Mark workflow as active (`stockcount`)

### During Workflow - Valid Scans
- **Only accept**: Barcodes with `itm_` prefix
- **Item in list**: Prompt user to enter quantity
- **Quantity Entry**: Show input dialog for count
- **Mark Complete**: Item turns green when counted
- **Item not in list**: Show "Item not in this stock count"

### During Workflow - Invalid Scans
- **Any non-item barcode**: Show "Item doesn't exist in stock count"

### Completion
- **Manual Complete**: User clicks "Complete Count" when done
- **Reset State**: Return to default view

### Cancel
- **Always Available**: Cancel button ends workflow immediately

---

## 3. Location Move Workflow (`loc_` prefix)

### Trigger
- User scans any barcode starting with `loc_` (e.g., `loc_3001`)

### Initial Behavior
1. **Load Location**: Look up location data by barcode
2. **Show Confirmation**: Ask "Do you want to move an item from [location]?"
3. **User Choice**: 
   - "Yes, Move Item" → Continue to step 2
   - "Cancel" → End workflow
4. **Set State**: Mark workflow as active (`locationmove`)

### Step 2 - Scan Item
- **Prompt**: "Scan the item you want to move from [location]"
- **Accept**: Only `itm_` prefix barcodes
- **Invalid**: Show "Please scan an item to move"
- **Success**: Move to step 3

### Step 3 - Scan Destination
- **Prompt**: "Now scan the destination location for item [item]"
- **Accept**: Only `loc_` prefix barcodes
- **Invalid**: Show "Please scan a location barcode (loc_)"
- **Success**: Move to confirmation

### Step 4 - Confirmation
- **Show**: "Move item [item] from [source] to [destination]?"
- **Confirm**: Execute move, show success message
- **Cancel**: End workflow

### Cancel
- **Always Available**: Cancel button ends workflow at any step

---

## 4. Returns Workflow (`itm_` prefix when no workflow active)

### Trigger
- User scans any barcode starting with `itm_` when no workflow is active

### Initial Behavior
1. **Start Returns**: Begin returns process for scanned item
2. **Prompt**: "Scan the destination location for this item"
3. **Set State**: Mark workflow as active (`returns`)

### Step 2 - Scan Location
- **Accept**: Only `loc_` prefix barcodes
- **Invalid**: Show "Please scan a location barcode (loc_)"
- **Success**: Move to confirmation

### Step 3 - Confirmation
- **Show**: "Place item [item] in location [location]?"
- **Confirm**: Execute placement, show success message
- **Cancel**: End workflow

### Cancel
- **Always Available**: Cancel button ends workflow

---

## Global Rules

### Workflow State Management
- **Only One Active**: Only one workflow can be active at a time
- **State Protection**: Active workflow blocks starting new workflows
- **Clear Errors**: Wrong barcode types show specific error messages

### Error Messages
- **Picking Active**: "Item doesn't exist in order"
- **Stock Count Active**: "Item doesn't exist in stock count"
- **Location Move**: Step-specific messages
- **Returns**: Step-specific messages

### Cancel Behavior
- **Global Button**: Always visible when workflow is active
- **Immediate**: Cancels workflow instantly
- **Clean Reset**: Returns to "Ready to Scan" state
- **Notification**: Shows "Workflow cancelled"

### UI States
- **Default**: "Ready to Scan" message, no active workflow
- **Active**: Workflow-specific interface with cancel button
- **Complete**: Success message, automatic reset to default

---

## Test Scenarios

### Picking Workflow Test
1. Scan `ord_1001` → Should load order with 2 items
2. Scan `ord_1002` → Should show "Item doesn't exist in order"
3. Scan `itm_501` → Should increment Red Widget (1/5)
4. Scan `itm_501` 4 more times → Should complete Red Widget (green)
5. Scan `itm_502` twice → Should complete Blue Widget
6. Should show "Complete Order" button
7. Click Complete → Should return to default state

### Error Handling Test
1. Scan `ord_1001` → Load order
2. Scan `stc_2001` → Should show error, not load stock count
3. Scan `loc_3001` → Should show error
4. Only `itm_` barcodes should work

### Cancel Test
1. Start any workflow
2. Click red "Cancel Workflow" button
3. Should immediately return to default state
4. Should show "Workflow cancelled" message