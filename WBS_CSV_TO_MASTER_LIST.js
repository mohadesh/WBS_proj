/**
 * Script for converting WBS_FEATURES_TABLE.csv to Master List format
 * This can be run with Node.js or adapted for Google Apps Script
 * 
 * Usage: node WBS_CSV_TO_MASTER_LIST.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  inputFile: 'WBS_FEATURES_TABLE.csv',
  outputFile: 'WBS_MASTER_LIST.csv',
  defaultTag: 'Vakav Website',
  defaultStatus: 'To Do',
  defaultPriority: '2. Medium',
  defaultPerson: '',
  defaultNotes: '',
  headerRow: 28,
  schedule: {
    enabled: true,
    startDate: '2025-07-20',
    endDate: '2025-11-10',
    minGroupDays: 3
  }
};

// Read CSV file
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 2) {
      rows.push(values);
    }
  }
  
  return { headers, rows };
}

// Parse CSV line (handles quoted values)
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

// Convert CSV rows to Master List format
function convertToMasterList(csvData, scheduleMap) {
  const masterRows = [];
  
  // Header for Master List
  const masterHeaders = [
    'Checkbox',
    'Task',
    'Tag',
    'WBS Group',
    'Start Date',
    'Deadline',
    'Days Left',
    'Priority',
    'Status',
    'Person In Charge',
    'Notes'
  ];
  
  // Convert each CSV row
  for (const row of csvData.rows) {
    const featureGroup = row[0] || '';
    const feature = row[1] || '';
    const subFeature = row[2] || '';
    
    // Determine Task (use sub-feature if exists, otherwise feature)
    const task = subFeature || feature;
    
    // Determine WBS Group
    let wbsGroup = featureGroup;
    if (feature && feature !== task) {
      wbsGroup = `${featureGroup} > ${feature}`;
    }
    
    const key = buildKey(featureGroup, feature, subFeature);
    const schedule = scheduleMap ? scheduleMap.get(key) : null;
    const startDate = schedule ? formatDate(schedule.start) : '';
    const deadline = schedule ? formatDate(schedule.end) : '';
    
    // Build Master List row
    masterRows.push([
      'FALSE', // Checkbox (FALSE for unchecked)
      task,
      CONFIG.defaultTag,
      wbsGroup,
      startDate,
      deadline,
      '', // Days Left (formula, will be calculated in Google Sheets)
      CONFIG.defaultPriority,
      CONFIG.defaultStatus,
      CONFIG.defaultPerson,
      CONFIG.defaultNotes
    ]);
  }
  
  return { headers: masterHeaders, rows: masterRows };
}

// Write to CSV
function writeCSV(filePath, data) {
  const lines = [];
  
  // Header
  lines.push(data.headers.join(','));
  
  // Rows
  for (const row of data.rows) {
    // Escape values that contain comma or quotes
    const escapedRow = row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    lines.push(escapedRow.join(','));
  }
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

// Main function
function main() {
  const inputPath = path.join(__dirname, CONFIG.inputFile);
  const outputPath = path.join(__dirname, CONFIG.outputFile);
  
  console.log('📖 Reading CSV file...');
  const csvData = readCSV(inputPath);
  console.log(`✅ Read ${csvData.rows.length} rows`);
  
  let scheduleMap = null;
  if (CONFIG.schedule?.enabled) {
    console.log(`🗓️ Generating schedule from ${CONFIG.schedule.startDate} to ${CONFIG.schedule.endDate}...`);
    scheduleMap = generateSchedule(
      csvData.rows,
      CONFIG.schedule.startDate,
      CONFIG.schedule.endDate,
      CONFIG.schedule
    );
    console.log(`✅ Schedule generated for ${scheduleMap.size} tasks`);
  }
  
  console.log('🔄 Converting to Master List format...');
  const masterData = convertToMasterList(csvData, scheduleMap);
  console.log(`✅ Converted ${masterData.rows.length} rows`);
  
  console.log('💾 Writing to output file...');
  writeCSV(outputPath, masterData);
  console.log(`✅ Saved to ${CONFIG.outputFile}`);
  
  console.log('\n✨ Conversion completed successfully!');
  console.log(`\n📋 Next steps:`);
  console.log(`1. Open ${CONFIG.outputFile}`);
  console.log(`2. Copy all data (Ctrl+A, Ctrl+C)`);
  console.log(`3. In Google Sheets Master List, paste starting from row ${CONFIG.headerRow + 1}`);
  console.log(`4. Use "Paste special" → "Values only" if needed`);
}

function generateSchedule(rows, startDateStr, endDateStr, options = {}) {
  if (!rows || rows.length === 0) return new Map();
  
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid start or end date supplied for schedule.');
  }
  
  const totalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  
  const groupMap = new Map();
  const groupList = [];
  
  for (const row of rows) {
    const featureGroup = (row[0] || 'General').trim();
    const feature = (row[1] || '').trim();
    const subFeature = (row[2] || '').trim();
    
    if (!groupMap.has(featureGroup)) {
      const groupObj = { name: featureGroup, rows: [] };
      groupMap.set(featureGroup, groupObj);
      groupList.push(groupObj);
    }
    
    groupMap.get(featureGroup).rows.push({
      group: featureGroup,
      feature,
      subFeature
    });
  }
  
  const minGroupDays = options.minGroupDays ?? 2;
  const groupItems = groupList.map(group => ({
    id: group.name,
    weight: group.rows.length
  }));
  
  const groupDurations = allocateDurations(groupItems, totalDays, minGroupDays);
  const scheduleMap = new Map();
  let currentDate = new Date(startDate);
  
  for (const group of groupList) {
    const duration = groupDurations.get(group.name) || minGroupDays;
    const groupStart = new Date(currentDate);
    const groupEnd = addDays(groupStart, duration - 1);
    
    for (const row of group.rows) {
      const key = buildKey(row.group, row.feature, row.subFeature);
      scheduleMap.set(key, { start: new Date(groupStart), end: new Date(groupEnd) });
    }
    
    currentDate = addDays(groupEnd, 1);
  }
  
  return scheduleMap;
}

function allocateDurations(items, totalDays, minDays) {
  if (!items || items.length === 0) return new Map();
  
  const allocations = new Map();
  let effectiveMinDays = minDays;
  
  if (effectiveMinDays * items.length > totalDays) {
    effectiveMinDays = Math.max(1, Math.floor(totalDays / items.length));
  }
  
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0) || items.length;
  const details = [];
  let allocated = 0;
  
  items.forEach(item => {
    const weight = item.weight || 1;
    const exact = (weight / totalWeight) * totalDays;
    const base = Math.max(effectiveMinDays, Math.floor(exact));
    allocations.set(item.id, base);
    details.push({ id: item.id, frac: exact - Math.floor(exact) });
    allocated += base;
  });
  
  let remaining = totalDays - allocated;
  
  if (remaining > 0) {
    details.sort((a, b) => b.frac - a.frac);
    let idx = 0;
    while (remaining > 0) {
      const id = details[idx % details.length].id;
      allocations.set(id, allocations.get(id) + 1);
      remaining--;
      idx++;
    }
  } else if (remaining < 0) {
    const reducible = details
      .map(detail => detail.id)
      .filter(id => allocations.get(id) > effectiveMinDays);
    
    let idx = 0;
    while (remaining < 0 && reducible.length > 0) {
      const id = reducible[idx % reducible.length];
      if (allocations.get(id) > effectiveMinDays) {
        allocations.set(id, allocations.get(id) - 1);
        remaining++;
      }
      idx++;
      if (idx > reducible.length * 5) break;
    }
  }
  
  return allocations;
}

function buildKey(group, feature, subFeature) {
  return `${group}||${feature}||${subFeature}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Run if executed directly
const scriptArgPath = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
const isMainModule = (scriptArgPath && import.meta.url === `file://${scriptArgPath}`) ||
                     (scriptArgPath && import.meta.url.endsWith(scriptArgPath));

if (isMainModule) {
  try {
    main();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

export { convertToMasterList, readCSV, writeCSV };

