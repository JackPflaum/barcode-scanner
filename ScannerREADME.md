📦 Barcode Scanner Web App (POC) – AI Agent Project Brief
1. Project Goal

Build a proof-of-concept browser-based barcode scanning app for warehouse workflows at a 3PL.
Runs in Chrome on Android using the BarcodeDetector API for scanning.
The UI will dynamically adapt based on the type and content of the scanned barcode (order, stock count, location, item).

The scanner should:

Appear in half-screen mode when activated

Be hidden or minimised when not in use

Include settings/zoom/focus control (via getUserMedia & camera constraints, see Dynamsoft focus control reference "https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html")

Allow for different workflows based on barcode prefix (e.g., ord_, stc_, loc_)

2. Tech Stack

Frontend: HTML5, CSS3, Bootstrap 5, JavaScript (ES6+)

Backend: PHP 8.3 (for mock API & data handling)

APIs:

Chrome BarcodeDetector API

getUserMedia for camera settings

Data: JSON-based mock data during POC

3. Coding Best Practices

Modular JavaScript (separate scanner logic, UI rendering, and API calls)

Keep all DOM manipulation inside dedicated functions

Use async/await for API calls

Use Bootstrap grid system for responsive layout

Maintain prefix-based barcode routing (e.g. ord_, stc_, loc_, itm_)

Centralised notification/alert component

4. Workflows
4.1 Picking Slip Workflow

Barcode format: ord_<order_id>
Steps:

Scan picking slip → "Order loaded" notification

Display item list:

Product name

SKU

Location

Total Quantity Needed

Quantity Scanned

Colour indicator: Green = picked, Red = missing

User scans items until all are collected

If quantity > 10:

Allow manual entry with access code

If stock missing:

Option: Tag order as "Awaiting Stock"

User clicks "Complete" to reset UI

Notifications:

Item not in order

Item found

Item already collected

Order complete

Item out of stock

4.2 Stock Count Slip Workflow

Barcode format: stc_<stockcount_id>
Steps:

Scan stock count slip → "Stock count loaded" notification

Show item list (name, SKU, location)

For each scanned item:

Prompt for quantity

Confirm entry

Repeat until all items counted

User clicks "Count Completed"

Questions:

Require location scan before counting?

How to handle wrong/missing location?

Notifications:

Item not in stock count

Item already counted / prompt to recount

Stock count complete

4.3 Storage Location Move

Barcode format: loc_<location_id>
Steps:

Scan location barcode → "Do you want to relocate this item?"

If yes → prompt to scan new location

Show confirmation: "Moving {product} to {location}"

On confirm → Call API to update

Notifications:

Please scan a valid location

4.4 Returns

Steps:

Scan item barcode

Prompt: "Scan location you want to move item to"

Scan destination location

Confirm move

Notify: "{item} has been moved to {location}"

4.5 Ad-Hoc Single Item Stock Count

Steps:

Click Stock Count

Scan item barcode

Enter new quantity

Confirm change

5. Fake Data for Testing

orders.json

[
  {
    "barcode_id": "ord_1001",
    "order_id": 1001,
    "items": [
      {"barcode": "itm_501", "SKU": "SKU-RED-001", "name": "Red Widget", "location": "QM1-1-1A", "qty_needed": 5},
      {"barcode": "itm_502", "SKU": "SKU-BLU-002", "name": "Blue Widget", "location": "QM1-1-2B", "qty_needed": 2}
    ]
  },
  {
    "barcode_id": "ord_1002",
    "order_id": 1002,
    "items": [
      {"barcode": "itm_503", "SKU": "SKU-GRN-003", "name": "Green Widget", "location": "QM2-1-1C", "qty_needed": 12}
    ]
  }
]


stockcounts.json

[
  {
    "barcode_id": "stc_2001",
    "stock_count_id": 2001,
    "items": [
      {"barcode": "itm_501", "SKU": "SKU-RED-001", "name": "Red Widget", "location": "QM1-1-1A"},
      {"barcode": "itm_502", "SKU": "SKU-BLU-002", "name": "Blue Widget", "location": "QM1-1-2B"}
    ]
  }
]


locations.json

[
  {"barcode": "loc_3001", "location": "QM1-1-1A", "items": ["itm_501", "itm_502"]},
  {"barcode": "loc_3002", "location": "QM1-1-2B", "items": []}
]

6. Checklist for AI Agent

 Implement barcode scanner UI with half-screen camera

 Implement toggle for camera visibility

 Add camera settings tab (zoom, focus)

 Create prefix-based barcode routing:

 ord_ → Picking Slip

 stc_ → Stock Count

 loc_ → Storage Location Move

 itm_ → Returns / Ad-Hoc Count

 Implement notifications system

 Create mock JSON API endpoints in PHP

 Build workflow UIs (Picking, Stock Count, Location Move, Returns, Ad-Hoc Count)

 Add manual quantity entry with access code check

 Handle stock missing cases

 Confirm workflows reset after completion

7. Questions to Resolve

For stock counts, must location be scanned first?

How to handle partially completed orders (mark as pending?)

Should returns update both stock location & quantity immediately?

Do we allow multiple open workflows at once?