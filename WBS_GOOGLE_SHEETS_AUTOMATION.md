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
 * تبدیل خودکار CSV یا DSL به Master List
 */

// ========== تنظیمات ==========
const CONFIG = {
  // نام Sheet‌ها
  SETTING_SHEET: 'Setting',
  MASTER_LIST_SHEET: 'Master List',
  
  // ستون‌ها در Setting
  DSL_COLUMN: 'D', // ستون WBS Full path
  TAG_COLUMN: 'A', // ستون Tags
  
  // ستون‌ها در Master List
  TASK_COLUMN: 'B',
  TAG_COLUMN: 'C',
  WBS_GROUP_COLUMN: 'D',
  PRIORITY_COLUMN: 'H',
  STATUS_COLUMN: 'I',
  
  // تنظیمات پیش‌فرض
  DEFAULT_TAG: 'Vakav Website',
  DEFAULT_STATUS: 'To Do',
  DEFAULT_PRIORITY: '2. Medium',
  
  // ردیف شروع داده‌ها (با در نظر گرفتن header)
  HEADER_ROW: 28
};

// ========== تابع اصلی: Import از CSV ==========
function importFromCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_LIST_SHEET);
  
  if (!masterSheet) {
    throw new Error('Sheet "Master List" not found!');
  }
  
  // CSV را از یک cell یا file بخوان
  // برای تست، می‌توانی CSV را در یک cell قرار دهی
  const csvData = readCSVFromFile(); // یا readCSVFromCell()
  
  // تبدیل CSV به rows
  const rows = parseCSV(csvData);
  
  // تبدیل به فرمت Master List
  const masterRows = convertCSVToMasterList(rows);
  
  // اضافه کردن به Master List
  const startRow = findLastRow(masterSheet, CONFIG.HEADER_ROW) + 1;
  masterSheet.getRange(startRow, 2, masterRows.length, masterRows[0].length)
    .setValues(masterRows);
  
  SpreadsheetApp.getUi().alert(`✅ ${masterRows.length} rows imported successfully!`);
}

// ========== تابع اصلی: Import از DSL ==========
function importFromDSL() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingSheet = ss.getSheetByName(CONFIG.SETTING_SHEET);
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_LIST_SHEET);
  
  if (!settingSheet || !masterSheet) {
    throw new Error('Required sheets not found!');
  }
  
  // خواندن DSL از Setting sheet
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
  
  // اضافه کردن به Master List
  const startRow = findLastRow(masterSheet, CONFIG.HEADER_ROW) + 1;
  masterSheet.getRange(startRow, 2, tasks.length, tasks[0].length)
    .setValues(tasks);
  
  SpreadsheetApp.getUi().alert(`✅ ${tasks.length} tasks imported from DSL!`);
}

// ========== Parse DSL Syntax ==========
function parseDSL(dslString, tag) {
  const tasks = [];
  const stack = []; // برای track کردن parent levels
  
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
      // این node بچه‌هایی دارد
      const childrenList = parseChildrenList(children);
      
      for (const child of childrenList) {
        if (child.includes('{')) {
          // این child خودش parent است
          parseNode(child, currentPath);
        } else {
          // این child یک leaf (task) است
          tasks.push([
            false, // checkbox
            child.trim(), // task
            tag, // tag
            currentPath, // WBS group
            '', // start date
            '', // deadline
            '', // days left (formula)
            CONFIG.DEFAULT_PRIORITY, // priority
            CONFIG.DEFAULT_STATUS, // status
            '', // person in charge
            '' // notes
          ]);
        }
      }
    } else {
      // این node خودش یک task است (leaf)
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
  
  // Parse children list (separated by comma, but respecting nested braces)
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
  const masterRows = [];
  
  for (let i = 1; i < csvRows.length; i++) { // Skip header
    const row = csvRows[i];
    const featureGroup = row[0] || '';
    const feature = row[1] || '';
    const subFeature = row[2] || '';
    
    // تعیین Task
    const task = subFeature || feature;
    
    // تعیین WBS Group
    let wbsGroup = featureGroup;
    if (feature && feature !== task) {
      wbsGroup = `${featureGroup} > ${feature}`;
    }
    
    // ساخت row
    masterRows.push([
      false, // checkbox
      task, // task
      CONFIG.DEFAULT_TAG, // tag
      wbsGroup, // WBS group
      '', // start date
      '', // deadline
      '', // days left (will be formula)
      CONFIG.DEFAULT_PRIORITY, // priority
      CONFIG.DEFAULT_STATUS, // status
      '', // person in charge
      '' // notes
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
  // این تابع باید CSV را از یک file بخواند
  // می‌توانی از DriveApp یا File Upload استفاده کنی
  // برای تست، CSV را در یک cell قرار بده
  return '';
}

// ========== Bulk Update Functions ==========

// تغییر دسته‌ای Priority
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

// تغییر دسته‌ای Status
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

// تغییر دسته‌ای Person In Charge
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


