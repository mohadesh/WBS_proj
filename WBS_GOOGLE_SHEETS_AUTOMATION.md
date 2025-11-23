# راهنمای اتوماسیون WBS در Google Sheets

## 📋 خلاصه

این راهنما نحوه تبدیل فایل‌های تولید شده (`WBS_FEATURES_TABLE.csv` و `WBS_DSL_SYNTAX.txt`) به فرمت Master List در Google Sheets و اتوماسیون کامل روال کار را توضیح می‌دهد.


---

## 🔄 تبدیل داده‌ها به فرمت Master List

### ساختار Master List در Google Sheets

ستون‌های Master List:
1. **✔** (Checkbox) - وضعیت تکمیل
2. **Task** - نام تسک/فیچر
3. **Tag** - تگ پروژه (مثلاً "Vakav Website")
4. **WBS Group** - ساختار سلسله‌مراتبی با separator `>` (مثلاً `Content & Pages > Homepage`)
5. **Start Date** - تاریخ شروع
6. **Deadline** - مهلت
7. **Days Left** - روزهای باقی‌مانده (محاسبه خودکار)
8. **Priority** - اولویت (1. High, 2. Medium, 3. Low)
9. **Status** - وضعیت (To Do, In Progress, Done, Cancelled)
10. **Person In Charge** - مسئول
11. **Notes** - یادداشت‌ها

---

## 📊 تبدیل CSV به Master List

### روش 1: تبدیل دستی CSV

فایل `WBS_FEATURES_TABLE.csv` را باز کن و تبدیل کن:

**CSV Structure:**
```
Feature Group | Feature/Area | Sub-feature
```

**Master List Structure:**
```
Task | Tag | WBS Group
```

**تبدیل:**
- **Task** = `Sub-feature` (اگر وجود داشته باشد) یا `Feature/Area`
- **Tag** = "Vakav Website" (ثابت)
- **WBS Group** = `Feature Group > Feature/Area` (یا فقط `Feature Group` اگر sub-feature نداشته باشیم)

**مثال:**
```
CSV:
Backend - Content Management | Article (Blog) | Article CRUD

Master List:
Article CRUD | Vakav Website | Backend - Content Management > Article (Blog)
```

---

### روش 2: تبدیل از DSL Syntax

از فایل `WBS_DSL_SYNTAX.txt` که DSL syntax دارد، می‌توانی به صورت خودکار Master List تولید کنی.

**DSL Syntax:**
```
Product Features {Backend {Content Management {Article {...}}}}
```

**تبدیل به WBS Group:**
- هر `{...}` یک سطح جدید است
- از `>` برای separator استفاده می‌کنی
- به صورت بازگشتی (recursive) parse می‌کنی

**مثال:**
```
DSL: Product Features {Backend {Content Management {Article {CRUD, Categories}}}}

تبدیل می‌شه به:
- Task: CRUD | WBS Group: Product Features > Backend > Content Management > Article
- Task: Categories | WBS Group: Product Features > Backend > Content Management > Article
```

---

## 🤖 اتوماسیون با Google Apps Script

### نصب Google Apps Script

1. Google Sheets را باز کن
2. `Extensions` → `Apps Script`
3. کد زیر را paste کن:

```javascript
/**
 * WBS Automation Script
 * Converts CSV or DSL data into the Master List structure
 * 
 * Developed by Mohadeseh Erfani 
 * Email: erfani.mohadeseh@gmail.com  
 * Date: 2025-11-17
 * Location: Mashhad, Iran
 */

// ========== Configuration ==========
const CONFIG = {
  // Sheet names
  SETTING_SHEET: 'Setting',
  MASTER_LIST_SHEET: 'Master List',
  
  // Setting sheet columns
  DSL_COLUMN: 'D', // WBS full path column
  TAG_COLUMN: 'A', // Tag column
  
  // Master List columns
  TASK_COLUMN: 'D', // Task starts at column D (D-V merged)
  TAG_COLUMN: 'W', // Tag column
  WBS_GROUP_COLUMN: 'X', // WBS Group column
  START_DATE_COLUMN: 'Y', // Start Date column
  DEADLINE_COLUMN: 'Z', // Deadline column
  DAYS_LEFT_COLUMN: 'AA', // Days Left column
  PRIORITY_COLUMN: 'AB', // Priority column
  STATUS_COLUMN: 'AD', // Status column
  PERSON_IN_CHARGE_COLUMN: 'AE', // Person In Charge column
  NOTES_COLUMN: 'AF', // Notes column
  SHOW_IN_PLANNER_COLUMN: 'AI', // Show in Planner column (checkbox)
  
  // Default values
  DEFAULT_TAG: 'Vakav Website',
  DEFAULT_STATUS: 'To Do',
  DEFAULT_PRIORITY: '2. Medium',
  
  // Data start row (header aware) - data starts from row after header
  HEADER_ROW: 29
};

// ========== Main Entry: Import from CSV ==========
function importFromCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_LIST_SHEET);
  if (!masterSheet) throw new Error('Sheet "Master List" not found!');

  const csvData = readCSVFromFile();
  const rows = Array.isArray(csvData) ? csvData : parseCSV(csvData);
  if (!rows || rows.length === 0) throw new Error('No CSV data found.');

  // Check if first row is header (contains 'Task', 'Tag', 'WBS Group', etc.)
  const isMasterListFormat = rows[0] && (
    rows[0].some(cell => String(cell).includes('Task')) ||
    rows[0].some(cell => String(cell).includes('Tag')) ||
    rows[0].some(cell => String(cell).includes('WBS Group'))
  );

  let masterRows;
  let startRow;
  
  if (isMasterListFormat) {
    // Already in Master List format - skip header row
    masterRows = rows.slice(1).map(row => row.map(normalizeCsvCell));
    startRow = CONFIG.HEADER_ROW + 1; // Data starts from row after header
  } else {
    // Convert from Features Table format
    const dataRows = rows.slice(1); // Skip header
    masterRows = convertCSVToMasterList(dataRows);
    startRow = CONFIG.HEADER_ROW + 1; // Data starts from row after header
  }
  
  if (!masterRows || masterRows.length === 0) throw new Error('No data rows found.');
  
  const numRows = masterRows.length;
  const numCols = masterRows[0].length;

  // Insert data starting from column B (column 2)
  masterSheet.getRange(startRow, 2, numRows, numCols).setValues(masterRows);

  // Column indices in masterRows array (0-based):
  // 0: ✔ (empty), 1: Check Task (FALSE), 2-20: Task (D-V merged), 21: Tag, 22: WBS Group, 23: Start Date, 24: Deadline, 25: Days Left, 26: Priority, etc.

  // Merge and set checkbox for columns B and C (merged checkbox)
  const checkACol = 2; // Column B in sheet (index 0 in array)
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    // Merge B and C (columns 2 and 3 in sheet)
    masterSheet.getRange(row, checkACol, 1, 2).merge();
    // Clear and insert checkbox
    masterSheet.getRange(row, checkACol).clearContent();
    masterSheet.getRange(row, checkACol).insertCheckboxes();
    // Set checkbox value from CSV (row[1] is Check Task column which has 'FALSE')
    const checkValue = masterRows[i][1] === true || masterRows[i][1] === 'TRUE';
    masterSheet.getRange(row, checkACol).setValue(checkValue);
  }

  // Merge columns D to V for Task column (columns 4-22 in sheet, indices 2-20 in array)
  const taskStartCol = 4; // Column D in sheet (index 2 in array)
  const taskEndCol = 22; // Column V in sheet (index 20 in array)
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    masterSheet.getRange(row, taskStartCol, 1, taskEndCol - taskStartCol + 1).merge();
  }

  // Find column indices for dates and other fields
  // In array: index 23 = Start Date (column Y), index 24 = Deadline (column Z)
  const startDateArrayIndex = 23; // Start Date in array
  const deadlineArrayIndex = 24; // Deadline in array
  const startDateCol = getColumnIndex(CONFIG.START_DATE_COLUMN); // Column Y
  const deadlineCol = getColumnIndex(CONFIG.DEADLINE_COLUMN); // Column Z
  
  // Convert date strings (YYYY/MM/DD) to Date objects and set
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    // Start Date
    const startDateStr = masterRows[i][startDateArrayIndex];
    if (startDateStr && typeof startDateStr === 'string' && /^\d{4}\/\d{2}\/\d{2}$/.test(startDateStr)) {
      const parts = startDateStr.split('/');
      masterSheet.getRange(row, startDateCol).setValue(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }
    // Deadline
    const deadlineStr = masterRows[i][deadlineArrayIndex];
    if (deadlineStr && typeof deadlineStr === 'string' && /^\d{4}\/\d{2}\/\d{2}$/.test(deadlineStr)) {
      const parts = deadlineStr.split('/');
      masterSheet.getRange(row, deadlineCol).setValue(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }
  }
  
  // Apply date format
  masterSheet.getRange(startRow, startDateCol, numRows, 1).setNumberFormat('yyyy/mm/dd');
  masterSheet.getRange(startRow, deadlineCol, numRows, 1).setNumberFormat('yyyy/mm/dd');

  // Days Left column: dynamic formula per row
  const daysLeftCol = getColumnIndex(CONFIG.DAYS_LEFT_COLUMN);
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    masterSheet.getRange(row, daysLeftCol).setFormula(
      `=IF(AND(${CONFIG.START_DATE_COLUMN}${row}<>"",${CONFIG.DEADLINE_COLUMN}${row}<>""),${CONFIG.DEADLINE_COLUMN}${row}-TODAY(),"")`
    ).setNumberFormat('0');
  }

  // Show in Planner column (AI) - last column in array - checkbox
  const showPlannerCol = getColumnIndex(CONFIG.SHOW_IN_PLANNER_COLUMN);
  const showPlannerArrayIndex = numCols - 1; // Last column
  masterSheet.getRange(startRow, showPlannerCol, numRows, 1).clearContent().insertCheckboxes();
  const showPlannerValues = masterRows.map(row => {
    const val = row[showPlannerArrayIndex];
    return [val === true || val === 'TRUE'];
  });
  masterSheet.getRange(startRow, showPlannerCol, numRows, 1).setValues(showPlannerValues);

  SpreadsheetApp.getUi().alert(`✅ ${masterRows.length} rows imported successfully!`);
}

// ========== Main Entry: Import from DSL ==========
function importFromDSL() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingSheet = ss.getSheetByName(CONFIG.SETTING_SHEET);
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_LIST_SHEET);
  
  if (!settingSheet || !masterSheet) {
    throw new Error('Required sheets not found!');
  }
  
  // Locate DSL string in Setting sheet
  const tagRow = findTagRow(settingSheet, CONFIG.DEFAULT_TAG);
  if (!tagRow) {
    throw new Error(`Tag "${CONFIG.DEFAULT_TAG}" not found in Setting sheet!`);
  }
  
  const dslString = settingSheet.getRange(tagRow, getColumnIndex(CONFIG.DSL_COLUMN)).getValue();
  
  if (!dslString) {
    throw new Error('DSL string not found!');
  }
  
  // Parse DSL
  const tasks = parseDSL(dslString, CONFIG.DEFAULT_TAG);
  
  // Append to Master List
  const startRow = findLastRow(masterSheet, CONFIG.HEADER_ROW) + 1;
  masterSheet.getRange(startRow, 2, tasks.length, tasks[0].length)
    .setValues(tasks);
  
  SpreadsheetApp.getUi().alert(`✅ ${tasks.length} tasks imported from DSL!`);
}

// ========== Parse DSL Syntax ==========
function parseDSL(dslString, tag) {
  const tasks = [];
  const stack = []; // Not used currently, placeholder for future parent tracking
  
  // Helper: extract name from a node
  function extractName(node) {
    const match = node.match(/^([^{]+)/);
    return match ? match[1].trim() : '';
  }
  
  // Helper: extract children from a node
  function extractChildren(node) {
    const match = node.match(/\{([^}]*)\}/);
    return match ? match[1] : '';
  }
  
  // Recursive parser
  function parseNode(node, parentPath) {
    const name = extractName(node);
    const children = extractChildren(node);
    
    if (!name) return;
    
    const currentPath = parentPath ? `${parentPath} > ${name}` : name;
    
    if (children) {
      // Node has children → recurse
      const childrenList = parseChildrenList(children);
      
      for (const child of childrenList) {
        if (child.includes('{')) {
          // Nested parent
          parseNode(child, currentPath);
        } else {
          // Leaf node (task)
          tasks.push([
            false, // checkbox
            child.trim(), // task name
            tag, // tag
            currentPath, // WBS group
            '', // start date
            '', // deadline
            '', // days left (formula placeholder)
            CONFIG.DEFAULT_PRIORITY, // priority
            CONFIG.DEFAULT_STATUS, // status
            '', // person in charge
            '' // notes
          ]);
        }
      }
    } else {
      // Node itself is a task (leaf)
      tasks.push([
        false,
        name,
        tag,
        parentPath || name,
        '',
        '',
        '',
        CONFIG.DEFAULT_PRIORITY,
        CONFIG.DEFAULT_STATUS,
        '',
        ''
      ]);
    }
  }
  
  // Parse children list (comma separated while respecting nested braces)
  function parseChildrenList(childrenStr) {
    const items = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < childrenStr.length; i++) {
      const char = childrenStr[i];
      
      if (char === '{') depth++;
      if (char === '}') depth--;
      
      if (char === ',' && depth === 0) {
        if (current.trim()) {
          items.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      items.push(current.trim());
    }
    
    return items;
  }
  
  // Parse top-level items (separated by semicolon)
  const topLevelItems = dslString.split(';').map(s => s.trim()).filter(s => s);
  
  for (const item of topLevelItems) {
    parseNode(item, '');
  }
  
  return tasks;
}

// ========== Convert CSV to Master List ==========
function convertCSVToMasterList(csvRows) {
  if (!csvRows || csvRows.length === 0) {
    return [];
  }
  
  const header = csvRows[0].map(cell => (cell || '').toString().trim());
  const looksLikeMasterList = header.includes('Tag') && header.includes('WBS Group') && header.includes('Start Date');
  
  if (looksLikeMasterList) {
    const dataRows = csvRows
      .slice(1)
      .filter(row => row && row.some(cell => cell !== '' && cell !== null))
      .map(row => row.map(normalizeCsvCell));
    return dataRows;
  }
  
  const masterRows = [];
  for (let i = 1; i < csvRows.length; i++) {
    const row = csvRows[i];
    if (!row || row.length === 0) continue;
    
    const featureGroup = row[0] || '';
    const feature = row[1] || '';
    const subFeature = row[2] || '';
    const task = subFeature || feature;
    
    if (!task) continue;
    
    let wbsGroup = featureGroup;
    if (feature && feature !== task) {
      wbsGroup = `${featureGroup} > ${feature}`;
    }
    
    masterRows.push([
      false,
      task,
      CONFIG.DEFAULT_TAG,
      wbsGroup,
      '',
      '',
      '',
      CONFIG.DEFAULT_PRIORITY,
      CONFIG.DEFAULT_STATUS,
      '',
      ''
    ]);
  }
  
  return masterRows;
}

// ========== Helper Functions ==========
function findTagRow(sheet, tagName) {
  const tagRange = sheet.getRange(CONFIG.TAG_COLUMN + ':' + CONFIG.TAG_COLUMN);
  const values = tagRange.getValues();
  
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === tagName) {
      return i + 1;
    }
  }
  return null;
}

function findLastRow(sheet, startRow) {
  const lastRow = sheet.getLastRow();
  for (let i = lastRow; i >= startRow; i--) {
    const row = sheet.getRange(i, 2, 1, 1).getValue();
    if (row) return i;
  }
  return startRow - 1;
}

function getColumnIndex(columnLetter) {
  let result = 0;
  for (let i = 0; i < columnLetter.length; i++) {
    result = result * 26 + (columnLetter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result;
}

function parseCSV(csvString) {
  const rows = [];
  const lines = csvString.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      rows.push(line.split(',').map(cell => cell.trim()));
    }
  }
  
  return rows;
}

function readCSVFromFile() {
  const SHEET_NAME = 'CSV Import';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found!`);
  }
  
  const values = sheet.getDataRange().getDisplayValues();
  return values;
}

function normalizeCsvCell(cell) {
  if (typeof cell === 'boolean') return cell;
  if (cell === null || cell === undefined) return '';
  const text = cell.toString().trim();
  if (text.toUpperCase() === 'TRUE') return true;
  if (text.toUpperCase() === 'FALSE') return false;
  return text;
}

// ========== Bulk Update Functions ==========

// Bulk update priority
function bulkUpdatePriority(wbsGroupPattern, newPriority) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_LIST_SHEET);
  
  const dataRange = masterSheet.getRange(CONFIG.HEADER_ROW + 1, 1, 
    masterSheet.getLastRow() - CONFIG.HEADER_ROW, 11);
  const values = dataRange.getValues();
  
  let updated = 0;
  
  for (let i = 0; i < values.length; i++) {
    const wbsGroup = values[i][3]; // Column D (WBS Group)
    
    if (wbsGroup && wbsGroup.includes(wbsGroupPattern)) {
      const row = CONFIG.HEADER_ROW + 1 + i;
      masterSheet.getRange(row, getColumnIndex(CONFIG.PRIORITY_COLUMN))
        .setValue(newPriority);
      updated++;
    }
  }
  
  SpreadsheetApp.getUi().alert(`✅ Updated ${updated} rows!`);
}

// Bulk update status
function bulkUpdateStatus(wbsGroupPattern, newStatus) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_LIST_SHEET);
  
  const dataRange = masterSheet.getRange(CONFIG.HEADER_ROW + 1, 1, 
    masterSheet.getLastRow() - CONFIG.HEADER_ROW, 11);
  const values = dataRange.getValues();
  
  let updated = 0;
  
  for (let i = 0; i < values.length; i++) {
    const wbsGroup = values[i][3]; // Column D (WBS Group)
    
    if (wbsGroup && wbsGroup.includes(wbsGroupPattern)) {
      const row = CONFIG.HEADER_ROW + 1 + i;
      masterSheet.getRange(row, getColumnIndex(CONFIG.STATUS_COLUMN))
        .setValue(newStatus);
      updated++;
    }
  }
  
  SpreadsheetApp.getUi().alert(`✅ Updated ${updated} rows!`);
}

// Bulk update person in charge
function bulkUpdatePerson(wbsGroupPattern, newPerson) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_LIST_SHEET);
  
  const dataRange = masterSheet.getRange(CONFIG.HEADER_ROW + 1, 1, 
    masterSheet.getLastRow() - CONFIG.HEADER_ROW, 11);
  const values = dataRange.getValues();
  
  let updated = 0;
  
  for (let i = 0; i < values.length; i++) {
    const wbsGroup = values[i][3]; // Column D (WBS Group)
    
    if (wbsGroup && wbsGroup.includes(wbsGroupPattern)) {
      const row = CONFIG.HEADER_ROW + 1 + i;
      masterSheet.getRange(row, 10) // Column J (Person In Charge)
        .setValue(newPerson);
      updated++;
    }
  }
  
  SpreadsheetApp.getUi().alert(`✅ Updated ${updated} rows!`);
}

// ========== Menu Setup ==========
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // Create legacy WBS menu
  ui.createMenu('WBS')
    .addItem('Build/Refresh', 'wbsBuild')
    .addItem('Apply validations', 'wbsApplyValidations')
    .addToUi();
  
  // Create WBS Automation menu
  ui.createMenu('WBS Automation')
    .addItem('📥 Import from DSL', 'importFromDSL')
    .addItem('📥 Import from CSV', 'importFromCSV')
    .addSeparator()
    .addSubMenu(ui.createMenu('Bulk Update')
      .addItem('Update Priority', 'showBulkUpdatePriorityDialog')
      .addItem('Update Status', 'showBulkUpdateStatusDialog')
      .addItem('Update Person In Charge', 'showBulkUpdatePersonDialog'))
    .addToUi();
}

// Dialog functions
function showBulkUpdatePriorityDialog() {
  const html = HtmlService.createHtmlOutput(`
    <input type="text" id="pattern" placeholder="WBS Group Pattern (e.g., 'SEO & Analytics')" style="width: 300px; margin: 10px;"><br>
    <select id="priority" style="width: 300px; margin: 10px;">
      <option>1. High</option>
      <option>2. Medium</option>
      <option>3. Low</option>
    </select><br>
    <button onclick="updatePriority()">Update</button>
    <script>
      function updatePriority() {
        const pattern = document.getElementById('pattern').value;
        const priority = document.getElementById('priority').value;
        google.script.run.bulkUpdatePriority(pattern, priority);
        google.script.host.close();
      }
    </script>
  `).setWidth(400).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Bulk Update Priority');
}

function showBulkUpdateStatusDialog() {
  const html = HtmlService.createHtmlOutput(`
    <input type="text" id="pattern" placeholder="WBS Group Pattern (e.g., 'SEO & Analytics')" style="width: 300px; margin: 10px;"><br>
    <select id="status" style="width: 300px; margin: 10px;">
      <option>To Do</option>
      <option>In Progress</option>
      <option>Done</option>
      <option>Cancelled</option>
    </select><br>
    <button onclick="updateStatus()">Update</button>
    <script>
      function updateStatus() {
        const pattern = document.getElementById('pattern').value;
        const status = document.getElementById('status').value;
        google.script.run.bulkUpdateStatus(pattern, status);
        google.script.host.close();
      }
    </script>
  `).setWidth(400).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Bulk Update Status');
}

function showBulkUpdatePersonDialog() {
  const html = HtmlService.createHtmlOutput(`
    <input type="text" id="pattern" placeholder="WBS Group Pattern (e.g., 'SEO & Analytics')" style="width: 300px; margin: 10px;"><br>
    <input type="text" id="person" placeholder="Person In Charge" style="width: 300px; margin: 10px;"><br>
    <button onclick="updatePerson()">Update</button>
    <script>
      function updatePerson() {
        const pattern = document.getElementById('pattern').value;
        const person = document.getElementById('person').value;
        google.script.run.bulkUpdatePerson(pattern, person);
        google.script.host.close();
      }
    </script>
  `).setWidth(400).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Bulk Update Person');
}
```

---

## 📝 نحوه استفاده

### مرحله 1: نصب Script

1. Google Sheets را باز کن
2. `Extensions` → `Apps Script`
3. کد بالا را paste کن
4. `File` → `Save` (نام بده: `WBS Automation`)
5. صفحه را refresh کن

### مرحله 2: Import از DSL

1. مطمئن شو که در Setting sheet، DSL syntax در ستون D وجود دارد
2. در Google Sheets، منوی `WBS Automation` → `📥 Import from DSL`
3. صبر کن تا همه tasks import شوند

### مرحله 3: Import از CSV

1. فایل `WBS_FEATURES_TABLE.csv` را باز کن
2. محتوای آن را کپی کن
3. یک sheet جدید بساز (مثلاً "CSV Import")
4. CSV را paste کن
5. محتوای CSV را کپی کن و در یک cell در Apps Script قرار بده (یا تابع `readCSVFromFile` را تکمیل کن)
6. منوی `WBS Automation` → `📥 Import from CSV`

### مرحله 4: Bulk Update

برای تغییر دسته‌ای:

1. `WBS Automation` → `Bulk Update` → `Update Priority`
2. Pattern را وارد کن (مثلاً `SEO & Analytics`)
3. Priority جدید را انتخاب کن
4. `Update` را بزن

همین روال برای Status و Person In Charge.

---

## 🎯 مثال‌های استفاده

### مثال 1: تغییر Priority همه SEO tasks

```
Pattern: "SEO & Analytics"
Priority: "1. High"
```

### مثال 2: تغییر Status همه Backend tasks

```
Pattern: "Backend"
Status: "Done"
```

### مثال 3: تغییر Person همه Frontend tasks

```
Pattern: "Frontend"
Person: "Frontend Team"
```

---

## ⚙️ تنظیمات (CONFIG)

می‌توانی مقادیر `CONFIG` را در ابتدای script تغییر دهی:

```javascript
const CONFIG = {
  SETTING_SHEET: 'Setting',
  MASTER_LIST_SHEET: 'Master List',
  DSL_COLUMN: 'D',
  TAG_COLUMN: 'A',
  DEFAULT_TAG: 'Vakav Website',
  DEFAULT_STATUS: 'To Do',
  DEFAULT_PRIORITY: '2. Medium',
  HEADER_ROW: 28
};
```

---

## 🔧 Troubleshooting

### خطا: "Sheet not found"
- مطمئن شو نام sheet‌ها دقیقاً مطابق با CONFIG است
- حروف بزرگ/کوچک مهم است

### خطا: "DSL string not found"
- بررسی کن که در Setting sheet، DSL در ستون D وجود دارد
- بررسی کن که Tag (ستون A) با DEFAULT_TAG مطابقت دارد

### Import نشدن همه tasks
- بررسی کن که DSL syntax صحیح است
- لاگ‌های Apps Script را چک کن (`View` → `Logs`)

---

## 📚 مراجع

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Google Sheets API](https://developers.google.com/sheets/api)


