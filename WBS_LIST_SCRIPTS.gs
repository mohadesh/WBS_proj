/**
 * Script برای لیست کردن همه Scriptها و Triggerها در Google Sheets
 * 
 * استفاده:
 * 1. این کد را در Apps Script paste کن
 * 2. Run → listAllScripts
 * 3. یک Sheet جدید با لیست scriptها و triggerها ساخته می‌شه
 */

/**
 * لیست کردن همه Scriptها و Triggerها
 */
function listAllScripts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const project = DriveApp.getFileById(ss.getId());
  
  let output = '=== SCRIPTS IN GOOGLE SHEETS ===\n';
  output += `Date: ${new Date().toLocaleString()}\n`;
  output += `Spreadsheet: ${ss.getName()}\n`;
  output += `Spreadsheet ID: ${ss.getId()}\n`;
  output += `Spreadsheet URL: ${ss.getUrl()}\n\n`;
  
  // لیست Triggerها
  output += '=== TRIGGERS ===\n';
  const triggers = ScriptApp.getProjectTriggers();
  
  if (triggers.length === 0) {
    output += 'No triggers found.\n';
  } else {
    triggers.forEach((trigger, index) => {
      output += `\n${index + 1}. Function: ${trigger.getHandlerFunction()}\n`;
      output += `   Event Source: ${getEventSourceName(trigger.getEventSource())}\n`;
      output += `   Event Type: ${getEventTypeName(trigger.getEventType())}\n`;
      output += `   Trigger Source: ${getTriggerSourceName(trigger.getTriggerSource())}\n`;
      
      if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
        // Time-driven trigger
        const handlerFunction = trigger.getHandlerFunction();
        output += `   Frequency: Time-based trigger\n`;
      }
      
      output += `   Unique ID: ${trigger.getUniqueId()}\n`;
    });
  }
  
  output += '\n';
  output += '=== SCRIPTS INFO ===\n';
  output += 'Note: To export scripts manually:\n';
  output += '1. Open each script file in Apps Script editor\n';
  output += '2. Select all code (Ctrl+A)\n';
  output += '3. Copy (Ctrl+C)\n';
  output += '4. Paste into a .gs or .js file and save\n';
  output += '\n';
  output += 'Or use File → Download → .gs file\n';
  
  // نمایش در Logger
  Logger.log(output);
  
  // نمایش در Dialog
  SpreadsheetApp.getUi().alert('✅ Script list created! Check the new sheet.');
  
  // همچنین یک Sheet جدید بساز
  const sheetName = `Scripts_List_${formatDate(new Date())}`;
  
  // حذف sheet قبلی اگر وجود داشت
  const existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
  }
  
  const sheet = ss.insertSheet(sheetName);
  
  // نوشتن header
  sheet.getRange(1, 1).setValue('=== SCRIPTS IN GOOGLE SHEETS ===');
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  
  sheet.getRange(2, 1).setValue(`Date: ${new Date().toLocaleString()}`);
  sheet.getRange(3, 1).setValue(`Spreadsheet: ${ss.getName()}`);
  sheet.getRange(4, 1).setValue(`Spreadsheet ID: ${ss.getId()}`);
  sheet.getRange(5, 1).setValue(`Spreadsheet URL: ${ss.getUrl()}`);
  
  // نوشتن Triggerها
  let row = 7;
  sheet.getRange(row, 1).setValue('=== TRIGGERS ===');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(12);
  row++;
  
  if (triggers.length === 0) {
    sheet.getRange(row, 1).setValue('No triggers found.');
    row++;
  } else {
    triggers.forEach((trigger, index) => {
      sheet.getRange(row, 1).setValue(`${index + 1}. Function: ${trigger.getHandlerFunction()}`);
      sheet.getRange(row, 1).setFontWeight('bold');
      row++;
      
      sheet.getRange(row, 2).setValue(`Event Source: ${getEventSourceName(trigger.getEventSource())}`);
      row++;
      
      sheet.getRange(row, 2).setValue(`Event Type: ${getEventTypeName(trigger.getEventType())}`);
      row++;
      
      sheet.getRange(row, 2).setValue(`Trigger Source: ${getTriggerSourceName(trigger.getTriggerSource())}`);
      row++;
      
      if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
        sheet.getRange(row, 2).setValue('Frequency: Time-based trigger');
        row++;
      }
      
      sheet.getRange(row, 2).setValue(`Unique ID: ${trigger.getUniqueId()}`);
      row++;
      row++; // یک خط خالی
    });
  }
  
  // نوشتن راهنمای Export
  row++;
  sheet.getRange(row, 1).setValue('=== HOW TO EXPORT SCRIPTS ===');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(12);
  row++;
  
  const instructions = [
    '1. Open each script file in Apps Script editor',
    '2. Select all code (Ctrl+A)',
    '3. Copy (Ctrl+C)',
    '4. Paste into a .gs or .js file and save',
    '',
    'Or use: File → Download → .gs file'
  ];
  
  instructions.forEach(instruction => {
    sheet.getRange(row, 1).setValue(instruction);
    row++;
  });
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 2);
  
  SpreadsheetApp.getUi().alert(`✅ Script list created in sheet: ${sheetName}`);
}

/**
 * Helper: Get Event Source Name
 */
function getEventSourceName(eventSource) {
  const sourceNames = {
    [ScriptApp.EventSource.SPREADSHEETS]: 'Spreadsheets',
    [ScriptApp.EventSource.FORMS]: 'Forms',
    [ScriptApp.EventSource.DOCUMENTS]: 'Documents',
    [ScriptApp.EventSource.CLOCK]: 'Clock (Time-driven)',
    [ScriptApp.EventSource.CALENDAR]: 'Calendar'
  };
  return sourceNames[eventSource] || 'Unknown';
}

/**
 * Helper: Get Event Type Name
 */
function getEventTypeName(eventType) {
  const typeNames = {
    [ScriptApp.EventType.ON_OPEN]: 'On Open',
    [ScriptApp.EventType.ON_EDIT]: 'On Edit',
    [ScriptApp.EventType.ON_FORM_SUBMIT]: 'On Form Submit',
    [ScriptApp.EventType.ON_CLICK]: 'On Click',
    [ScriptApp.EventType.ON_CHANGE]: 'On Change',
    [ScriptApp.EventType.ON_INSTALL]: 'On Install',
    [ScriptApp.EventType.ON_TIME]: 'On Time',
    [ScriptApp.EventType.ON_EVENT_UPDATED]: 'On Event Updated'
  };
  return typeNames[eventType] || 'Unknown';
}

/**
 * Helper: Get Trigger Source Name
 */
function getTriggerSourceName(triggerSource) {
  const sourceNames = {
    [ScriptApp.TriggerSource.SPREADSHEETS]: 'Spreadsheets',
    [ScriptApp.TriggerSource.FORMS]: 'Forms',
    [ScriptApp.TriggerSource.CLOCK]: 'Clock (Time-driven)',
    [ScriptApp.TriggerSource.DOCUMENTS]: 'Documents',
    [ScriptApp.TriggerSource.CALENDAR]: 'Calendar'
  };
  return sourceNames[triggerSource] || 'Unknown';
}

/**
 * Helper: Format Date
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

/**
 * ایجاد Menu
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 Scripts Info')
    .addItem('📝 List All Scripts & Triggers', 'listAllScripts')
    .addToUi();
}


