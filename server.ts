import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import xml2js from 'xml2js';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function extractSectionBFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is missing.");
    return "";
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const base64Data = imageBuffer.toString('base64');
    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/png',
        data: base64Data
      }
    };

    const textPart = {
      text: `buatkan list dari gambar ini

Petunjuk Khusus untuk Analis SOC SIEM:
Analisis gambar dashboard SIEM ini (heatmap / matriks / tabel Destination IP & Count of Hits & Port).
Ekstrak secara presisi semua Destination IP, Total Hits (wajib dibaca dari kolom "Count of Hits" pada tabel di gambar, contoh: 51,810 atau 8,529 atau 5,017 atau 1,917), serta rincian Port beserta jumlah hits per port dari gambar.

Format output WAJIB persis seperti contoh berikut:

1. Destination IP: [IP] (Total Hits: [Hits dari tabel])
Port [Port] : [Hits]
Port [Port] : [Hits]

2. Destination IP: [IP] (Total Hits: [Hits dari tabel])
Port [Port] : [Hits]

Aturan:
1. Hanya keluarkan teks daftar tanpa judul "B. Destination IP & Port Detected:", tanpa kata sambutan, dan tanpa markdown codeblock (\`\`\`).
2. Pastikan nilai Total Hits diambil LANGSUNG dari nilai "Count of Hits" pada tabel gambar (misalnya 172.16.1.17 mempunyai Total Hits: 5,017).
3. Urutkan Destination IP sesuai daftar di gambar.`
    };

    let text = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: { parts: [imagePart, textPart] }
      });
      text = response.text ? response.text.trim() : "";
    } catch (e1: any) {
      console.warn("gemini-3.6-flash failed in extractSectionBFromImage, trying gemini-flash-latest:", e1.message);
      try {
        const response2 = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: { parts: [imagePart, textPart] }
        });
        text = response2.text ? response2.text.trim() : "";
      } catch (e2: any) {
        console.error("All Gemini Vision models failed:", e2.message);
      }
    }

    text = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    return text;
  } catch (err: any) {
    console.error("Gemini Vision OCR error:", err);
    return "";
  }
}

function extractEventName(e: any): string {
  if (!e) return "";
  if (e.event_name) {
    const clean = String(e.event_name).trim().replace(/^"|"$/g, '');
    if (clean && clean !== '-' && clean.toLowerCase() !== 'suricata' && clean.toLowerCase() !== 'qradar' && clean.toLowerCase() !== 'misc attack' && clean.toLowerCase() !== 'offenses' && clean.toLowerCase() !== 'offensess') {
      return clean;
    }
  }
  if (e.event_type) {
    const cleanType = String(e.event_type).trim().replace(/^"|"$/g, '');
    if (cleanType && cleanType !== '-' && cleanType.toLowerCase() !== 'offenses' && cleanType.toLowerCase() !== 'offensess' && cleanType.toLowerCase() !== 'log activity' && cleanType.toLowerCase() !== 'suricata' && cleanType.toLowerCase() !== 'qradar' && cleanType.toLowerCase() !== 'misc attack' && cleanType.toLowerCase() !== 'misc activity') {
      return cleanType;
    }
  }
  if (e._rawLine) {
    const etMatch = String(e._rawLine).match(/\b(ET\s+[A-Za-z0-9_\-\.\s\(\)\*\/:]+?)(?=\t|\s{2,}|$|"|M1|M2|M3|M4|M5|Low|Medium|High|Critical)/i);
    if (etMatch && etMatch[1].trim().length > 5) {
      return etMatch[1].trim();
    }
  }
  if (e.description) {
    const cleanDesc = String(e.description).trim().replace(/^"|"$/g, '');
    if (cleanDesc && cleanDesc !== '-') return cleanDesc;
  }
  return String(e.event_name || e.event_type || "").trim().replace(/^"|"$/g, '');
}

function buildDestinationIpPortsFromEvents(data: any[]): string {
  if (!data || data.length === 0) return "Tidak ada data Destination IP & Port detected";

  const ipMap: Record<string, { totalHits: number; ports: Record<string, number> }> = {};

  for (const item of data) {
    const rawIpStr = String(item.dst_ip || item.destinationIP || item.destination_ip || '').replace(/<br\s*\/?>/gi, '\n');
    const rawPortStr = String(item.dst_port || item.destinationPort || item.destination_port || '').replace(/<br\s*\/?>/gi, '\n');

    const ips = rawIpStr.split(/[\r\n,\s]+/).map(s => s.trim().replace(/^"|"$/g, '')).filter(s => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s));
    const ports = rawPortStr.split(/[\r\n,\s]+/).map(s => s.trim().replace(/^"|"$/g, '')).filter(s => /^\d+$/.test(s));

    if (ips.length === 0) continue;

    for (const ip of ips) {
      if (!ipMap[ip]) {
        ipMap[ip] = { totalHits: 0, ports: {} };
      }
      ipMap[ip].totalHits++;

      if (ports.length > 0) {
        for (const p of ports) {
          ipMap[ip].ports[p] = (ipMap[ip].ports[p] || 0) + 1;
        }
      } else {
        ipMap[ip].ports["-"] = (ipMap[ip].ports["-"] || 0) + 1;
      }
    }
  }

  const ipEntries = Object.entries(ipMap);
  if (ipEntries.length === 0) return "Tidak ada data Destination IP & Port detected";

  ipEntries.sort((a, b) => {
    const numA = a[0].split('.').map(n => parseInt(n, 10));
    const numB = b[0].split('.').map(n => parseInt(n, 10));
    for (let i = 0; i < 4; i++) {
      if (numA[i] !== numB[i]) return numA[i] - numB[i];
    }
    return 0;
  });

  const lines: string[] = [];
  ipEntries.forEach(([ip, info], idx) => {
    lines.push(`${idx + 1}. Destination IP: ${ip} (Total Hits: ${info.totalHits})`);
    const portEntries = Object.entries(info.ports);
    for (const [p, hits] of portEntries) {
      lines.push(`Port ${p} : ${hits}`);
    }
    if (idx < ipEntries.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\n").trim();
}

// Ensure required directories exist (skip on Vercel to avoid EROFS error on read-only system)
if (!process.env.VERCEL) {
  fs.mkdirSync('input', { recursive: true });
  fs.mkdirSync('outputs', { recursive: true });
  fs.mkdirSync('templates', { recursive: true });
  fs.mkdirSync('database', { recursive: true });
}

// Synchronous folder copy helper for Vercel /tmp environment
function copyFolderSync(from: string, to: string) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  const elements = fs.readdirSync(from);
  for (const element of elements) {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.statSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

// Dynamically resolve templates and database folders to writable /tmp on Vercel
function getTemplatesDir(): string {
  if (process.env.VERCEL) {
    const tmpTemplates = '/tmp/templates';
    if (!fs.existsSync(tmpTemplates)) {
      copyFolderSync(path.join(process.cwd(), 'templates'), tmpTemplates);
    }
    return tmpTemplates;
  }
  return path.join(process.cwd(), 'templates');
}

function getDatabaseDir(): string {
  if (process.env.VERCEL) {
    const tmpDatabase = '/tmp/database';
    if (!fs.existsSync(tmpDatabase)) {
      copyFolderSync(path.join(process.cwd(), 'database'), tmpDatabase);
    }
    return tmpDatabase;
  }
  return path.join(process.cwd(), 'database');
}

// Helper to automatically fit column widths for a JSON worksheet
function autoFitJsonColumns(worksheet: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const colWidths = keys.map(key => {
    let maxLen = key.length;
    for (const row of data) {
      const val = row[key];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    // Limit specific wide columns to avoid excessively wide columns in Excel
    if (key === 'escapedFormattedOffenseSource') {
      maxLen = Math.min(maxLen, 30);
    } else if (key === 'description') {
      maxLen = Math.min(maxLen, 40);
    }
    return maxLen;
  });
  worksheet['!cols'] = colWidths.map(w => ({ wch: Math.max(w + 3, 10) }));
}

// Helper to set auto-filter on all columns for a JSON worksheet
function addAutoFilter(worksheet: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const totalRows = data.length;
  const totalCols = Object.keys(data[0]).length;
  
  const getColLetter = (colIndex: number): string => {
    let letter = '';
    let temp = colIndex;
    while (temp > 0) {
      let modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - modulo) / 26);
    }
    return letter;
  };
  
  const lastColLetter = getColLetter(totalCols);
  worksheet['!autofilter'] = { ref: `A1:${lastColLetter}${totalRows + 1}` };
}

// Helper to style a raw data worksheet with Green Table Style Medium 7 (with alternating rows)
function styleRawSheet(worksheet: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const totalCols = Object.keys(data[0]).length;
  const totalRows = data.length;
  
  const getColLetter = (colIndex: number): string => {
    let letter = '';
    let temp = colIndex;
    while (temp > 0) {
      let modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - modulo) / 26);
    }
    return letter;
  };

  const thinBorder = { style: 'thin', color: { rgb: 'D9D9D9' } };

  // Style Header Row (row 1)
  for (let c = 1; c <= totalCols; c++) {
    const colLetter = getColLetter(c);
    const cellKey = `${colLetter}1`;
    const cell = worksheet[cellKey];
    if (cell) {
      cell.s = {
        font: { bold: true, name: 'Calibri', sz: 11, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '76933C' } }, // Green, Table Style Medium 7 Header Green
        border: {
          top: thinBorder,
          bottom: thinBorder,
          left: thinBorder,
          right: thinBorder
        },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
    }
  }

  // Style Data Rows (row 2 to totalRows + 1)
  for (let r = 2; r <= totalRows + 1; r++) {
    const isAlternate = (r % 2 === 1); // Row 3, 5, 7... are light green
    const rowBgColor = isAlternate ? 'E2EFDA' : 'FFFFFF'; // Elegant Excel light green for Medium 7

    for (let c = 1; c <= totalCols; c++) {
      const colLetter = getColLetter(c);
      const cellKey = `${colLetter}${r}`;
      const cell = worksheet[cellKey];
      if (cell) {
        cell.s = {
          font: { name: 'Calibri', sz: 11, color: { rgb: '000000' } },
          fill: { patternType: 'solid', fgColor: { rgb: rowBgColor } },
          border: {
            top: thinBorder,
            bottom: thinBorder,
            left: thinBorder,
            right: thinBorder
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }
    }
  }
}

// Helper to create native Excel Pivot Table with row outlines ([1][2] and [+] / [-] buttons) and AutoFilter dropdowns
async function generateAalExcelWithExcelJS(
  filePath: string,
  aalPivotData: any[],
  parsedData: any[],
  totalCount: number,
  valueColName: string = "source.ip",
  rawSheetName: string = "Raw Data"
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cybersecurity Team';

  // ==========================================
  // SHEET 1: "Source IP Detected" (Pivot View with Outlines & AutoFilter)
  // ==========================================
  const pivotSheet = workbook.addWorksheet("Source IP Detected", {
    views: [{ showGridLines: true }],
    properties: {
      outlineProperties: {
        summaryBelow: false, // Ensures summary/IP row sits above detail rows with [+] button on IP row
        summaryRight: false
      }
    }
  });

  // Rows 1 & 2: Blank spacing
  pivotSheet.addRow([]);
  pivotSheet.addRow([]);

  // Row 3: Header Row ("Row Labels", "Count of botnetdomain")
  const headerRow = pivotSheet.addRow(["Row Labels", `Count of ${valueColName}`]);
  headerRow.height = 24;

  const pivotHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCE6F1' } // Soft pivot blue #DCE6F1
  };
  const pivotHeaderFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: 'FF000000' },
    name: 'Calibri',
    size: 11
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  headerRow.getCell(1).fill = pivotHeaderFill;
  headerRow.getCell(1).font = pivotHeaderFont;
  headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  headerRow.getCell(1).border = thinBorder;

  headerRow.getCell(2).fill = pivotHeaderFill;
  headerRow.getCell(2).font = pivotHeaderFont;
  headerRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
  headerRow.getCell(2).border = thinBorder;

  let currentRowIdx = 3;

  aalPivotData.forEach(group => {
    // Parent IP Row (level 0)
    const ipRow = pivotSheet.addRow([group.ip, group.subtotal]);
    currentRowIdx++;
    ipRow.height = 20;
    ipRow.outlineLevel = 0;

    const ipFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: 'FF000000' },
      name: 'Calibri',
      size: 11
    };

    ipRow.getCell(1).font = ipFont;
    ipRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    ipRow.getCell(1).border = thinBorder;

    ipRow.getCell(2).font = ipFont;
    ipRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    ipRow.getCell(2).border = thinBorder;
    ipRow.getCell(2).numFmt = '#,##0';

    // Child Domain Rows (level 1, hidden by default so [+] button appears on IP row)
    group.domains.forEach((d: any) => {
      const domainRow = pivotSheet.addRow([d.domain, d.count]);
      currentRowIdx++;
      domainRow.height = 18;
      domainRow.outlineLevel = 1;
      domainRow.hidden = true; // Enables [+] expand button in Excel

      domainRow.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
      domainRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
      domainRow.getCell(1).border = thinBorder;

      domainRow.getCell(2).font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
      domainRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      domainRow.getCell(2).border = thinBorder;
      domainRow.getCell(2).numFmt = '#,##0';
    });
  });

  // Grand Total Row
  const totalRow = pivotSheet.addRow(["Grand Total", totalCount]);
  currentRowIdx++;
  totalRow.height = 22;
  totalRow.outlineLevel = 0;

  const doubleBottomBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'double', color: { argb: 'FF333333' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  totalRow.getCell(1).fill = pivotHeaderFill;
  totalRow.getCell(1).font = pivotHeaderFont;
  totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  totalRow.getCell(1).border = doubleBottomBorder;

  totalRow.getCell(2).fill = pivotHeaderFill;
  totalRow.getCell(2).font = pivotHeaderFont;
  totalRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(2).border = doubleBottomBorder;
  totalRow.getCell(2).numFmt = '#,##0';

  pivotSheet.getColumn(1).width = 38;
  pivotSheet.getColumn(2).width = 24;

  // AutoFilter dropdown arrow on Row Labels & Count headers (row 3)
  pivotSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: currentRowIdx, column: 2 }
  };


  // ==========================================
  // SHEET 2: Raw Log Data (Exact Table Style Medium 7 Green)
  // ==========================================
  const rawSheet = workbook.addWorksheet(rawSheetName, {
    views: [{ showGridLines: true }]
  });

  if (parsedData && parsedData.length > 0) {
    const keys = Object.keys(parsedData[0]);
    
    // Header Row 1
    const rawHeaderRow = rawSheet.addRow(keys);
    rawHeaderRow.height = 24;

    const rawHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF76933C' } // Table Style Medium 7 Green #76933C
    };

    rawHeaderRow.eachCell((cell) => {
      cell.fill = rawHeaderFill;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = thinBorder;
    });

    // Data Rows with alternating background #E2EFDA and #FFFFFF
    parsedData.forEach((item, idx) => {
      const rowValues = keys.map(k => item[k]);
      const dataRow = rawSheet.addRow(rowValues);
      dataRow.height = 18;

      const isAlternate = (idx % 2 === 1);
      const rowFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAlternate ? 'FFE2EFDA' : 'FFFFFFFF' }
      };

      dataRow.eachCell((cell) => {
        cell.fill = rowFill;
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.border = thinBorder;
      });
    });

    // Auto-fit column widths
    keys.forEach((key, colIdx) => {
      let maxLen = key.length;
      parsedData.forEach(row => {
        const valStr = String(row[key] || '');
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      rawSheet.getColumn(colIdx + 1).width = Math.min(Math.max(maxLen + 4, 12), 60);
    });

    // AutoFilter on raw data header
    rawSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: parsedData.length + 1, column: keys.length }
    };
  }

  await workbook.xlsx.writeFile(filePath);
}

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer storage configuration for parsing uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.VERCEL ? '/tmp' : 'input/';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({
  storage,
  limits: {
    fieldSize: 100 * 1024 * 1024, // 100MB max field value size
    fileSize: 100 * 1024 * 1024,  // 100MB max file upload size
    fields: 100,
    files: 10
  }
});

// Constants and Mappings
const SHIFTS: Record<string, [string, string]> = {
  "3": ["Selamat Pagi", "00.00 - 08.00"],
  "1": ["Selamat Sore", "08.00 - 16.00"],
  "2": ["Selamat Malam", "16.00 - 00.00"],
};

// Utilities matching Python logic
function verticalize(raw: string): string {
  if (!raw || raw === "-") return "-";
  const lines = raw.split(/\r?\n/).map(x => x.trim()).filter(x => x.length > 0);
  return lines.length > 0 ? lines.join("<br>\n") + "<br>" : "-";
}

function normalize(text: string): string {
  if (!text) return "";
  let t = text.replace(/\xa0/g, " ");
  t = t.trim().toLowerCase();
  t = t.replace(/\s+/g, " ");
  return t;
}

function formatEventName(templateName: string): string {
  const SPECIAL_CASES: Record<string, string> = { "Ip": "IP", "Url": "URL", "Sql": "SQL", "Dns": "DNS" };
  let clean = templateName.replace(/[_\-]+/g, ' ');
  clean = clean.replace(/\.txt$/i, '');
  const words = clean.split(/\s+/).map(w => {
    const title = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return SPECIAL_CASES[title] || title;
  });
  return words.join(' ').trim();
}

function categorizeMagnitude(mag: number): string {
  if (mag >= 1 && mag <= 3) return "Low";
  if (mag >= 4 && mag <= 6) return "Medium";
  if (mag >= 7 && mag <= 10) return "High";
  return "Unknown";
}

function findTemplateFile(instansi: string, eventName: string): string | null {
  const baseDir = path.join(getTemplatesDir(), instansi.toLowerCase());
  if (!fs.existsSync(baseDir)) return null;

  const targetClean = eventName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const files = fs.readdirSync(baseDir);
  for (const file of files) {
    if (file === 'event_template.txt' || file.startsWith('.') || fs.statSync(path.join(baseDir, file)).isDirectory()) continue;
    const fileClean = file.replace(/\.txt$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (fileClean === targetClean) {
      return path.join(baseDir, file);
    }
  }
  return null;
}

function findTemplateInRawText(instansi: string, rawText: string): string | null {
  if (!rawText) return null;
  const baseDir = path.join(getTemplatesDir(), instansi.toLowerCase());
  if (!fs.existsSync(baseDir)) return null;

  const files = fs.readdirSync(baseDir);
  const sortedFiles = files
    .filter(f => {
      if (f === 'event_template.txt' || f.startsWith('.') || f.startsWith('wa_template_')) return false;
      if (fs.statSync(path.join(baseDir, f)).isDirectory()) return false;
      return true;
    })
    .sort((a, b) => b.length - a.length);

  const normalizedRaw = rawText.toLowerCase().replace(/\s+/g, ' ');

  for (const file of sortedFiles) {
    const templateName = file.endsWith('.txt') ? file.replace(/\.txt$/i, '') : file;
    const cleanTemplateName = templateName.toLowerCase().replace(/\s+/g, ' ');
    if (normalizedRaw.includes(cleanTemplateName)) {
      return path.join(baseDir, file);
    }
  }
  return null;
}

function applyHeuristicCorrections(eventData: any, rawLine: string, instansi: string): any {
  let corrected = { ...eventData };

  const isAal = instansi.toLowerCase() === 'aal';

  if (isAal) {
    let parts = rawLine.split('\t').map(p => p.trim());
    if (parts.length < 5) {
      parts = rawLine.split(/ {2,}/).map(p => p.trim());
    }

    const cleanQuote = (q: string) => {
      if (!q) return "";
      let val = q.replace(/^"|"$/g, '').trim();
      val = val.replace(/\\n/g, '\n');
      return val;
    };

    // 1. Basic Fields (ID, Analyst, Ticket)
    if (parts.length > 0) corrected.event_id = parts[0] || corrected.event_id;
    if (parts.length > 1) corrected.analyst = parts[1] || corrected.analyst;
    
    // Find Suricata-Events or Alert Group index
    const suricataIdx = parts.indexOf('Suricata-Events');
    if (suricataIdx !== -1) {
      corrected.ticket_id = parts[suricataIdx] || corrected.ticket_id;
      if (parts.length > suricataIdx + 1) corrected.event_type = parts[suricataIdx + 1] || corrected.event_type;
    }

    // 2. Find template matching
    const matchedTemplateFile = findTemplateInRawText(instansi, rawLine);
    if (matchedTemplateFile) {
      corrected.event_name = path.basename(matchedTemplateFile, '.txt').replace(/\.txt$/i, '');
    } else {
      if (suricataIdx !== -1 && parts.length > suricataIdx + 2) {
        corrected.event_name = parts[suricataIdx + 2] || corrected.event_name;
      } else if (parts.length > 4) {
        corrected.event_name = parts[4] || corrected.event_name;
      }
    }

    // 3. Robust IP & Connection details search (Independent of column offsets!)
    const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    const ipFieldIndices: number[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (ipRegex.test(parts[i])) {
        ipFieldIndices.push(i);
      }
    }

    if (ipFieldIndices.length > 0) {
      const srcIpIdx = ipFieldIndices[0];
      corrected.src_ip = verticalize(cleanQuote(parts[srcIpIdx]));
      
      // Source country is the next non-empty field (if not another IP)
      let nextIdx = srcIpIdx + 1;
      while (nextIdx < parts.length && parts[nextIdx].trim() === '') {
        nextIdx++;
      }
      if (nextIdx < parts.length && !ipRegex.test(parts[nextIdx])) {
        corrected.src_country = cleanQuote(parts[nextIdx]);
      }

      // Find the destination IP field (the next field containing an IP)
      const dstIpIdx = ipFieldIndices.find(idx => idx > srcIpIdx);
      if (dstIpIdx !== undefined) {
        corrected.dst_ip = verticalize(cleanQuote(parts[dstIpIdx]));
        
        // Destination port is typically the field after dst_ip
        if (dstIpIdx + 1 < parts.length) {
          corrected.dst_port = verticalize(cleanQuote(parts[dstIpIdx + 1]));
        }
        // Destination country is after dst_port
        if (dstIpIdx + 2 < parts.length) {
          corrected.dst_country = cleanQuote(parts[dstIpIdx + 2]);
          corrected.dst_desc = corrected.dst_country;
        }
      }
    }

    // 4. Map other metadata fields using patterns
    // Severity
    const severities = ['high', 'medium', 'low', 'critical'];
    const foundSeverity = parts.find(p => severities.includes(p.toLowerCase()));
    if (foundSeverity) {
      corrected.magnitude = foundSeverity.charAt(0).toUpperCase() + foundSeverity.slice(1).toLowerCase();
    } else if (suricataIdx !== -1 && parts.length > suricataIdx + 3) {
      corrected.magnitude = parts[suricataIdx + 3] || corrected.magnitude;
    }

    // Date
    const foundDate = parts.find(p => /\b\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}\b/.test(p));
    if (foundDate) {
      corrected.tanggal = foundDate;
    } else if (suricataIdx !== -1 && parts.length > suricataIdx + 4) {
      corrected.tanggal = parts[suricataIdx + 4] || corrected.tanggal;
    }

    // Time
    const timeFields = parts.filter(p => {
      const cleanP = p.trim();
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(cleanP)) return true;
      if (/^\d{2}\.\d{2}(\.\d{2})?$/.test(cleanP)) return true;
      return false;
    });
    if (timeFields.length > 0) {
      corrected.waktu = timeFields[0];
    } else if (suricataIdx !== -1 && parts.length > suricataIdx + 5) {
      corrected.waktu = parts[suricataIdx + 5] || corrected.waktu;
    }

    // Action, Status, Traffic Flow
    const foundAction = parts.find(p => p.toLowerCase().includes('block ip on edl') || p.toLowerCase().includes('block') || p.toLowerCase().includes('allow') || p.toLowerCase() === 'close');
    if (foundAction) {
      corrected.action = foundAction;
    } else if (suricataIdx !== -1 && parts.length > suricataIdx + 7) {
      corrected.action = parts[suricataIdx + 7] || corrected.action;
    }

    const foundStatus = parts.find(p => p.toLowerCase() === 'close' || p.toLowerCase() === 'closed' || p.toLowerCase() === 'open');
    if (foundStatus) {
      corrected.event_status = foundStatus;
      if (foundStatus.toLowerCase() === 'close' || foundStatus.toLowerCase() === 'closed') {
        // Only set action to Closed if there isn't already a more specific action
        if (!corrected.action || corrected.action === '-' || corrected.action.toLowerCase() === 'close' || corrected.action.toLowerCase() === 'closed') {
          corrected.action = 'Closed';
        }
      }
    } else if (suricataIdx !== -1 && parts.length > suricataIdx + 8) {
      corrected.event_status = parts[suricataIdx + 8] || corrected.event_status;
    }

    const foundFlow = parts.find(p => p.toLowerCase().includes('to private') || p.toLowerCase().includes('to public') || p.toLowerCase().includes('internal'));
    if (foundFlow) {
      corrected.traffic_flow = foundFlow;
    } else if (suricataIdx !== -1 && parts.length > suricataIdx + 9) {
      corrected.traffic_flow = parts[suricataIdx + 9] || corrected.traffic_flow;
    }
      
    // 6. Intelligent Domain/URL & Query heuristics (run inside AAL block too!)
    const isLikelyDomainOrUrl = (str: string): boolean => {
      if (!str) return false;
      const clean = str.trim();
      if (clean.includes(' ') || clean.includes('\t')) return false;
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) return false;
      if (clean.toLowerCase().startsWith('http://') || clean.toLowerCase().startsWith('https://')) return true;
      return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}(\/.*)?$/.test(clean);
    };

    const getDomainsFromParts = (): string[] => {
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        if (!part) continue;
        if (/^\d+$/.test(part.trim())) continue;
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part.trim())) continue;
        
        const cleaned = part.replace(/^"|"$/g, '').trim();
        const subLines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        
        const candidateDomains: string[] = [];
        for (const line of subLines) {
          const words = line.split(/[\s\t]+/).map(w => w.replace(/^"|"$/g, '').trim());
          for (const w of words) {
            if (isLikelyDomainOrUrl(w)) {
              candidateDomains.push(w);
            }
          }
        }
        
        if (candidateDomains.length > 0) {
          return candidateDomains;
        }
      }
      return [];
    };

    const foundDomains = getDomainsFromParts();

    // If a field got a domain due to column shifting, prioritize that!
    const shiftKeys = ['src_country', 'dst_port', 'dst_country'];
    for (const key of shiftKeys) {
      if (corrected[key]) {
        const cleaned = corrected[key].replace(/^"|"$/g, '').trim();
        const subLines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const shiftDomains = subLines.filter(l => isLikelyDomainOrUrl(l));
        if (shiftDomains.length > 0) {
          corrected[key] = '-'; // reset the shifted field
          if (key === 'dst_country') {
            corrected.dst_desc = '-';
          }
        }
      }
    }

    if (foundDomains.length > 0) {
      const verticalDomains = verticalize(foundDomains.join('\n'));
      if (!corrected.url || corrected.url === '-' || corrected.url === '') {
        corrected.url = verticalDomains;
      }
      if (!corrected.query || corrected.query === '-' || corrected.query === '') {
        corrected.query = verticalDomains;
      }
    }

    // Correct IP Port split issues (e.g. "8.8.8.8 53")
    const lineParts = rawLine.split(/[\s\t]+/).map(p => p.trim());
    const ipPortPattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d+)$/;
    const foundIpPortPart = lineParts.find(p => ipPortPattern.test(p));
    if (foundIpPortPart) {
      const match = foundIpPortPart.match(ipPortPattern);
      if (match) {
        corrected.dst_ip = match[1];
        corrected.dst_port = match[2];
      }
    } else {
      for (const key of ['src_country', 'dst_ip', 'dst_port', 'dst_country']) {
        if (corrected[key] && ipPortPattern.test(corrected[key].trim())) {
          const match = corrected[key].trim().match(ipPortPattern);
          if (match) {
            corrected.dst_ip = match[1];
            corrected.dst_port = match[2];
            if (key !== 'dst_ip' && key !== 'dst_port') {
              corrected[key] = '-';
            }
          }
        }
      }
    }

    // If dst_ip is country-like due to shift, move it to country
    if (corrected.dst_ip && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(corrected.dst_ip)) {
      if (corrected.dst_ip === 'United States' || corrected.dst_ip === 'ID' || corrected.dst_ip === 'Indonesia') {
        corrected.dst_country = corrected.dst_ip;
        corrected.dst_desc = corrected.dst_ip;
        corrected.dst_ip = '-';
      }
    }

    return corrected;
  }

  if (instansi.toLowerCase() === 'medika' || instansi.toLowerCase() === 'asei') {
    const parts = rawLine.split('\t').map(p => {
      let clean = p.trim();
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.substring(1, clean.length - 1).trim();
      }
      return clean;
    });

    // Find the index of the traffic flow column dynamically to determine column mapping
    const flowIdx = parts.findIndex(p => {
      const l = p.toLowerCase();
      return l.includes('to private') || 
             l.includes('to public') || 
             l.includes('internal to') || 
             l.includes('external to') || 
             l === 'internal' || 
             l === 'external' || 
             l === 'public to private' || 
             l === 'private to public';
    });

    const isAsei = instansi.toLowerCase() === 'asei';

    if (flowIdx !== -1) {
      corrected.traffic_flow = parts[flowIdx];
      corrected.src_ip = verticalize(parts[flowIdx + 1]);
      corrected.src_country = verticalize(parts[flowIdx + 2]);
      
      const rawDstIps = (parts[flowIdx + 3] || '').split(/\r?\n/).map(s => s.trim().replace(/^"|"$/g, '')).filter(s => s.length > 0);
      const rawHosts = (parts[flowIdx + 5] || '').split(/\r?\n/).map(s => s.trim().replace(/^"|"$/g, '')).filter(s => s.length > 0);
      
      if (rawDstIps.length > 0 && rawHosts.length > 0) {
        if (isAsei) {
          let host = rawHosts[0] || 'Internal';
          if (!host.startsWith('(')) host = `(${host}`;
          if (!host.endsWith(')')) host = `${host})`;
          corrected.dst_ip = [...rawDstIps, host].join('\n');
        } else {
          const formattedDstIps = rawDstIps.map((ip, i) => {
            let host = rawHosts[i] !== undefined ? rawHosts[i] : (rawHosts[0] || '');
            if (host) {
              if (!host.startsWith('(')) host = `(${host}`;
              if (!host.endsWith(')')) host = `${host})`;
              return `${ip} ${host}`;
            }
            return ip;
          });
          corrected.dst_ip = formattedDstIps.join('\n');
        }
      } else {
        const vert = verticalize(parts[flowIdx + 3]);
        if (isAsei && parts[flowIdx + 5] && parts[flowIdx + 5].toLowerCase().includes('internal')) {
          corrected.dst_ip = `${vert}\n(Internal)`;
        } else {
          corrected.dst_ip = vert;
        }
      }

      corrected.dst_port = verticalize(parts[flowIdx + 4]);
      
      if (parts[flowIdx + 5]) {
        const nextField = parts[flowIdx + 5].toLowerCase();
        if (!nextField.includes('mozilla') && !nextField.includes('chrome') && !nextField.includes('safari') && nextField !== 'internal' && nextField !== 'external') {
          corrected.dst_country = parts[flowIdx + 5];
          corrected.dst_desc = parts[flowIdx + 5];
        } else {
          corrected.dst_country = '-';
          corrected.dst_desc = '-';
        }
      } else {
        corrected.dst_country = '-';
        corrected.dst_desc = '-';
      }
    } else {
      // Fallback to standard indices if flowIdx is not found
      corrected.src_ip = verticalize(parts[20]);
      corrected.src_country = verticalize(parts[21]);

      const rawDstIps = (parts[22] || '').split(/\r?\n/).map(s => s.trim().replace(/^"|"$/g, '')).filter(s => s.length > 0);
      const rawHosts = (parts[24] || '').split(/\r?\n/).map(s => s.trim().replace(/^"|"$/g, '')).filter(s => s.length > 0);

      if (rawDstIps.length > 0 && rawHosts.length > 0) {
        if (isAsei) {
          let host = rawHosts[0] || 'Internal';
          if (!host.startsWith('(')) host = `(${host}`;
          if (!host.endsWith(')')) host = `${host})`;
          corrected.dst_ip = [...rawDstIps, host].join('\n');
        } else {
          const formattedDstIps = rawDstIps.map((ip, i) => {
            let host = rawHosts[i] !== undefined ? rawHosts[i] : (rawHosts[0] || '');
            if (host) {
              if (!host.startsWith('(')) host = `(${host}`;
              if (!host.endsWith(')')) host = `${host})`;
              return `${ip} ${host}`;
            }
            return ip;
          });
          corrected.dst_ip = formattedDstIps.join('\n');
        }
      } else {
        const vert = verticalize(parts[22]);
        if (isAsei && parts[24] && parts[24].toLowerCase().includes('internal')) {
          corrected.dst_ip = `${vert}\n(Internal)`;
        } else {
          corrected.dst_ip = vert;
        }
      }

      corrected.dst_port = verticalize(parts[23]);
      corrected.dst_country = parts[24] || '-';
      corrected.dst_desc = parts[24] || '-';
    }

    if (isAsei && corrected.dst_ip && corrected.dst_ip.includes('(Internal)')) {
      const lines = corrected.dst_ip.split('\n').map((l: string) => l.replace(/\s*\(Internal\)/gi, '').trim()).filter((l: string) => l.length > 0);
      if (lines.length > 0) {
        corrected.dst_ip = [...lines, '(Internal)'].join('\n');
      }
    }

    // Preserve specific alert name in event_name before event_type is overwritten
    if (!corrected.event_name || corrected.event_name === '-' || corrected.event_name.toLowerCase() === 'suricata' || corrected.event_name.toLowerCase() === 'misc attack') {
      if (corrected.event_type && corrected.event_type !== '-' && corrected.event_type.toLowerCase() !== 'suricata' && corrected.event_type.toLowerCase() !== 'offenses' && corrected.event_type.toLowerCase() !== 'misc attack') {
        corrected.event_name = corrected.event_type;
      } else if (rawLine) {
        const etMatch = rawLine.match(/\b(ET\s+[A-Za-z0-9_\-\.\s\(\)\*\/:]+?)(?=\t|\s{2,}|$|"|M1|M2|M3|M4|M5|Low|Medium|High|Critical)/i);
        if (etMatch && etMatch[1].trim().length > 5) {
          corrected.event_name = etMatch[1].trim();
        }
      }
    }

    // Force "Misc Attack" and "Allowed" for Suricata/CINS/Spamhaus/Dshield events
    const isSuricata = (corrected.event_type && corrected.event_type.toLowerCase() === 'suricata') || 
                       rawLine.toLowerCase().includes('suricata') || 
                       rawLine.toLowerCase().includes('et cins') || 
                       rawLine.toLowerCase().includes('et drop') || 
                       rawLine.toLowerCase().includes('spamhaus') || 
                       rawLine.toLowerCase().includes('dshield');

    const isImapsBrute = rawLine.toLowerCase().includes('rapid imaps') || rawLine.toLowerCase().includes('brute force attack');
    const isPhpInfo = rawLine.toLowerCase().includes('phpinfo') || rawLine.toLowerCase().includes('web-php');
    const isNmap = (rawLine.toLowerCase().includes('nmap') || rawLine.toLowerCase().includes('et scan')) && !isImapsBrute && !isPhpInfo;

    if (isImapsBrute) {
      corrected.event_type = 'Misc Activity';
      corrected.action = 'Allow';
    } else if (isPhpInfo) {
      corrected.event_type = 'Information Leak';
      corrected.action = 'Allowed';

      // Robustly determine app_access or payload
      let extractedPayload = '';

      // 1. Regex direct match from rawLine
      const directMatch = rawLine.match(/\b(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+(\/[^\t\s\r\n]+)/i);
      if (directMatch) {
        extractedPayload = `${directMatch[1]} ${directMatch[2]}`;
      } else {
        // 2. Check if there are method + path in flowIdx + 6/7
        if (flowIdx !== -1 && parts[flowIdx + 6]) {
          const p6 = parts[flowIdx + 6].trim();
          const p7 = parts[flowIdx + 7] ? parts[flowIdx + 7].trim() : '';
          if (/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)$/i.test(p6) && p7.startsWith('/')) {
            extractedPayload = `${p6} ${p7}`;
          } else if (p6.startsWith('/')) {
            extractedPayload = `GET ${p6}`;
          } else {
            extractedPayload = p6;
          }
        } else if (parts[25]) {
          extractedPayload = parts[25];
        } else {
          const payloadMatch = rawLine.match(/\b(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+\S+\s+HTTP\/\d\.\d/i) || 
                               rawLine.match(/\b(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+\S+/i);
          if (payloadMatch) {
            extractedPayload = payloadMatch[0];
          }
        }
      }

      if (!extractedPayload || extractedPayload === '-') {
        extractedPayload = 'GET /public/phpinfo.php';
      }

      console.log(`[DEBUG PHPINFO] rawLine: "${rawLine}"`);
      console.log(`[DEBUG PHPINFO] extractedPayload: "${extractedPayload}"`);

      corrected.app_access = extractedPayload;
      corrected.payload = extractedPayload;
    } else if (isNmap) {
      corrected.event_type = 'Attempted Information Leak';
      corrected.action = 'Allowed';
    } else if (isSuricata) {
      corrected.event_type = 'Misc Attack';
      corrected.action = 'Allowed';
    }

    if (corrected.app_access && !corrected.payload) {
      corrected.payload = corrected.app_access;
    }
  }

  // 1. Find correct event_name by matching against existing template files in the directory
  const matchedTemplateFile = findTemplateInRawText(instansi, rawLine);
  if (matchedTemplateFile) {
    const templateName = path.basename(matchedTemplateFile, '.txt');
    if (corrected.event_name && corrected.event_name !== templateName && !corrected.event_type) {
      corrected.event_type = corrected.event_name;
    }
    corrected.event_name = templateName;
  }

  // Fallback to extract event_type from the rawLine if it's still empty
  if (!corrected.event_type && rawLine) {
    const parts = rawLine.split('\t');
    for (const p of parts) {
      const cleanPart = p.trim();
      if (cleanPart && (cleanPart === 'Misc Attack' || cleanPart.toLowerCase().includes('attack') || cleanPart.toLowerCase().includes('exploit') || cleanPart.toLowerCase().includes('malware') || cleanPart.toLowerCase().includes('scanning'))) {
        corrected.event_type = cleanPart;
        break;
      }
    }
  }

  // 2. Extract quoted strings (which contain grouped IPs, countries, ports) semantically (skip for medika & asei as it is fully and dynamically parsed above)
  if (instansi.toLowerCase() !== 'medika' && instansi.toLowerCase() !== 'asei') {
    const quotes = rawLine.match(/"([^"]*)"/g);
    if (quotes) {
      const cleanQuotes = quotes.map(q => q.replace(/^"|"$/g, '').trim());
      
      // Find IP lists inside quotes
      const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
      const ipQuotes = cleanQuotes.filter(q => ipRegex.test(q));
      
      if (ipQuotes.length >= 2) {
        corrected.src_ip = ipQuotes[0].replace(/\s+/g, '\n');
        corrected.dst_ip = ipQuotes[1].replace(/\s+/g, '\n');
      } else if (ipQuotes.length === 1) {
        // If only one IP list is found in quotes, assign to source IP and extract destination IPs from raw Line outside of quotes
        corrected.src_ip = ipQuotes[0].replace(/\s+/g, '\n');
        const ipMatches = rawLine.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
        const nonQuotedIps = ipMatches.filter(ip => !ipQuotes[0].includes(ip));
        if (nonQuotedIps.length > 0) {
          corrected.dst_ip = nonQuotedIps.join('\n');
        }
      } else {
        // No IP quotes, fall back to extracting all IPs via regex
        const ipRegexAll = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
        const ips = rawLine.match(ipRegexAll) || [];
        if (ips.length > 0) {
          corrected.src_ip = ips[0];
          if (ips.length > 1) {
            corrected.dst_ip = ips.slice(1).join('\n');
          }
        }
      }

      // Find Country/Location lists inside quotes (exclude statuses and flows)
      const countryQuotes = cleanQuotes.filter(q => {
        const cleanQ = q.trim().toLowerCase();
        if (ipRegex.test(cleanQ)) return false;
        if (/^\d+(\s+\d+)*$/.test(cleanQ)) return false;
        if (cleanQ.includes('progress') || cleanQ.includes('close') || cleanQ.includes('open')) return false;
        if (cleanQ.includes('private') || cleanQ.includes('public')) return false;
        return cleanQ.length > 0;
      });

      if (countryQuotes.length >= 2) {
        corrected.src_country = countryQuotes[0].replace(/\s+/g, '\n');
        corrected.dst_country = countryQuotes[1].replace(/\s+/g, '\n');
      } else if (countryQuotes.length === 1) {
        corrected.src_country = countryQuotes[0].replace(/\s+/g, '\n');
      }

      // Find Port lists inside quotes
      const portQuotes = cleanQuotes.filter(q => {
        const cleanQ = q.trim();
        return /^\d+(\s+\d+)*$/.test(cleanQ) && !ipRegex.test(cleanQ);
      });
      if (portQuotes.length > 0) {
        corrected.dst_port = portQuotes[0].replace(/\s+/g, '\n');
      }
    } else {
      // If no quotes at all, fallback to regex for IPs
      const ipRegexAll = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      const ips = rawLine.match(ipRegexAll) || [];
      if (ips.length > 0 && (!corrected.src_ip || corrected.src_ip === '-' || corrected.src_ip.toLowerCase().includes('progress'))) {
        corrected.src_ip = ips[0];
        if (ips.length > 1) {
          corrected.dst_ip = ips.slice(1).join('\n');
        }
      }
    }

    // Post-validation cleanup: Ensure fields don't leak status or flow labels
    const invalidIpOrCountry = (val: string) => {
      if (!val) return false;
      const l = val.toLowerCase();
      return l.includes('progress') || l.includes('private') || l.includes('public') || l.includes('close') || l.includes('open');
    };

    if (corrected.src_ip && invalidIpOrCountry(corrected.src_ip)) {
      corrected.src_ip = '-';
    }
    if (corrected.src_country && invalidIpOrCountry(corrected.src_country)) {
      corrected.src_country = '-';
    }
    if (corrected.dst_ip && invalidIpOrCountry(corrected.dst_ip)) {
      corrected.dst_ip = '-';
    }
    if (corrected.dst_port && invalidIpOrCountry(corrected.dst_port)) {
      corrected.dst_port = '-';
    }
    if (corrected.dst_country && invalidIpOrCountry(corrected.dst_country)) {
      corrected.dst_country = '-';
    }
  }

  // 3. Extract correct date and time
  const datePattern = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/;
  const isValidDate = (val: string) => {
    if (!val) return false;
    return datePattern.test(val.trim());
  };

  if (!isValidDate(corrected.tanggal)) {
    const dateRegex = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g;
    const dates = rawLine.match(dateRegex) || [];
    if (dates.length > 0) {
      corrected.tanggal = dates[0];
    } else {
      corrected.tanggal = '-';
    }
  }

  const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
  const isValidTimeFormat = (val: string) => {
    if (!val) return false;
    const cleanVal = val.trim();
    return timePattern.test(cleanVal) || /^\d{2}\.\d{2}(\.\d{2})?$/.test(cleanVal);
  };

  if (!isValidTimeFormat(corrected.waktu)) {
    const timeMatches = rawLine.match(/\b\d{1,2}:\d{2}(:\d{2})?\b/g) || [];
    if (timeMatches.length > 0) {
      corrected.waktu = timeMatches[0];
    } else {
      const dotTimeRegex = /\b\d{2}\.\d{2}(\.\d{2})?\b/g;
      const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      const lineWithoutIps = rawLine.replace(ipRegex, '[IP]');
      const dotMatches = lineWithoutIps.match(/\b\d{2}\.\d{2}(\.\d{2})?\b/g) || [];
      if (dotMatches.length > 0) {
        corrected.waktu = dotMatches[0];
      } else {
        corrected.waktu = '-';
      }
    }
  }

  // 4. Extract action
  const cleanActionStr = (corrected.action || '').trim().toLowerCase();
  const isValidAction = cleanActionStr && (
    cleanActionStr.includes('allow') || 
    cleanActionStr.includes('block') || 
    cleanActionStr.includes('close') || 
    cleanActionStr.includes('closed')
  );

  if (!isValidAction) {
    if (rawLine.toLowerCase().includes('block ip on edl')) {
      corrected.action = 'Block IP on EDL';
    } else if (rawLine.toLowerCase().includes('block domain on edl')) {
      corrected.action = 'Block Domain on EDL';
    } else if (rawLine.toLowerCase().includes('block')) {
      corrected.action = 'Block';
    } else if (rawLine.toLowerCase().includes('allowed') || rawLine.toLowerCase().includes('allow')) {
      corrected.action = 'Allowed';
    }
  } else {
    if (cleanActionStr.includes('block ip on edl')) {
      corrected.action = 'Block IP on EDL';
    } else if (cleanActionStr.includes('block domain on edl')) {
      corrected.action = 'Block Domain on EDL';
    } else if (cleanActionStr === 'allow' || cleanActionStr === 'allowed') {
      corrected.action = 'Allow';
    } else if (cleanActionStr === 'block') {
      corrected.action = 'Block';
    }
  }

  // 5. Severity/Magnitude
  const severities = ['high', 'medium', 'low', 'critical'];
  for (const sev of severities) {
    if (rawLine.toLowerCase().includes(' ' + sev + ' ') || rawLine.toLowerCase().includes('\t' + sev + '\t')) {
      corrected.magnitude = sev.charAt(0).toUpperCase() + sev.slice(1);
      break;
    }
  }

  // 6. Extract URL/DNS & Query heuristically
  const isLikelyDomainOrUrl = (str: string): boolean => {
    if (!str) return false;
    const clean = str.trim();
    if (clean.includes(' ') || clean.includes('\t')) return false;
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) return false;
    if (clean.toLowerCase().startsWith('http://') || clean.toLowerCase().startsWith('https://')) return true;
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}(\/.*)?$/.test(clean);
  };

  const getDomainsFromLine = (): string[] => {
    const parts = rawLine.split('\t').map(p => p.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!part) continue;
      if (/^\d+$/.test(part.trim())) continue;
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part.trim())) continue;
      
      const cleaned = part.replace(/^"|"$/g, '').trim();
      const subLines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      
      const candidateDomains: string[] = [];
      for (const line of subLines) {
        const words = line.split(/[\s\t]+/).map(w => w.replace(/^"|"$/g, '').trim());
        for (const w of words) {
          if (isLikelyDomainOrUrl(w)) {
            candidateDomains.push(w);
          }
        }
      }
      
      if (candidateDomains.length > 0) {
        return candidateDomains;
      }
    }
    return [];
  };

  const foundDomains = getDomainsFromLine();
  if (foundDomains.length > 0) {
    const verticalDomains = verticalize(foundDomains.join('\n'));
    if (!corrected.url || corrected.url === '-' || corrected.url === '') {
      corrected.url = verticalDomains;
    }
    if (!corrected.query || corrected.query === '-' || corrected.query === '') {
      corrected.query = verticalDomains;
    }
  }

  return corrected;
}

// Data loaders
function loadEventMagnitudes(csvPath: string): Record<string, number> {
  const mapping: Record<string, number> = {};
  try {
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      // Skip CSV header, usually "Event Name,Magnitude"
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length >= 2) {
          const event = parts[0].trim();
          const magnitude = parseInt(parts[1].trim(), 10);
          if (event && !isNaN(magnitude)) {
            mapping[event] = magnitude;
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load event magnitudes:', e);
  }
  return mapping;
}

function loadFalsePositives(filePath: string): Set<string> {
  const fpEvents = new Set<string>();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const eventName = line.trim();
        if (eventName) {
          fpEvents.add(normalize(eventName));
        }
      }
    }
  } catch (e) {
    console.error('Failed to load false positives:', e);
  }
  return fpEvents;
}

function parseTSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (currentField.length === 0 && !insideQuotes) {
        // Field starts with a quote
        insideQuotes = true;
        i++;
      } else if (insideQuotes) {
        if (nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          insideQuotes = false;
          i++;
        }
      } else {
        // Literal quote inside non-quoted field
        currentField += '"';
        i++;
      }
    } else if (char === '\t' && !insideQuotes) {
      row.push(currentField.trim());
      currentField = '';
      i++;
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      row.push(currentField.trim());
      if (row.length > 0 && row.some(cell => cell.trim().length > 0)) {
        result.push(row);
      }
      row = [];
      currentField = '';
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
    } else {
      currentField += char;
      i++;
    }
  }
  
  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(cell => cell.trim().length > 0)) {
      result.push(row);
    }
  }
  
  return result;
}

function preprocessMultilineLog(text: string): string {
  return text || "";
}

function parseTxtContent(content: string): any[] {
  const parsedEvents: any[] = [];
  try {
    const rawRows = parseTSV(content);
    for (let row of rawRows) {
      if (row.length <= 3 && row.length > 0 && row[0].trim().length > 0) {
        // Fallback for space-separated pasted text
        const lineStr = row[0];
        let spaceParts = lineStr.split(/\t| {2,}/).map(s => s.trim()).filter(s => s.length > 0);
        if (spaceParts.length <= 3) {
          spaceParts = lineStr.split(/\s+/).map(s => s.trim()).filter(s => s.length > 0);
        }
        if (spaceParts.length > 3) {
          row = spaceParts;
        }
      }

      if (row.length <= 3) continue;

      const getPart = (idx: number) => {
        let p = row[idx] || "";
        if (p.startsWith('"') && p.endsWith('"')) {
          p = p.substring(1, p.length - 1).trim();
        }
        return p;
      };

      const event = {
        _rawLine: row.join('\t'),
        event_id: getPart(0),
        analyst: getPart(1),
        ticket_id: getPart(2),
        event_type: getPart(3),
        reason_close: getPart(4),
        escalation: getPart(5),
        link_alert: getPart(6),
        event_name: getPart(7),
        magnitude: getPart(8),
        tanggal: getPart(9),
        waktu: getPart(10),
        ticket_date: getPart(11),
        ticket_time: getPart(12),
        soc_response_time: getPart(13),
        user_date: getPart(14),
        user_time: getPart(15),
        user_response_time: getPart(16),
        action: getPart(17),
        event_status: getPart(18),
        traffic_flow: getPart(19),
        src_ip: verticalize(getPart(20)),
        src_country: verticalize(getPart(21)),
        dst_ip: verticalize(getPart(22)),
        dst_port: verticalize(getPart(23)),
        dst_country: verticalize(getPart(24)),
        app_access: getPart(25),
        user_agent: getPart(26),
        request_server: getPart(27),
        url: verticalize(getPart(28)),
        query: verticalize(getPart(29)),
        note: verticalize(getPart(30)),
      };
      parsedEvents.push(event);
    }
  } catch (e) {
    console.error('Failed to parse text log content:', e);
  }
  return parsedEvents;
}

function parseTxtFile(filePath: string): any[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseTxtContent(content);
  } catch (e) {
    console.error('Failed to parse text log file:', e);
    return [];
  }
}

function parseSophosDetailedLog(text: string): Record<string, string> {
  const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  // We initialize the data with highly robust fallback values corresponding to all placeholders in Sophos templates.
  // This guarantees that even if a raw log is partially formatted or has some missing keys,
  // we do not leave unrendered raw template placeholders (like {seen}, {username}) in the final preview.
  const now = new Date();
  const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  const data: Record<string, string> = {
    incident_id: `[SOC-NEOTECH] -${Math.floor(1000 + Math.random() * 9000)}`,
    event_name: "LNX-DET-RAM-CACHE-CLEARED",
    seen: `${formattedDate} ${formattedTime}`,
    severity: "Medium",
    username: "sysadmin",
    hostname: "api-test",
    detection_ip: "172.17.220.235",
    device_type: "server",
    operating_system: "Ubuntu 22.04.1 LTS (Jammy Jellyfish)",
    file_name: "/bin/sh",
    file_path: "/bin/sh",
    command_line: '["/bin/sh","-c","sync; echo 3 > /proc/sys/vm/drop_caches"]',
    ioc_value: "4f291296e89b784cd35479fca606f228126e3641f5bcaee68dee36583d7c9483",
    action: "Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious."
  };

  const KNOWN_HEADERS = new Set([
    'incidentid', 'incidentno', 'ticketid', 'idinsiden', 'idticket', 'noinsiden', 'id_insiden',
    'eventname', 'alertname', 'detectionname', 'title', 'alert', 'namaevent', 'namaalert', 'detectionid', 'incidentname',
    'severity', 'priority', 'level', 'alertseverity', 'skala', 'tingkatbahaya', 'prioritas',
    'time', 'seen', 'detectiontime', 'occurred', 'when', 'date', 'waktu', 'tanggal', 'waktudeteksi', 'tanggalwaktu', 'datetime', 'timestamp',
    'hostname', 'computername', 'device', 'machinename', 'computer', 'host', 'namakomputer', 'perangkat', 'namapeangkat', 'nama_perangkat', 'nama_host',
    'detectionip', 'ipaddress', 'ip', 'hostip', 'alamatip', 'sourceip', 'ip_address', 'alamat_ip',
    'username', 'accountname', 'user', 'account', 'namaakun', 'pengguna', 'nama_pengguna', 'nama_akun',
    'devicetype', 'devicecategory', 'tipederice', 'tipeperangkat', 'tipe_perangkat',
    'operatingsystem', 'os', 'platform', 'sistemoperasi', 'sistem_operasi',
    'filename', 'processname', 'file', 'process', 'namafile', 'namaproses', 'nama_file', 'nama_proses',
    'filepath', 'path', 'processpath', 'lokasifile', 'pathfile', 'path_file', 'lokasi_file',
    'commandline', 'cmdline', 'cmd', 'barisperintah', 'baris_perintah', 'parentcommandline', 'parentcmdline', 'parentcmd', 'parent_command_line', 'processcommandline', 'processcmdline', 'processcommand', 'processcmd',
    'iocvalue', 'sha256', 'hash', 'filehash', 'nilaihash', 'nilai_hash',
    'action', 'remediation', 'actiontaken', 'tindakan', 'solusi', 'remediasi', 'tindakan_diambil'
  ]);

  const rawPairs: Record<string, string> = {};

  // 1. Try JSON parsing first
  const trimmedText = text.trim();
  if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmedText);
      for (const [key, val] of Object.entries(obj)) {
        if (val !== null && val !== undefined) {
          rawPairs[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // 2. Try syslog style key=value pairing
  if (Object.keys(rawPairs).length === 0) {
    const kvRegex = /(\w+)=("[^"]*"|[^\s]+)/g;
    let match;
    while ((match = kvRegex.exec(text)) !== null) {
      const key = match[1];
      let val = match[2];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      rawPairs[key] = val;
    }
  }

  // 3. Try line-by-line parsing with intelligent same-line separators and known header lookup
  const hasValidHeader = Object.keys(rawPairs).some(k => {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return KNOWN_HEADERS.has(cleanK);
  });

  if (Object.keys(rawPairs).length === 0 || !hasValidHeader) {
    if (!hasValidHeader) {
      for (const k of Object.keys(rawPairs)) {
        delete rawPairs[k];
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let key = '';
      let val = '';
      
      // Check same-line separators
      if (line.includes(':')) {
        const parts = line.split(':');
        key = parts[0].trim();
        val = parts.slice(1).join(':').trim();
      } else if (line.includes('=')) {
        const parts = line.split('=');
        key = parts[0].trim();
        val = parts.slice(1).join('=').trim();
      } else if (line.includes('\t')) {
        const parts = line.split('\t');
        key = parts[0].trim();
        val = parts.slice(1).join('\t').trim();
      } else if (line.includes('|')) {
        const parts = line.split('|');
        key = parts[0].trim();
        val = parts.slice(1).join('|').trim();
      } else if (/\s{2,}/.test(line)) {
        const parts = line.split(/\s{2,}/);
        key = parts[0].trim();
        val = parts.slice(1).join(' ').trim();
      }

      const cleanK = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key && val && KNOWN_HEADERS.has(cleanK)) {
        rawPairs[key] = val;
        continue;
      }

      // If no same-line separator was found, check if this line is a known header and the NEXT line is its value (alternating layout)
      const lineClean = line.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (KNOWN_HEADERS.has(lineClean) && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const nextLineClean = nextLine.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Some common values can also look like known header names, e.g. "computer", "server", "user", "ip", "host", "device", "path", "action"
        const COMMON_VALUES = new Set(['computer', 'server', 'user', 'host', 'device', 'ip', 'path', 'action', 'file', 'process', 'os', 'cmd', 'hash']);
        // Make sure the next line is not itself another known header (unless it's actually a common value)
        if (!KNOWN_HEADERS.has(nextLineClean) || COMMON_VALUES.has(nextLineClean)) {
          rawPairs[line] = nextLine;
          i++; // Skip the next line as it was consumed as the value
        }
      }
    }
  }

  // 4. Fallback: alternating lines of any structure if we still have absolutely nothing
  if (Object.keys(rawPairs).length === 0) {
    for (let i = 0; i < lines.length - 1; i += 2) {
      const key = lines[i];
      const val = lines[i + 1];
      if (key && val) {
        rawPairs[key] = val;
      }
    }
  }

  // Map raw keys to standard placeholder keys with extremely comprehensive, bilingual aliases
  let commandLineParent = '';
  let commandLineStd = '';

  for (const [rawKey, val] of Object.entries(rawPairs)) {
    const k = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k === 'detectionid' || k === 'title' || k === 'eventname' || k === 'alertname' || k === 'alert' || k === 'namaevent' || k === 'namaalert' || k === 'incidentname') data['event_name'] = val;
    else if (k === 'severity' || k === 'priority' || k === 'level' || k === 'alertseverity' || k === 'skala' || k === 'tingkatbahaya' || k === 'prioritas') data['severity'] = val;
    else if (k === 'time' || k === 'seen' || k === 'detectiontime' || k === 'occurred' || k === 'when' || k === 'date' || k === 'waktu' || k === 'tanggal' || k === 'waktudeteksi' || k === 'tanggalwaktu' || k === 'datetime' || k === 'timestamp') data['seen'] = val;
    else if (k === 'devicetype' || k === 'devicecategory' || k === 'tipederice' || k === 'tipeperangkat' || k === 'tipeperangkat') data['device_type'] = val;
    else if (k === 'hostname' || k === 'computername' || k === 'device' || k === 'machinename' || k === 'computer' || k === 'host' || k === 'namakomputer' || k === 'perangkat' || k === 'namapeangkat' || k === 'namahost') data['hostname'] = val;
    else if (k === 'detectionip' || k === 'ipaddress' || k === 'ip' || k === 'hostip' || k === 'alamatip' || k === 'sourceip' || k === 'ipaddress' || k === 'alamatip') data['detection_ip'] = val;
    else if (k === 'processname' || k === 'filename' || k === 'file' || k === 'process' || k === 'namafile' || k === 'namaproses') data['file_name'] = val;
    else if (k === 'filepath' || k === 'path' || k === 'processpath' || k === 'lokasifile' || k === 'pathfile') data['file_path'] = val;
    else if (k === 'parentcommandline' || k === 'parentcmdline' || k === 'parentcmd' || k === 'parentcommandline') commandLineParent = val;
    else if (k === 'commandline' || k === 'cmdline' || k === 'cmd' || k === 'barisperintah' || k === 'processcommandline' || k === 'processcmdline' || k === 'processcommand' || k === 'processcmd') commandLineStd = val;
    else if (k === 'username' || k === 'accountname' || k === 'user' || k === 'account' || k === 'namaakun' || k === 'pengguna') data['username'] = val;
    else if (k === 'operatingsystem' || k === 'os' || k === 'platform' || k === 'sistemoperasi') data['operating_system'] = val;
    else if (k === 'iocvalue' || k === 'sha256' || k === 'hash' || k === 'filehash' || k === 'nilaihash') data['ioc_value'] = val;
    else if (k === 'action' || k === 'remediation' || k === 'actiontaken' || k === 'tindakan' || k === 'solusi' || k === 'remediasi') data['action'] = val;
    else if (k === 'incidentid' || k === 'incidentno' || k === 'ticketid' || k === 'idinsiden' || k === 'idticket' || k === 'noinsiden') data['incident_id'] = val;
  }

  if (commandLineStd) {
    data['command_line'] = commandLineStd;
  } else if (commandLineParent) {
    data['command_line'] = commandLineParent;
  }

  // Post-process default fields if specific event is matched
  const eventName = data['event_name'] || '';
  if (eventName.toUpperCase() === 'LNX-DET-RAM-CACHE-CLEARED') {
    data['deskripsi'] = "LNX-DET-RAM-CACHE-CLEARED adalah Alert yang menandakan bahwa sistem telah berhasil mengosongkan atau membersihkan cache RAM (memori sementara) untuk melepaskan ruang agar dapat digunakan kembali oleh sistem, atau sebagai bagian dari siklus pemeliharaan rutin";
    data['analisa_awal'] = `LNX-DET-RAM-CACHE-CLEARED terdeteksi saat akun ${data['username'] || 'sysadmin'} menjalankan script ${data['file_name'] || '/bin/sh'} pada server ${data['hostname'] || 'api-test'}. Aktivitas tersebut mengindikasikan proses pembersihan cache RAM yang umumnya dilakukan untuk keperluan maintenance dan optimasi penggunaan memori. Berdasarkan informasi yang tersedia, belum ditemukan indikasi malicious activity, namun diperlukan verifikasi terhadap isi script, sumber file, dan mekanisme eksekusinya untuk memastikan aktivitas merupakan proses operasional yang sah.`;
    data['reputasi'] = "-";
    data['mitigasi'] = `1. Verifikasi isi file  ${data['file_path'] || '/bin/sh'} dan validasi hash file.
2. Konfirmasi kepada administrator server terkait tujuan dan jadwal eksekusi script.
3. Periksa cron job atau automation task yang menjalankan script.
4. Monitor aktivitas lanjutan pada akun ${data['username'] || 'sysadmin'} and server terkait.
5. Jika terkonfirmasi legitimate, lakukan whitelisting sesuai prosedur keamanan yang berlaku.`;
  } else {
    // Generics
    data['deskripsi'] = `${eventName} alert terdeteksi pada Sophos XDR Platform.`;
    data['analisa_awal'] = `Aktivitas terdeteksi pada server ${data['hostname'] || '-'} oleh akun ${data['username'] || '-'}. Aktivitas ini sedang dianalisis oleh tim SOC.`;
    data['reputasi'] = "-";
    data['mitigasi'] = `1. Verifikasi aktivitas dan file target.\n2. Lakukan koordinasi dengan penanggung jawab aset server.`;
  }

  return data;
}

interface SophosEvent {
  eventName: string;
  total: number;
  severity: string;
  entity: string;
  category?: string;
  seen: string;
}

function parseSophosLogs(text: string): SophosEvent[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const events: SophosEvent[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const totalMatch = line.match(/^(\d+)\s+total$/i);
    if (totalMatch && i > 0) {
      const eventName = lines[i - 1];
      const total = parseInt(totalMatch[1], 10);
      
      let severity = '';
      if (i + 1 < lines.length) {
        severity = lines[i + 1];
      }
      
      let entity = '';
      if (i + 2 < lines.length) {
        entity = lines[i + 2];
      }
      
      let category = '';
      let seen = '';
      
      if (i + 3 < lines.length) {
        const nextLine = lines[i + 3];
        if (nextLine.toLowerCase().startsWith('seen') || nextLine.toLowerCase().includes('ago')) {
          seen = nextLine;
          i = i + 4;
        } else {
          category = nextLine;
          if (i + 4 < lines.length) {
            seen = lines[i + 4];
          }
          i = i + 5;
        }
      } else {
        i = i + 3;
      }
      
      events.push({
        eventName,
        total,
        severity: severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase(),
        entity,
        category: category || undefined,
        seen
      });
    } else {
      i++;
    }
  }
  return events;
}

function formatSeverityList(eventsList: SophosEvent[]): string {
  if (eventsList.length === 0) {
    return "1. = (0)";
  }
  
  const order: string[] = [];
  const grouped: Record<string, number> = {};
  
  for (const e of eventsList) {
    if (grouped[e.eventName] === undefined) {
      order.push(e.eventName);
      grouped[e.eventName] = 0;
    }
    grouped[e.eventName] += e.total;
  }
  
  return order
    .map((eventName, idx) => {
      const total = grouped[eventName];
      return `${idx + 1}. ${eventName} (${total} ${total > 1 ? 'events' : 'event'})`;
    })
    .join('\n');
}

function parseCSV(content: string): any[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r' && !inQuotes) {
      // skip
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  // Parse fields helper
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
      } else if (c === ',' && !inQ) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    data.push(row);
  }

  return data;
}

function fillTemplate(templateContent: string, eventData: any, magMap?: Record<string, number>): string {
  let filled = templateContent;
  
  // Merge eventData with a dictionary of common fallback placeholders so that
  // any expected placeholders are guaranteed to be resolved, even if they aren't provided in eventData.
  const now = new Date();
  const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  const commonFallbacks: Record<string, string> = {
    incident_id: `[SOC-NEOTECH] -${Math.floor(1000 + Math.random() * 9000)}`,
    event_name: "LNX-DET-RAM-CACHE-CLEARED",
    seen: `${formattedDate} ${formattedTime}`,
    severity: "Medium",
    username: "sysadmin",
    hostname: "api-test",
    detection_ip: "172.17.220.235",
    device_type: "server",
    operating_system: "Ubuntu 22.04.1 LTS (Jammy Jellyfish)",
    file_name: "/bin/sh",
    file_path: "/bin/sh",
    command_line: '["/bin/sh","-c","sync; echo 3 > /proc/sys/vm/drop_caches"]',
    ioc_value: "4f291296e89b784cd35479fca606f228126e3641f5bcaee68dee36583d7c9483",
    action: "Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious.",
    payload: eventData.payload || eventData.app_access || eventData.query || eventData.url || "-"
  };

  const mergedData = { ...commonFallbacks, ...eventData };
  const isHtmlTemplate = templateContent.includes('<table') || templateContent.includes('</table>') || templateContent.includes('<div') || templateContent.includes('<p');

  for (const [key, val] of Object.entries(mergedData)) {
    let stringVal = val === null || val === undefined ? "-" : String(val);
    
    if (isHtmlTemplate) {
      // For HTML templates, we want to convert any literal \n to <br /> if it doesn't already have <br> tags.
      // This ensures that lists and descriptions look exactly as spaced in Outlook and our preview.
      if (!/<br\s*\/?>/i.test(stringVal)) {
        stringVal = stringVal.replace(/\r?\n/g, '<br />');
      }
    } else {
      // Strip trailing <br> tags to prevent trailing empty lines, then convert remaining <br> to newlines
      stringVal = stringVal.replace(/<br\s*\/?>\s*$/gi, '');
      stringVal = stringVal.replace(/<br\s*\/?>\n?/gi, '\n');
    }
    
    filled = filled.replace(new RegExp(`{${key}}`, 'g'), stringVal);
  }
  
  if (magMap) {
    const eventName = mergedData.event_name || "";
    const magnitude = magMap[eventName];
    if (magnitude !== undefined) {
      const severity = categorizeMagnitude(magnitude);
      filled = filled.replace(/{sev_magnitude}/g, String(magnitude));
      filled = filled.replace(/{severity}/g, severity);
    } else {
      filled = filled.replace(/{sev_magnitude}/g, mergedData.magnitude || "-");
      filled = filled.replace(/{severity}/g, "Unknown");
    }
  }

  // Final sweep: replace any remaining unresolved placeholders like {xyz} with "-"
  // to guarantee no raw placeholders leak into the final output.
  filled = filled.replace(/{[a-zA-Z0-9_]+}/g, "-");

  return filled;
}

function cleanShiftFolder(outputDir: string, shiftKey: string): string {
  const shiftOutdir = path.join(outputDir, `shift${shiftKey}`);
  fs.mkdirSync(shiftOutdir, { recursive: true });
  try {
    const files = fs.readdirSync(shiftOutdir);
    for (const file of files) {
      const filePath = path.join(shiftOutdir, file);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Error cleaning shift folder:', e);
  }
  return shiftOutdir;
}

function getTemplateFilePath(instansi: string, name: string): string {
  const dir = path.join(getTemplatesDir(), instansi);
  const pathNoExt = path.join(dir, name);
  const pathWithExt = path.join(dir, `${name}.txt`);
  if (fs.existsSync(pathNoExt) && !fs.statSync(pathNoExt).isDirectory()) {
    return pathNoExt;
  }
  return pathWithExt;
}

// API Routes
app.get('/api/github-config', (req, res) => {
  try {
    const configPath = path.join(getDatabaseDir(), 'github.config.json');
    let config = {
      githubToken: process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || '',
      githubRepo: 'neotechspotify/Web-Parsing-NCI',
      githubBranch: 'main',
      githubFilePath: 'database/medika/blacklists/List-IP-Blacklist.txt',
      githubAutoSync: true,
      updatedAt: new Date().toISOString()
    };

    if (fs.existsSync(configPath)) {
      const fileData = fs.readFileSync(configPath, 'utf-8');
      try {
        const parsed = JSON.parse(fileData);
        config = { ...config, ...parsed };
        if (!config.githubToken) {
          config.githubToken = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || '';
        }
      } catch (parseErr) {
        console.error('Error parsing github.config.json:', parseErr);
      }
    } else {
      fs.mkdirSync(getDatabaseDir(), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/github-config', (req, res) => {
  try {
    const configPath = path.join(getDatabaseDir(), 'github.config.json');
    let existingConfig = {
      githubToken: '',
      githubRepo: 'neotechspotify/Web-Parsing-NCI',
      githubBranch: 'main',
      githubFilePath: 'database/medika/blacklists/List-IP-Blacklist.txt',
      githubAutoSync: true,
      updatedAt: new Date().toISOString()
    };

    if (fs.existsSync(configPath)) {
      try {
        const fileData = fs.readFileSync(configPath, 'utf-8');
        existingConfig = { ...existingConfig, ...JSON.parse(fileData) };
      } catch (e) {}
    }

    const { githubToken, pat, githubRepo, repo, githubBranch, branch, githubFilePath, filepath, githubAutoSync, autoSync } = req.body;

    const newConfig = {
      githubToken: githubToken !== undefined ? githubToken : (pat !== undefined ? pat : existingConfig.githubToken),
      githubRepo: githubRepo !== undefined ? githubRepo : (repo !== undefined ? repo : existingConfig.githubRepo),
      githubBranch: githubBranch !== undefined ? githubBranch : (branch !== undefined ? branch : existingConfig.githubBranch),
      githubFilePath: githubFilePath !== undefined ? githubFilePath : (filepath !== undefined ? filepath : existingConfig.githubFilePath),
      githubAutoSync: githubAutoSync !== undefined ? githubAutoSync : (autoSync !== undefined ? autoSync : existingConfig.githubAutoSync),
      updatedAt: new Date().toISOString()
    };

    fs.mkdirSync(getDatabaseDir(), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');

    res.json({
      success: true,
      message: 'Konfigurasi GitHub terpusat berhasil diperbarui di server!',
      config: newConfig
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.all('/api/github-sync-pull', async (req, res) => {
  try {
    const configPath = path.join(getDatabaseDir(), 'github.config.json');
    let token = '';
    let repoRaw = 'neotechspotify/Web-Parsing-NCI';
    let branch = 'main';

    if (fs.existsSync(configPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        token = parsed.githubToken || '';
        repoRaw = parsed.githubRepo || repoRaw;
        branch = parsed.githubBranch || branch;
      } catch (e) {}
    }

    if (req.body?.githubToken) token = req.body.githubToken;
    if (req.body?.githubRepo) repoRaw = req.body.githubRepo;
    if (req.body?.githubBranch) branch = req.body.githubBranch;
    if (req.query?.githubToken) token = req.query.githubToken as string;
    if (req.query?.githubRepo) repoRaw = req.query.githubRepo as string;
    if (req.query?.githubBranch) branch = req.query.githubBranch as string;

    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'GitHub PAT belum diisi di database/github.config.json' });
    }

    const cleanRepo = repoRaw.replace('https://github.com/', '').replace('.git', '').trim();
    const cleanBranch = branch.trim() || 'main';

    const treeUrl = `https://api.github.com/repos/${cleanRepo}/git/trees/${cleanBranch}?recursive=1`;
    const treeRes = await fetch(treeUrl, {
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LogParsingApp'
      }
    });

    if (!treeRes.ok) {
      const errData: any = await treeRes.json().catch(() => ({}));
      let msg = errData.message || treeRes.statusText;
      if (treeRes.status === 401 || msg.includes('Bad credentials')) {
        msg = 'Personal Access Token (PAT) tidak valid atau sudah kedaluwarsa (Bad credentials). Silakan perbarui Token di menu GitHub Settings.';
      }
      return res.status(treeRes.status).json({
        success: false,
        message: `Gagal membaca tree repository GitHub: ${msg}`
      });
    }

    const treeData: any = await treeRes.json();
    const items = treeData.tree || [];

    const pulledFiles: string[] = [];
    for (const item of items) {
      if (item.type === 'blob' && (item.path.startsWith('templates/') || item.path.startsWith('database/'))) {
        if (item.path === 'database/github.config.json') continue;

        const contentUrl = `https://api.github.com/repos/${cleanRepo}/contents/${item.path}?ref=${cleanBranch}`;
        const contentRes = await fetch(contentUrl, {
          headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'LogParsingApp'
          }
        });

        if (contentRes.ok) {
          const fileInfo: any = await contentRes.json();
          if (fileInfo.content) {
            const rawText = Buffer.from(fileInfo.content, 'base64').toString('utf-8');
            const targetDiskPath = path.join(process.cwd(), item.path);
            fs.mkdirSync(path.dirname(targetDiskPath), { recursive: true });
            fs.writeFileSync(targetDiskPath, rawText, 'utf-8');
            pulledFiles.push(item.path);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Berhasil menarik (pull sync) ${pulledFiles.length} file dari GitHub!`,
      count: pulledFiles.length,
      pulledFiles
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/templates', (req, res) => {
  try {
    const baseDir = getTemplatesDir();
    if (!fs.existsSync(baseDir)) {
      return res.json({});
    }

    const result: Record<string, string[]> = {};
    const directories = fs.readdirSync(baseDir);

    for (const dir of directories) {
      if (dir.toLowerCase() === 'kemtan') continue; // Exclude KEMTAN
      const dirPath = path.join(baseDir, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath)
          .filter(f => {
            const fullPath = path.join(dirPath, f);
            if (fs.statSync(fullPath).isDirectory()) return false;
            if (f === 'event_template.txt' || f === '.DS_Store' || f.startsWith('.')) return false;
            return true;
          })
          .map(f => {
            const trimmed = f.trim();
            if (trimmed !== f) {
              try {
                fs.renameSync(path.join(dirPath, f), path.join(dirPath, trimmed));
              } catch (e) {
                console.error(`Failed to rename spaced template ${f} to ${trimmed}`, e);
              }
              return trimmed.endsWith('.txt') ? trimmed.replace(/\.txt$/i, '') : trimmed;
            }
            return f.endsWith('.txt') ? f.replace(/\.txt$/i, '') : f;
          });
        // Sort case-insensitively
        result[dir] = files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/templates/:instansi/:name', (req, res) => {
  const { instansi, name } = req.params;
  const filePath = getTemplateFilePath(instansi, name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Template not found' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, formattedName: formatEventName(name) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates/:instansi/:name', (req, res) => {
  const { instansi, name } = req.params;
  const { content } = req.body;
  const filePath = getTemplateFilePath(instansi, name);

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content.trim() + '\n', 'utf-8');
    res.json({ success: true, message: `Template ${name} saved successfully!` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:instansi/:name', (req, res) => {
  const { instansi, name } = req.params;
  const filePath = getTemplateFilePath(instansi, name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Template not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: `Template ${name} deleted successfully!` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates/create', (req, res) => {
  const { instansi, filename, deskripsi, mitigasi } = req.body;

  if (!instansi || !filename) {
    return res.status(400).json({ error: 'Instansi and filename are required' });
  }

  const sanitizedFilename = filename.trim().replace(/[\/\\]/g, '-');
  const cleanFilename = sanitizedFilename.toLowerCase().endsWith('.txt') ? sanitizedFilename : `${sanitizedFilename}.txt`;
  const baseTemplatePath = path.join(getTemplatesDir(), instansi, 'event_template.txt');
  const targetTemplatePath = path.join(getTemplatesDir(), instansi, cleanFilename);

  try {
    if (!fs.existsSync(baseTemplatePath)) {
      return res.status(400).json({ error: `Base template not found for instansi ${instansi}` });
    }

    let content = fs.readFileSync(baseTemplatePath, 'utf-8');
    content = content.replace(/{deskripsi}/g, deskripsi || '');
    content = content.replace(/{mitigasi}/g, mitigasi || '');
    content = content.replace(/{analisa_awal}/g, req.body.analisa_awal || '');
    content = content.replace(/{reputasi}/g, req.body.reputasi || '-');

    fs.writeFileSync(targetTemplatePath, content, 'utf-8');
    res.json({
      success: true,
      message: `Template saved successfully as ${instansi}/${cleanFilename}`,
      cleanFilename,
      content
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- BLACKLISTS API VARIABLES, HELPERS & ENDPOINTS ---
const BLACKLIST_FILENAMES = [
  "List-IP-Blacklist.txt",
  "List-IP-Whitelist.txt",
  "List-Domain-Blacklist.txt",
  "List-Domain-Ads-Blacklist.txt",
  "List-Domain-Whitelist-General.txt",
  "List-Domain-Whitelist-Wifi.txt",
  "List-URL-Filtering.txt",
  "List-URL-Whitelist-General.txt",
  "List-URL-Whitelist-Wifi.txt",
  "AutomationBlacklistSOC.txt",
  "WebHook-Test.txt"
];

const DEFAULT_BLACKLIST_CONTENTS: Record<string, string> = {
  "List-IP-Blacklist.txt": `# List-IP-Blacklist.txt - Malicious IPs detected by SOC\n45.205.1.222\n216.25.89.86\n66.132.224.94\n193.163.125.74\n45.205.1.223\n66.132.195.154\n193.163.125.254\n80.87.206.20\n160.119.76.64\n193.46.0.6\n77.90.185.10\n45.135.194.31\n137.184.190.194\n138.68.153.47\n170.64.177.80\n185.220.101.4\n91.196.152.101\n141.98.83.48\n205.210.31.237\n80.94.95.217\n`,
  "List-IP-Whitelist.txt": `# List-IP-Whitelist.txt - Trusted internal and public IPs\n172.16.1.41\n172.16.1.91\n172.16.1.95\n10.100.10.1\n10.255.0.254\n192.168.1.1\n8.8.8.8\n1.1.1.1\n127.0.0.1\n`,
  "List-Domain-Blacklist.txt": `# List-Domain-Blacklist.txt - Malicious and C2 domains\nmalicious-update-service.com\nc2-panel-login.net\nphishing-portal-neotech.xyz\ncryptominer-pool-connection.org\nransomware-payload-delivery.com\nsilversandbox.net\nbadreputation-domain.info\n`,
  "List-Domain-Ads-Blacklist.txt": `# List-Domain-Ads-Blacklist.txt - Ad servers and tracking domains\ndoubleclick.net\ntelemetry-tracking-analytics.com\nadserver-popup-delivery.xyz\npromo-offer-tracker.info\n`,
  "List-Domain-Whitelist-General.txt": `# List-Domain-Whitelist-General.txt - Allowed general domains\nkemkes.go.id\nkemtan.go.id\nmedika.id\ngoogle.com\nmicrosoft.com\ngithub.com\ncloudflare.com\n`,
  "List-Domain-Whitelist-Wifi.txt": `# List-Domain-Whitelist-Wifi.txt - Allowed domains on public Wi-Fi\nspotify.com\nyoutube.com\ninstagram.com\ntwitter.com\nfacebook.com\n`,
  "List-URL-Filtering.txt": `# List-URL-Filtering.txt - Blocked URL patterns and endpoints\n/public/phpinfo.php\n/admin/config.php\n/wp-admin/install.php\n/shell.php\n/api/v1/auth/debug\n/config/db_test.php\n/.env\n`,
  "List-URL-Whitelist-General.txt": `# List-URL-Whitelist-General.txt - Allowed general URL paths\n/api/v1/public/health\n/index.html\n/assets/*\n/login\n`,
  "List-URL-Whitelist-Wifi.txt": `# List-URL-Whitelist-Wifi.txt - Allowed URL paths on guest Wi-Fi\n/guest/login\n/assets/banner.png\n`,
  "AutomationBlacklistSOC.txt": `# AutomationBlacklistSOC.txt - Dynamically added blocks\n198.51.100.55\n203.0.113.88\n`,
  "WebHook-Test.txt": `# WebHook-Test.txt - Configuration for alert integrations\nURL: https://discord.com/api/webhooks/mock-webhook-id-123\nTYPE: DISCORD\nSTATUS: ACTIVE\n`
};

function checkBlacklistedIPsAndDomains(instansi: string, events: any[]): string[] {
  const warnings: string[] = [];
  const baseDb = path.join(getDatabaseDir(), instansi);
  const ipBlacklistFile = path.join(baseDb, 'blacklists', 'List-IP-Blacklist.txt');
  const domainBlacklistFile = path.join(baseDb, 'blacklists', 'List-Domain-Blacklist.txt');

  let blacklistedIPs = new Set<string>();
  if (fs.existsSync(ipBlacklistFile)) {
    const lines = fs.readFileSync(ipBlacklistFile, 'utf-8').split('\n');
    for (const line of lines) {
      const clean = line.split('#')[0].trim();
      if (clean) blacklistedIPs.add(clean);
    }
  }

  let blacklistedDomains = new Set<string>();
  if (fs.existsSync(domainBlacklistFile)) {
    const lines = fs.readFileSync(domainBlacklistFile, 'utf-8').split('\n');
    for (const line of lines) {
      const clean = line.split('#')[0].trim();
      if (clean) blacklistedDomains.add(clean.toLowerCase());
    }
  }

  const flaggedIPs = new Set<string>();
  const flaggedDomains = new Set<string>();

  for (const event of events) {
    if (event.src_ip) {
      const ips = event.src_ip.split('\n');
      for (const ip of ips) {
        const cleanIp = ip.trim();
        if (blacklistedIPs.has(cleanIp)) {
          flaggedIPs.add(cleanIp);
        }
      }
    }
    if (event.dst_ip) {
      const ips = event.dst_ip.split('\n');
      for (const ip of ips) {
        const cleanIp = ip.trim();
        if (blacklistedIPs.has(cleanIp)) {
          flaggedIPs.add(cleanIp);
        }
      }
    }
    if (event.event_name) {
      const text = event.event_name.toLowerCase();
      for (const dom of blacklistedDomains) {
        if (text.includes(dom)) {
          flaggedDomains.add(dom);
        }
      }
    }
  }

  if (flaggedIPs.size > 0) {
    warnings.push(`⚠️ Blacklist Warning: Detect Malicious IPs in log: ${Array.from(flaggedIPs).join(', ')}`);
  }
  if (flaggedDomains.size > 0) {
    warnings.push(`⚠️ Blacklist Warning: Detect Malicious Domains in log: ${Array.from(flaggedDomains).join(', ')}`);
  }

  return warnings;
}

app.get('/api/blacklists/:instansi', (req, res) => {
  const { instansi } = req.params;
  const baseDb = path.join(getDatabaseDir(), instansi);
  const blacklistDir = path.join(baseDb, 'blacklists');
  const isMedikaOrAsei = instansi.toLowerCase() === 'medika' || instansi.toLowerCase() === 'asei';
  const isAal = instansi.toLowerCase() === 'aal';
  const filenames = isMedikaOrAsei 
    ? ["List-IP-Blacklist.txt"] 
    : isAal 
    ? ["List-Domain-Blacklist.txt"] 
    : BLACKLIST_FILENAMES;

  try {
    if (!fs.existsSync(blacklistDir)) {
      fs.mkdirSync(blacklistDir, { recursive: true });
    }

    // Initialize missing files with default content
    for (const filename of filenames) {
      const filePath = path.join(blacklistDir, filename);
      if (!fs.existsSync(filePath)) {
        const defaultContent = DEFAULT_BLACKLIST_CONTENTS[filename] || `# ${filename}\n`;
        fs.writeFileSync(filePath, defaultContent, 'utf-8');
      }
    }

    // For medika, asei, and aal, delete other blacklist files if they exist to keep disk clean
    if (isMedikaOrAsei || isAal) {
      const allowedFile = isMedikaOrAsei ? "List-IP-Blacklist.txt" : "List-Domain-Blacklist.txt";
      for (const filename of BLACKLIST_FILENAMES) {
        if (filename !== allowedFile) {
          const filePath = path.join(blacklistDir, filename);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              // Ignore unlink errors
            }
          }
        }
      }
    }

    // Read files and return their metadata
    const files = filenames.map(filename => {
      const filePath = path.join(blacklistDir, filename);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0 && !line.startsWith('#'));
      return {
        name: filename,
        size: stat.size,
        lines: lines.length,
        totalLines: content.split('\n').length,
        updatedAt: stat.mtime
      };
    });

    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/blacklists/:instansi/:filename', (req, res) => {
  const { instansi, filename } = req.params;
  const baseDb = path.join(getDatabaseDir(), instansi);
  const filePath = path.join(baseDb, 'blacklists', filename);
  const isMedikaOrAsei = instansi.toLowerCase() === 'medika' || instansi.toLowerCase() === 'asei';
  const isAal = instansi.toLowerCase() === 'aal';

  try {
    if (isMedikaOrAsei && filename !== 'List-IP-Blacklist.txt') {
      return res.status(403).json({ success: false, error: `Access denied to this file for ${instansi.toUpperCase()}` });
    }
    if (isAal && filename !== 'List-Domain-Blacklist.txt') {
      return res.status(403).json({ success: false, error: 'Access denied to this file for AAL' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    res.json({
      success: true,
      name: filename,
      content,
      size: stat.size,
      updatedAt: stat.mtime,
      totalLines: content.split('\n').length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/blacklists/:instansi/:filename', (req, res) => {
  const { instansi, filename } = req.params;
  const { content } = req.body;
  const baseDb = path.join(getDatabaseDir(), instansi);
  const filePath = path.join(baseDb, 'blacklists', filename);
  const isMedikaOrAsei = instansi.toLowerCase() === 'medika' || instansi.toLowerCase() === 'asei';
  const isAal = instansi.toLowerCase() === 'aal';

  try {
    if (isMedikaOrAsei && filename !== 'List-IP-Blacklist.txt') {
      return res.status(403).json({ success: false, error: `Access denied to this file for ${instansi.toUpperCase()}` });
    }
    if (isAal && filename !== 'List-Domain-Blacklist.txt') {
      return res.status(403).json({ success: false, error: 'Access denied to this file for AAL' });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content is required and must be a string' });
    }

    // Ensure directory exists
    const blacklistDir = path.dirname(filePath);
    if (!fs.existsSync(blacklistDir)) {
      fs.mkdirSync(blacklistDir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    const stat = fs.statSync(filePath);

    res.json({
      success: true,
      message: 'File updated successfully',
      name: filename,
      size: stat.size,
      updatedAt: stat.mtime,
      totalLines: content.split('\n').length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create manual event preview and filler
app.post('/api/buat_event', (req, res) => {
  const { instansi, shift, use_raw, raw_text, analyst, ...fields } = req.body;

  if (!instansi || !shift) {
    return res.status(400).json({ error: 'Instansi and shift are required' });
  }

  try {
    const files: Array<{ name: string; content: string }> = [];
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    if (instansi.toLowerCase() === 'sophos') {
      console.log('[DEBUG /api/buat_event] Received Sophos request:', {
        use_raw,
        raw_text_length: raw_text ? raw_text.length : 0,
        raw_text_preview: raw_text ? raw_text.substring(0, 100) : null,
        fields
      });

      if (use_raw && raw_text) {
        const parsed = parseSophosDetailedLog(raw_text);
        console.log('[DEBUG /api/buat_event] Parsed Sophos raw log:', JSON.stringify(parsed));
        const eventName = parsed.event_name || 'LNX-DET-RAM-CACHE-CLEARED';
        const matchedFile = findTemplateFile(instansi, eventName);
        console.log('[DEBUG /api/buat_event] Matched template file:', matchedFile, 'for eventName:', eventName);
        let filledTemplate = '';

        if (matchedFile) {
          const template = fs.readFileSync(matchedFile, 'utf-8');
          filledTemplate = fillTemplate(template, parsed);
        } else {
          // Use base template if specific one is missing
          const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
          if (fs.existsSync(baseTemplateFile)) {
            const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
            filledTemplate = fillTemplate(baseContent, parsed);
          } else {
            filledTemplate = Object.entries(parsed)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
          }
        }

        files.push({
          name: `${eventName}_Report.txt`,
          content: filledTemplate
        });
      } else {
        const parsed = {
          incident_id: fields.incident_id || `[SOC-NEOTECH] -${Math.floor(1000 + Math.random() * 9000)}`,
          event_name: fields.event_name || fields.eventName || "LNX-DET-RAM-CACHE-CLEARED",
          seen: fields.waktu_deteksi || fields.waktuDeteksi || (formattedDate + " " + formattedTime),
          severity: fields.severity || "Medium",
          username: fields.username || "-",
          hostname: fields.hostname || "-",
          detection_ip: fields.detection_ip || fields.detectionIp || "-",
          device_type: fields.device_type || fields.deviceType || "-",
          operating_system: fields.operating_system || fields.operatingSystem || "Ubuntu 22.04.1 LTS (Jammy Jellyfish)",
          file_name: fields.file_name || fields.fileName || "-",
          file_path: fields.file_path || fields.filePath || "-",
          command_line: fields.command_line || fields.commandLine || "-",
          ioc_value: fields.ioc_value || fields.iocValue || "-",
          action: fields.action || "Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious.",
          deskripsi: fields.deskripsi || fields.description || "-",
          analisa_awal: fields.analisa_awal || fields.analisaAwal || "-",
          reputasi: fields.reputasi || "-",
          mitigasi: fields.mitigasi || "-",
        };

        const eventName = parsed.event_name;
        const matchedFile = findTemplateFile(instansi, eventName);
        let filledTemplate = '';

        if (matchedFile) {
          const template = fs.readFileSync(matchedFile, 'utf-8');
          filledTemplate = fillTemplate(template, parsed);
        } else {
          // Use base template if specific one is missing
          const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
          if (fs.existsSync(baseTemplateFile)) {
            const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
            filledTemplate = fillTemplate(baseContent, parsed);
          } else {
            filledTemplate = Object.entries(parsed)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
          }
        }

        files.push({
          name: `${eventName}_Report.txt`,
          content: filledTemplate
        });
      }
    } else {
      const csvPath = path.join(getDatabaseDir(), instansi, 'events_magnitude_list.csv');
      const magMap = loadEventMagnitudes(csvPath);

      if (use_raw && raw_text) {
        const cleanedRawText = preprocessMultilineLog(raw_text);
        const events = parseTxtContent(cleanedRawText);
        for (let eventData of events) {
          const lineText = eventData._rawLine || raw_text;
          eventData = applyHeuristicCorrections(eventData, lineText, instansi);
          if (!eventData.magnitude && fields.severity) {
            eventData.magnitude = fields.severity;
          }

          const eventName = (eventData.event_name || "").trim().replace(/^"|"$/g, '');
          const ticketId = (eventData.ticket_id || "").trim();
          const eventType = (eventData.event_type || "").trim();

          let matchedFile = findTemplateInRawText(instansi, lineText);
          if (!matchedFile && eventName) {
            matchedFile = findTemplateFile(instansi, eventName);
          }

          let filledTemplate = '';

          if (matchedFile) {
            const template = fs.readFileSync(matchedFile, 'utf-8');
            filledTemplate = fillTemplate(template, eventData, magMap);
          } else {
            const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
            if (fs.existsSync(baseTemplateFile)) {
              const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
              filledTemplate = fillTemplate(baseContent, eventData, magMap);
            } else {
              filledTemplate = Object.entries(eventData)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
            }
          }

          const outFileName = ticketId && eventType ? `${eventName}_${ticketId}_${eventType}.txt` : `${eventName}_Report.txt`;
          files.push({
            name: outFileName,
            content: filledTemplate
          });
        }
      } else {
        const eventData = {
          event_id: `MANUAL-${now.getTime()}`,
          analyst: analyst || "SOC Analyst",
          ticket_id: `EV-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`,
          event_type: "Offensess",
          reason_close: "-",
          escalation: "-",
          link_alert: "-",
          event_name: fields.event_name || "Manual Event",
          magnitude: fields.severity || "-",
          tanggal: formattedDate,
          waktu: formattedTime,
          ticket_date: formattedDate,
          ticket_time: formattedTime,
          soc_response_time: "-",
          user_date: "-",
          user_time: "-",
          user_response_time: "-",
          action: fields.description || "-",
          event_status: "Open",
          traffic_flow: "-",
          src_ip: fields.src_ip || "-",
          src_country: fields.src_country || "-",
          dst_ip: fields.dst_ip || "-",
          dst_port: fields.dst_port || "-",
          dst_country: fields.dst_country || "-",
          app_access: "-",
          user_agent: "-",
          request_server: "-",
          url: fields.url_dns || "-",
          query: fields.query || "-",
          note: "-",
          waktu_deteksi: fields.waktu_deteksi || "-",
        };

        const eventName = (eventData.event_name || "").trim().replace(/^"|"$/g, '');
        let matchedFile = findTemplateFile(instansi, eventName);
        let filledTemplate = '';

        if (matchedFile) {
          const template = fs.readFileSync(matchedFile, 'utf-8');
          filledTemplate = fillTemplate(template, eventData, magMap);
        } else {
          const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
          if (fs.existsSync(baseTemplateFile)) {
            const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
            filledTemplate = fillTemplate(baseContent, eventData, magMap);
          } else {
            filledTemplate = Object.entries(eventData)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
          }
        }

        const outFileName = `${eventName}_Report.txt`;
        files.push({
          name: outFileName,
          content: filledTemplate
        });
      }
    }

    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Standalone endpoint to parse SIEM screenshot image using Gemini Vision OCR
app.post('/api/parse-screenshot', upload.single('image_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File screenshot (image_file) tidak ditemukan' });
    }
    const extractedText = await extractSectionBFromImage(
      req.file.buffer || fs.readFileSync(req.file.path),
      req.file.mimetype
    );
    return res.json({ success: true, text: extractedText });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// XML / TSV Parsing main upload endpoint
app.post('/api/process', upload.any(), async (req, res, next) => {
  const processLog: string[] = [];
  const resultFiles: any[] = [];
  let instansi = '';
  let shift = '';
  let medikaPivotData: any = null;
  let sectionBText: string = '';
  let file: any = null;
  let imageFile: any = null;

  try {
    const filesList = (req.files as Express.Multer.File[]) || [];
    file = filesList.find(f => f.fieldname === 'file' || f.fieldname === 'log_file');
    if (!file && filesList.length > 0 && filesList[0].fieldname !== 'image_file' && filesList[0].fieldname !== 'screenshot') {
      file = filesList[0];
    }
    imageFile = filesList.find(f => f.fieldname === 'image_file' || f.fieldname === 'screenshot');

    instansi = req.body?.instansi || '';
    shift = req.body.shift || '';
    const { paste_text, xml_data, xml_filename } = req.body;

    if (!instansi || !shift) {
      return res.status(400).json({ error: 'Instansi and shift are required' });
    }
    if (!file && !paste_text && !imageFile && !xml_data) {
      return res.status(400).json({ error: 'Log or XML file must be uploaded or log text must be pasted' });
    }

    processLog.push(`🏢 Instansi dipilih: ${instansi.toUpperCase()}`);
    processLog.push(`🕐 Shift: ${shift}`);
    if (xml_data) {
      processLog.push(`📥 Data XML diterima (Optimized Upload): ${xml_filename || 'data_export.xml'}`);
    } else if (file) {
      processLog.push(`📥 File diterima: ${file.originalname}`);
    } else if (paste_text) {
      processLog.push(`📥 Teks log langsung diterima (Pasted Text)`);
    }
    if (imageFile) {
      processLog.push(`🖼️ Screenshot Dashboard SIEM diterima: ${imageFile.originalname}`);
    }

    const fileExt = file ? file.originalname.split('.').pop()?.toLowerCase() : (xml_data ? 'xml' : 'txt');

    const baseDb = path.join(getDatabaseDir(), instansi);
    const magMap = loadEventMagnitudes(path.join(baseDb, 'events_magnitude_list.csv'));
    const validEvents = Object.keys(magMap); // or parsed csv names
    const fpEvents = loadFalsePositives(path.join(baseDb, 'False_Positive.txt'));

    const outputDir = path.join(process.env.VERCEL ? '/tmp/outputs' : 'outputs', instansi);
    fs.mkdirSync(outputDir, { recursive: true });

    if (instansi.toLowerCase() === 'aal') {
      const rawContent = file ? fs.readFileSync(file.path, 'utf-8') : (paste_text || '');
      processLog.push(`🔍 Mengurai file CSV AAL...`);
      const parsedData = parseCSV(rawContent);
      processLog.push(`✅ Berhasil mengurai ${parsedData.length} baris data CSV.`);

      // Convert any ISO timestamp to WIB local format "M/D/YYYY h:mm:ss AM/PM" (matching Image 2)
      const wibFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      });

      parsedData.forEach(row => {
        for (const key of Object.keys(row)) {
          const val = row[key];
          if (typeof val === 'string' && val.trim() !== '') {
            const isIsoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val);
            if (isIsoDate) {
              try {
                const dateObj = new Date(val);
                if (!isNaN(dateObj.getTime())) {
                  const formatted = wibFormatter.format(dateObj).replace(',', '');
                  row[key] = formatted;
                }
              } catch (err) {
                // Ignore parsing errors
              }
            }
          }
        }
      });

      // Check if this is a DGA or Botnet file
      const isDga = parsedData.length > 0 && (() => {
        const keys = Object.keys(parsedData[0]);
        const hasUrl = keys.some(k => k.toLowerCase().trim() === 'url');
        const originalName = file ? file.originalname.toLowerCase() : '';
        return hasUrl || originalName.includes('dga');
      })();

      // Group and pivot data
      const groups: Record<string, Record<string, number>> = {};
      let totalCount = 0;

      for (const row of parsedData) {
        const keys = Object.keys(row);
        const ipKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'sourceip') || 'source.ip';
        let domainKey = '';
        if (isDga) {
          domainKey = keys.find(k => k.toLowerCase().trim() === 'url') || 'url';
        } else {
          domainKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'botnetdomain') || 'botnetdomain';
        }
        
        const ip = (row[ipKey] || '').trim();
        const domain = (row[domainKey] || '').trim();
        
        if (!ip || !domain) continue;

        if (!groups[ip]) {
          groups[ip] = {};
        }
        groups[ip][domain] = (groups[ip][domain] || 0) + 1;
        totalCount++;
      }

      processLog.push(`📊 Melakukan Pivot Table (Grouping by source.ip & ${isDga ? 'url' : 'botnetdomain'})...`);
      
      const sortedIps = Object.keys(groups).sort();
      const aalPivotData = sortedIps.map(ip => {
        const domainCounts = groups[ip];
        const subtotal = Object.values(domainCounts).reduce((a, b) => a + b, 0);
        const domains = Object.entries(domainCounts).map(([domain, count]) => ({
          domain,
          count
        })).sort((a, b) => a.domain.localeCompare(b.domain));
        
        return { ip, subtotal, domains };
      });

      processLog.push(`📈 Pivot Table sukses dibentuk dengan ${sortedIps.length} Source IP unik.`);

      const excelFileName = file ? file.originalname.replace(/\.csv$/i, '') + '_Processed.xlsx' : `AAL_${isDga ? 'DGA' : 'Report'}_Shift_${shift}.xlsx`;
      const shiftOutdir = cleanShiftFolder(outputDir, shift);
      const excelFilePath = path.join(shiftOutdir, excelFileName);

      // Create Excel workbook with native Pivot Table outlines ([1][2] and [+] / [-] buttons), AutoFilter dropdowns, and exact Raw Log Green Table Style
      const rawSheetName = isDga ? "Raw Log DGA Connection" : "Raw Log Botnet C&C";
      await generateAalExcelWithExcelJS(
        excelFilePath,
        aalPivotData,
        parsedData,
        totalCount,
        isDga ? 'url' : 'botnetdomain',
        rawSheetName
      );

      resultFiles.push({
        name: excelFileName,
        path: excelFilePath,
        downloadUrl: `/api/download?path=${encodeURIComponent(excelFilePath)}`,
        type: 'excel'
      });

      processLog.push(`📁 File Excel (.xlsx) sukses dibuat: ${excelFileName}`);

      // WhatsApp text generation for AAL
      let waText = '';
      if (isDga) {
        // Collect unique domains from pivot table
        const allDomains: string[] = [];
        aalPivotData.forEach(group => {
          group.domains.forEach(d => {
            if (d.domain && typeof d.domain === 'string') {
              allDomains.push(d.domain.trim());
            }
          });
        });
        const rawSelectedDomain = allDomains.length > 0 ? allDomains[Math.floor(Math.random() * allDomains.length)] : 'wwup.cc';
        const cleanDomain = rawSelectedDomain.replace(/^(https?:\/\/)?(www\.)?/, '');
        const destUrl = rawSelectedDomain.startsWith('http') ? rawSelectedDomain : `https://${rawSelectedDomain}`;

        waText = `Subject: [SOC Report] URL belongs to an allowed category in policy (Allowed by Policy)

Dear Team,
Berikut kami lampirkan detail aktivitas akses ke domain berisiko tinggi (Newly Observed Domain) yang terdeteksi lolos (allowed) oleh Firewall.

Ringkasan Temuan:
* Event: URL belongs to an allowed category in policy
* Total Event: ${totalCount}
* Total Detected by Source IP: ${aalPivotData.length}
* Dest. URL: ${destUrl}
* Status: Allowed/Passthrough (Perlu penanganan segera)
* Periode : 8 Jam

Analisis Singkat: Trafik mengarah ke domain ${cleanDomain} yang baru saja didaftarkan/diamati. Pola nama domain yang acak mengindikasikan aktivitas Domain Generation Algorithm (DGA) yang umum digunakan malware untuk berkomunikasi dengan server Command & Control (C2).

Rekomendasi Tindakan:
* Block Domain: Segera tambahkan domain/IP tujuan ke dalam Blacklist Policy Firewall.
* Endpoint Check: Lakukan pemeriksaan pada host terdampak untuk memastikan tidak ada background process mencurigakan.
* Scan: Jalankan Full Scan EDR/AV pada endpoint.
* Validasi: Pastikan user tidak mengakses link dari sumber yang tidak dikenal.
* Memberikan edukasi kepada user / pengguna untuk tidak mengakses domain yang tidak dikenal.

Detail event lengkap terlampir pada file Excel.

Terima kasih.
Regards, SOC Neotech`;
      } else {
        // Collect unique domains from pivot table
        const allDomains: string[] = [];
        aalPivotData.forEach(group => {
          group.domains.forEach(d => {
            if (d.domain && typeof d.domain === 'string') {
              allDomains.push(d.domain.trim());
            }
          });
        });
        const rawSelectedDomain = allDomains.length > 0 ? allDomains[Math.floor(Math.random() * allDomains.length)] : 'morphed.ru';

        // Look up MAC Address from raw logs, fallback if not found
        const macList = parsedData
          .map(row => {
            const keys = Object.keys(row);
            const macKey = keys.find(k => {
              const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return lowerK === 'mac' || lowerK === 'macaddress' || lowerK === 'sourcemac' || lowerK === 'devicemac' || lowerK === 'mac_address';
            });
            return macKey ? (row[macKey] || '').trim() : '';
          })
          .filter(Boolean);
        const macAddress = macList.length > 0 ? macList[0] : '18:6f:2d:fa:82:68';

        waText = `Subject: [SOC Report] Domain was blocked by dns botnet C&C

Dear Team,
Terdeteksi aktivitas anomali berupa komunikasi dari endpoint internal menuju server pengendali Botnet (Command & Control). Meskipun koneksi diblokir (redirect) oleh Firewall, perangkat terindikasi kuat telah terinfeksi / melakukan koneksi ke domain malicious.

Ringkasan Temuan:
* Event: Domain was blocked by dns botnet C&C
* Total Event: ${totalCount}
* Total Detected by Source IP: ${aalPivotData.length}
* Dest. URL: ${rawSelectedDomain}
* MAC Address: ${macAddress}
* Status Network: Blocked/Redirected
* Periode: 8 Jam

Analisis: Endpoint mencoba menghubungi domain yang diklasifikasikan sebagai Botnet C&C. Ini mengindikasikan adanya automated script/malware yang berjalan.

Rekomendasi Tindakan (SEGERA):
* Isolasi Host: Segera putuskan koneksi jaringan perangkat (Isolasi) untuk mencegah penyebaran lateral.
* Deep Scanning: Lakukan Full Scan menggunakan EDR/Antivirus terupdate.
* Investigasi Persistence: Periksa Task Scheduler, Startup Apps, dan Registry untuk menghapus script pemicu.
* Memberikan edukasi kepada user agar tidak mengakses domain atau situs yang tidak dikenal.

Detail lengkap terlampir pada file Excel.

Terima kasih.
Regards, SOC Neotech`;
      }

      const waFileName = isDga ? `wa_aal_dga_shift${shift}.txt` : `wa_aal_shift${shift}.txt`;
      const waFilePath = path.join(shiftOutdir, waFileName);
      fs.writeFileSync(waFilePath, waText, 'utf-8');

      resultFiles.push({
        name: waFileName,
        path: waFilePath,
        downloadUrl: `/api/download?path=${encodeURIComponent(waFilePath)}`,
        type: 'wa',
        content: waText
      });

      processLog.push(`💬 WhatsApp report sukses dibuat: ${waFileName}`);

      // Clean up uploaded file
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // Populate base64 content for reliable downloads (especially for binary excel files)
      for (const f of resultFiles) {
        try {
          if (f.path && fs.existsSync(f.path)) {
            const fileBuffer = fs.readFileSync(f.path);
            f.base64 = fileBuffer.toString('base64');
            if (f.type !== 'excel') {
              f.content = fileBuffer.toString('utf-8');
            }
          }
        } catch (err) {
          console.error(`Error reading AAL file for base64:`, err);
        }
      }

      return res.json({
        success: true,
        message: isDga ? "Proses file event DGA AAL selesai!" : "Proses file event AAL selesai!",
        instansi,
        shift,
        processLog,
        resultFiles,
        aalPivotData,
        aalRawData: parsedData,
        isDga
      });
    }

    const isTxtFile = Boolean(file && (fileExt === 'txt' || file.originalname.toLowerCase().endsWith('.txt')));
    const hasTextContent = Boolean(isTxtFile || (paste_text && paste_text.trim().length > 0));
    const hasXmlFile = Boolean((file && (fileExt === 'xml' || file.originalname.toLowerCase().endsWith('.xml'))) || (xml_data && xml_data.trim().length > 0));

    if (hasTextContent) {
      if (instansi.toLowerCase() === 'sophos') {
        const rawContent = isTxtFile ? fs.readFileSync(file.path, 'utf-8') : (paste_text || '');
        const shiftOutdir = cleanShiftFolder(outputDir, shift);

        const lowerRaw = rawContent.toLowerCase();
        const hasDetailedKeywords = 
          lowerRaw.includes('detection id') || 
          lowerRaw.includes('hostname') || 
          lowerRaw.includes('severity') || 
          lowerRaw.includes('computer name') || 
          lowerRaw.includes('nama komputer') || 
          lowerRaw.includes('ip address') || 
          lowerRaw.includes('alamat ip') || 
          lowerRaw.includes('waktu deteksi') || 
          lowerRaw.includes('incident id') || 
          lowerRaw.includes('account name') || 
          lowerRaw.includes('nama akun');

        if (hasDetailedKeywords) {
          const parsed = parseSophosDetailedLog(rawContent);
          const eventName = parsed.event_name || 'LNX-DET-RAM-CACHE-CLEARED';
          const matchedFile = findTemplateFile(instansi, eventName);
          
          let filled = '';
          if (matchedFile) {
            const templateContent = fs.readFileSync(matchedFile, 'utf-8');
            filled = fillTemplate(templateContent, parsed);
          } else {
            // Use base template if specific one is missing
            const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
            if (fs.existsSync(baseTemplateFile)) {
              const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
              filled = fillTemplate(baseContent, parsed);
            } else {
              filled = Object.entries(parsed)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
            }
          }

          const outFileName = `${eventName}_Report.txt`;
          const outFilePath = path.join(shiftOutdir, outFileName);
          fs.writeFileSync(outFilePath, filled, 'utf-8');

          resultFiles.push({
            name: outFileName,
            path: outFilePath,
            downloadUrl: `/api/download?path=${encodeURIComponent(outFilePath)}`,
            type: 'text',
            content: filled
          });

          processLog.push(`✅ Parsing detailed single Sophos event selesai.`);
          processLog.push(`📑 Event report files generated: 1`);

        } else {
          const events = parseSophosLogs(rawContent);
          processLog.push(`✅ Parsing ${events.length} Sophos event selesai.`);

          // Group by severity
          const criticalList = events.filter(e => e.severity.toLowerCase() === 'critical');
          const highList = events.filter(e => e.severity.toLowerCase() === 'high');
          const mediumList = events.filter(e => e.severity.toLowerCase() === 'medium');
          const lowList = events.filter(e => e.severity.toLowerCase() === 'low');

          // Generate individual event report files if templates or fallbacks are used
          for (const eventData of events) {
            const eventName = eventData.eventName;
            const matchedFile = findTemplateFile(instansi, eventName);
            let filled = `Sophos Alert Report\nEvent Name: ${eventName}\nTotal: ${eventData.total}\nSeverity: ${eventData.severity}\nEntity: ${eventData.entity}\nCategory: ${eventData.category || '-'}\nTime: ${eventData.seen}`;
            
            if (matchedFile) {
              const templateContent = fs.readFileSync(matchedFile, 'utf-8');
              filled = fillTemplate(templateContent, {
                ...eventData,
                event_name: eventName,
                hostname: eventData.entity,
                seen: eventData.seen
              });
            } else {
              // Use base template if specific one is missing
              const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
              if (fs.existsSync(baseTemplateFile)) {
                const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
                filled = fillTemplate(baseContent, {
                  ...eventData,
                  event_name: eventName,
                  hostname: eventData.entity,
                  seen: eventData.seen
                });
              }
            }
            
            const outFileName = `${eventName}_Report.txt`;
            const outFilePath = path.join(shiftOutdir, outFileName);
            fs.writeFileSync(outFilePath, filled, 'utf-8');

            resultFiles.push({
              name: outFileName,
              path: outFilePath,
              downloadUrl: `/api/download?path=${encodeURIComponent(outFilePath)}`,
              type: 'text',
              content: filled
            });
          }

          processLog.push(`📑 Event report files generated: ${resultFiles.length}`);

          // WhatsApp report generation
          const waTemplatePath = path.join(getTemplatesDir(), instansi, `wa_template_${instansi}.txt`);
          let waText = '';
          
          const todayDateObj = new Date();
          const yesterdayDateObj = new Date();
          yesterdayDateObj.setDate(todayDateObj.getDate() - 1);
          
          const formatDateObj = (d: Date) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
          };

          const todayStr = formatDateObj(todayDateObj);
          const yesterdayStr = formatDateObj(yesterdayDateObj);
          const defaultDateRange = `${yesterdayStr} jam 08.00 - ${todayStr} jam 08.00`;

          const criticalStr = formatSeverityList(criticalList);
          const highStr = formatSeverityList(highList);
          const mediumStr = formatSeverityList(mediumList);
          const lowStr = formatSeverityList(lowList);

          if (fs.existsSync(waTemplatePath)) {
            const template = fs.readFileSync(waTemplatePath, 'utf-8');
            waText = template
              .replace(/{salam}/g, 'Selamat Pagi')
              .replace(/{tanggal_range}/g, defaultDateRange)
              .replace(/{critical}/g, criticalStr)
              .replace(/{high}/g, highStr)
              .replace(/{medium}/g, mediumStr)
              .replace(/{low}/g, lowStr);
          } else {
            // Fallback if template doesn't exist yet
            waText = `Selamat Pagi Rekan - Rekan,

Berikut kami lampirkan hasil dari monitoring pada tanggal ${defaultDateRange},
dimana pada Sophos XDR Platform mendeteksi adanya event sebagai berikut :

A. Critical :
${criticalStr}

B. High :
${highStr}

C. Medium :
${mediumStr}

D. Low :
${lowStr}

Terimakasih,
SOC Neotech`;
          }

          const waFileName = `wa_${instansi.toLowerCase()}_shift${shift}.txt`;
          const waFilePath = path.join(shiftOutdir, waFileName);
          fs.writeFileSync(waFilePath, waText, 'utf-8');

          resultFiles.push({
            name: waFileName,
            path: waFilePath,
            downloadUrl: `/api/download?path=${encodeURIComponent(waFilePath)}`,
            type: 'wa',
            content: waText
          });

          processLog.push(`💬 WA Report successfully created: ${waFileName}`);
        }
      } else {
        const rawEvents = isTxtFile ? parseTxtFile(file.path) : parseTxtContent(paste_text || '');
        const events = rawEvents.map(e => {
          const lineText = e._rawLine || '';
          return applyHeuristicCorrections(e, lineText, instansi);
        });
        processLog.push(`✅ Parsing ${events.length} event selesai.`);

        // Check for blacklisted IPs and domains and push warnings
        const blacklistWarnings = checkBlacklistedIPsAndDomains(instansi, events);
        for (const warning of blacklistWarnings) {
          processLog.push(warning);
        }

        const shiftOutdir = cleanShiftFolder(outputDir, shift);
        const processedEventNames = new Set<string>();
        const isAsei = instansi.toLowerCase() === 'asei';
        const isMedikaOnly = instansi.toLowerCase() === 'medika';
        const isMedika = isMedikaOnly || isAsei;
        const validTypes = isMedika
          ? ["log activity", "offensess", "offenses", "suricata", "misc attack", "attempted information leak", "information leak", "misc activity"]
          : ["log activity", "offensess", "offenses"];

        medikaPivotData = null;
        sectionBText = "";

        if (isMedikaOnly && events.length > 0) {
          const destIpCounts: Record<string, number> = {};
          let destIpGrandTotal = 0;

          for (const e of events) {
            if (!e.dst_ip) continue;
            const rawStr = String(e.dst_ip || '').replace(/<br\s*\/?>/gi, '\n');
            const rawIps = Array.isArray(e.dst_ip) ? e.dst_ip : rawStr.split(/[\r\n,\s]+/);
            for (const rawIp of rawIps) {
              const cleanIp = String(rawIp || '').trim().replace(/^"|"$/g, '').replace(/<[^>]*>/g, '').trim();
              if (cleanIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) {
                destIpCounts[cleanIp] = (destIpCounts[cleanIp] || 0) + 1;
                destIpGrandTotal++;
              }
            }
          }

          const medikaPivotRows = Object.entries(destIpCounts).map(([ip, count]) => ({ ip, count }));
          medikaPivotData = {
            rows: medikaPivotRows,
            grandTotal: destIpGrandTotal
          };
        }

        const offenses = events.filter(e => {
          const type = (e.event_type || '').trim().toLowerCase();
          return type === 'offensess' || type === 'offenses';
        });
        const logs = events.filter(e => {
          const type = (e.event_type || '').trim().toLowerCase();
          return type === 'log activity' || type === 'log_activity';
        });

        for (const eventData of events) {
          const eventName = extractEventName(eventData);
          const ticketId = (eventData.ticket_id || "").trim();
          const eventType = (eventData.event_type || "").trim();

          if (!eventName && !ticketId) continue;

          const isMatched = isMedika ? true : validTypes.some(vt => vt.toLowerCase() === eventType.toLowerCase());
          if (!isMatched) continue;

          const uniqueKey = `${eventName}_${ticketId}_${eventType}`;
          if (processedEventNames.has(uniqueKey)) continue;

          let matchedFile = findTemplateFile(instansi, eventName);
          if (!matchedFile) {
            matchedFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
          }

          if (fs.existsSync(matchedFile)) {
            const templateContent = fs.readFileSync(matchedFile, 'utf-8');
            const filled = fillTemplate(templateContent, eventData, magMap);

            const safeEventName = eventName.replace(/[/\\?%*:|"<>]/g, '_');
            const outFileName = `${safeEventName}_${ticketId || 'Report'}.txt`;
            const outFilePath = path.join(shiftOutdir, outFileName);
            fs.writeFileSync(outFilePath, filled, 'utf-8');

            resultFiles.push({
              name: outFileName,
              path: outFilePath,
              downloadUrl: `/api/download?path=${encodeURIComponent(outFilePath)}`,
              type: 'text',
              content: filled
            });

            processedEventNames.add(uniqueKey);
          }
        }

        processLog.push(`📑 Event report files generated: ${resultFiles.length}`);

        // WhatsApp report generation
        const waTemplatePath = path.join(getTemplatesDir(), instansi, `wa_template_${instansi}.txt`);
        if (fs.existsSync(waTemplatePath)) {
          const template = fs.readFileSync(waTemplatePath, 'utf-8');
          const shiftInfo = SHIFTS[shift];
          const greeting = shiftInfo ? shiftInfo[0] : "Selamat";
          const jam = shiftInfo ? shiftInfo[1] : "";
          
          let tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
          if (events.length > 0) {
            const firstWithDate = events.find(e => e.tanggal && e.tanggal !== "-");
            if (firstWithDate) {
              tanggal = firstWithDate.tanggal;
            }
          }

          const offensesCount: Record<string, number> = {};
          for (const e of offenses) {
            const name = extractEventName(e);
            if (!name) continue;
            offensesCount[name] = (offensesCount[name] || 0) + 1;
          }

          const logsCount: Record<string, number> = {};
          for (const e of logs) {
            const name = extractEventName(e);
            if (!name) continue;
            logsCount[name] = (logsCount[name] || 0) + 1;
          }

          const alertsCount: Record<string, number> = {};
          if (isMedika) {
            for (const e of events) {
              const name = extractEventName(e);
              if (!name) continue;
              alertsCount[name] = (alertsCount[name] || 0) + 1;
            }
          }

          const useTicketUnit = ['kemkes', 'medika', 'asei'].includes(instansi.toLowerCase());
          const getUnit = (count: number) => useTicketUnit ? 'Ticket' : (count > 1 ? 'events' : 'event');

          let offensesStr = Object.entries(offensesCount)
            .map(([name, count], i) => `${i + 1}. ${name} (${count} ${getUnit(count)})`)
            .join("\n");
          if (!offensesStr) offensesStr = "Tidak ada event terdeteksi";

          let logsStr = Object.entries(logsCount)
            .map(([name, count], i) => `${i + 1}. ${name} (${count} ${getUnit(count)})`)
            .join("\n");
          if (!logsStr) logsStr = "Tidak ada event terdeteksi";

          let alertsStr = "";
          if (isMedika) {
            alertsStr = Object.entries(alertsCount)
              .map(([name, count], i) => `${i + 1}. ${name} (${count} ${getUnit(count)})`)
              .join("\n");
          }
          if (!alertsStr || alertsStr.trim() === "") {
            alertsStr = offensesStr !== "Tidak ada event terdeteksi" ? offensesStr : "Tidak ada event terdeteksi";
          }

          let destinationIpPortsStr = "";

          if (!isAsei) {
            if (imageFile) {
              processLog.push(`📷 Screenshot Dashboard SIEM terdeteksi. Menjalankan Gemini Vision OCR...`);
              const ocrText = await extractSectionBFromImage(
                imageFile.buffer || (imageFile.path ? fs.readFileSync(imageFile.path) : Buffer.from([])),
                imageFile.mimetype || 'image/png'
              );
              if (ocrText) {
                destinationIpPortsStr = ocrText;
                processLog.push(`✅ Berhasil membaca data Destination IP & Port dari screenshot.`);
              } else {
                processLog.push(`⚠️ Gemini Vision OCR tidak mengembalikan hasil dari screenshot.`);
              }
            } else if (req.body.section_b_text && req.body.section_b_text.trim()) {
              destinationIpPortsStr = req.body.section_b_text.trim();
            }

            if (!destinationIpPortsStr) {
              if (isMedikaOnly && events.length > 0) {
                destinationIpPortsStr = buildDestinationIpPortsFromEvents(events);
              } else {
                destinationIpPortsStr = "Tidak ada data Destination IP & Port detected";
              }
            }

            sectionBText = destinationIpPortsStr;
          }

          let waText = template
            .replace(/{salam}/g, greeting)
            .replace(/{tanggal}/g, tanggal)
            .replace(/{jam}/g, jam)
            .replace(/{offenses}/g, offensesStr)
            .replace(/{log_activity}/g, logsStr)
            .replace(/{alerts}/g, alertsStr)
            .replace(/{destination_ip_ports}/g, destinationIpPortsStr);

          const waFileName = `wa_${instansi.toLowerCase()}_shift${shift}.txt`;
          const waFilePath = path.join(shiftOutdir, waFileName);
          fs.writeFileSync(waFilePath, waText, 'utf-8');

          resultFiles.push({
            name: waFileName,
            path: waFilePath,
            downloadUrl: `/api/download?path=${encodeURIComponent(waFilePath)}`,
            type: 'wa',
            content: waText
          });

          processLog.push(`💬 WA Report successfully created: ${waFileName}`);
        } else {
          processLog.push(`⚠️ WA template not found at templates/${instansi}/wa_template_${instansi}.txt`);
        }

        // Generate Pivot Table TXT and XLSX files for Medika
        if (isMedikaOnly && medikaPivotData && medikaPivotData.rows.length > 0) {
          // Sort IP address numerically
          medikaPivotData.rows.sort((a: any, b: any) => {
            const numA = a.ip.split('.').map((n: string) => parseInt(n, 10));
            const numB = b.ip.split('.').map((n: string) => parseInt(n, 10));
            for (let i = 0; i < 4; i++) {
              if (numA[i] !== numB[i]) return numA[i] - numB[i];
            }
            return 0;
          });

          // 1. TXT Format
          let pivotTxtContent = "Row Labels\tCount of IP DESTINATION\n";
          for (const r of medikaPivotData.rows) {
            pivotTxtContent += `${r.ip}\t${r.count}\n`;
          }
          pivotTxtContent += `Grand Total\t${medikaPivotData.grandTotal}`;

          const pivotTxtName = `pivot_ip_destination_${instansi.toLowerCase()}_shift${shift}.txt`;
          const pivotTxtPath = path.join(shiftOutdir, pivotTxtName);
          fs.writeFileSync(pivotTxtPath, pivotTxtContent, 'utf-8');

          resultFiles.push({
            name: pivotTxtName,
            path: pivotTxtPath,
            downloadUrl: `/api/download?path=${encodeURIComponent(pivotTxtPath)}`,
            type: 'pivot',
            content: pivotTxtContent
          });

          // 2. Excel Format (.xlsx)
          const pivotWs = XLSX.utils.json_to_sheet(
            medikaPivotData.rows.map((r: any) => ({
              "Row Labels": r.ip,
              "Count of IP DESTINATION": r.count
            }))
          );

          // Add Grand Total row
          XLSX.utils.sheet_add_json(pivotWs, [
            { "Row Labels": "Grand Total", "Count of IP DESTINATION": medikaPivotData.grandTotal }
          ], { skipHeader: true, origin: -1 });

          const pivotWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(pivotWb, pivotWs, "Pivot Table IP Destination");

          const pivotXlsxName = `pivot_ip_destination_${instansi.toLowerCase()}_shift${shift}.xlsx`;
          const pivotXlsxPath = path.join(shiftOutdir, pivotXlsxName);
          XLSX.writeFile(pivotWb, pivotXlsxPath);

          resultFiles.push({
            name: pivotXlsxName,
            path: pivotXlsxPath,
            downloadUrl: `/api/download?path=${encodeURIComponent(pivotXlsxPath)}`,
            type: 'excel'
          });

          processLog.push(`📊 Pivot Table Destination IP created: ${pivotTxtName} & ${pivotXlsxName}`);
        }
      }
    }

    if (hasXmlFile) {
      let offensesList: any[] = [];

      if (xml_data && xml_data.trim().length > 0) {
        try {
          const parsed = typeof xml_data === 'string' ? JSON.parse(xml_data) : xml_data;
          offensesList = Array.isArray(parsed) ? parsed : (parsed.OffenseForm ? (Array.isArray(parsed.OffenseForm) ? parsed.OffenseForm : [parsed.OffenseForm]) : []);
        } catch (err) {
          console.error('Failed to parse xml_data JSON:', err);
        }
      }

      if (offensesList.length === 0 && file) {
        const content = fs.readFileSync(file.path, 'utf-8');
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
        const result = await parser.parseStringPromise(content);

        if (result && result.OffenseForm) {
          offensesList = Array.isArray(result.OffenseForm) ? result.OffenseForm : [result.OffenseForm];
        } else if (result && result.offenses && result.offenses.OffenseForm) {
          offensesList = Array.isArray(result.offenses.OffenseForm) ? result.offenses.OffenseForm : [result.offenses.OffenseForm];
        } else {
          const rootKey = Object.keys(result)[0];
          if (rootKey && result[rootKey] && result[rootKey].OffenseForm) {
            offensesList = Array.isArray(result[rootKey].OffenseForm) ? result[rootKey].OffenseForm : [result[rootKey].OffenseForm];
          }
        }
      }

      const tags = [
        "id", "magnitude", "closeUser", "formattedClosedDate", "localizedCloseReason",
        "deviceOrderBy", "escapedFormattedOffenseSource", "formattedOffenseType",
        "description", "severity", "eventCount", "eventDescription", "startTime", "endTime",
        "attacker", "target", "deviceCount", "targetNetwork", "attackerNetwork", "usernameOrderBy"
      ];

      let rows = offensesList.map(offense => {
        const row: Record<string, string> = {};
        for (const tag of tags) {
          row[tag] = offense[tag] || "";
        }
        return row;
      });

      if (instansi.toLowerCase() === 'kemkes') {
        const initialCount = rows.length;
        rows = rows.filter(row => {
          const sev = (row.severity || "").trim();
          const att = (row.attacker || "").trim();
          if (sev === "0") {
            return false;
          }
          if (
            att.startsWith("192.168.") ||
            att.startsWith("172.31.") ||
            att.startsWith("10.100.") ||
            att.startsWith("10.255.") ||
            att === "0.0.0.0"
          ) {
            return false;
          }
          return true;
        });
        processLog.push(`🧹 [KEMKES] Menyaring data: Menghapus baris dengan Severity = 0 atau Attacker di 192.168.*, 172.31.*, 10.100.*, 10.255.*, 0.0.0.0 (Sisa ${rows.length} dari ${initialCount} baris).`);
      }

      const baseNameNoExt = xml_filename ? path.basename(xml_filename, '.xml') : (file ? path.basename(file.path, '.xml') : 'pasted_xml');
      const dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(baseNameNoExt);
      let tanggalFile = "UnknownDate";
      if (dateMatch) {
        const [_, tahun, bulan, hari] = dateMatch;
        const bulanInt = parseInt(bulan, 10);
        const bulanText = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ][bulanInt - 1] || "Unknown";
        tanggalFile = `${parseInt(hari, 10).toString().padStart(2, '0')} ${bulanText} ${tahun}`;
      }

      const excelFileName = `FollowUp & Closed Offenses List - ${tanggalFile} ( Shift ${shift} ).xlsx`;
      const excelFilePath = path.join(outputDir, excelFileName);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      autoFitJsonColumns(worksheet, rows);
      if (instansi.toLowerCase() !== 'kemkes') {
        styleRawSheet(worksheet, rows);
      }
      addAutoFilter(worksheet, rows);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Offenses");
      XLSX.writeFile(workbook, excelFilePath);

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const excelBase64 = excelBuffer ? excelBuffer.toString('base64') : '';

      resultFiles.push({
        name: excelFileName,
        path: excelFilePath,
        downloadUrl: `/api/download?path=${encodeURIComponent(excelFilePath)}`,
        type: 'excel',
        base64: excelBase64
      });

      processLog.push(`📊 XML successfully converted to Excel: ${excelFileName}`);

      // If WA report was not created from text logs, generate it from XML offenses
      const hasWaReport = resultFiles.some(f => f.type === 'wa' || f.name.startsWith('wa_'));
      if (!hasWaReport) {
        const waTemplatePath = path.join(getTemplatesDir(), instansi, `wa_template_${instansi}.txt`);
        if (fs.existsSync(waTemplatePath)) {
          const isAsei = instansi.toLowerCase() === 'asei';
          const isMedikaOnly = instansi.toLowerCase() === 'medika';
          const isMedika = isMedikaOnly || isAsei;
          const template = fs.readFileSync(waTemplatePath, 'utf-8');
          const shiftInfo = SHIFTS[shift];
          const greeting = shiftInfo ? shiftInfo[0] : "Selamat";
          const jam = shiftInfo ? shiftInfo[1] : "";
          const tanggal = tanggalFile !== "UnknownDate" ? tanggalFile : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

          const offensesCount: Record<string, number> = {};
          for (const r of rows) {
            const name = (r.description || r.eventDescription || r.formattedOffenseType || r.escapedFormattedOffenseSource || "").trim().replace(/^"|"$/g, '');
            if (!name) continue;
            offensesCount[name] = (offensesCount[name] || 0) + 1;
          }

          const useTicketUnit = ['kemkes', 'medika', 'asei'].includes(instansi.toLowerCase());
          const getUnit = (count: number) => useTicketUnit ? 'Ticket' : (count > 1 ? 'events' : 'event');

          let offensesStr = Object.entries(offensesCount)
            .map(([name, count], i) => `${i + 1}. ${name} (${count} ${getUnit(count)})`)
            .join("\n");
          if (!offensesStr) offensesStr = "Tidak ada event terdeteksi";

          const logsStr = "Tidak ada event terdeteksi";
          let alertsStr = isMedika ? offensesStr : "Tidak ada event terdeteksi";
          let destinationIpPortsStr = "";

          if (!isAsei) {
            if (imageFile) {
              processLog.push(`📷 Screenshot Dashboard SIEM terdeteksi. Menjalankan Gemini Vision OCR...`);
              const ocrText = await extractSectionBFromImage(
                imageFile.buffer || (imageFile.path ? fs.readFileSync(imageFile.path) : Buffer.from([])),
                imageFile.mimetype || 'image/png'
              );
              if (ocrText) {
                destinationIpPortsStr = ocrText;
                processLog.push(`✅ Berhasil membaca data Destination IP & Port dari screenshot.`);
              } else {
                processLog.push(`⚠️ Gemini Vision OCR tidak mengembalikan hasil dari screenshot.`);
              }
            } else if (req.body.section_b_text && req.body.section_b_text.trim()) {
              destinationIpPortsStr = req.body.section_b_text.trim();
            }

            if (!destinationIpPortsStr) {
              if (isMedikaOnly && rows.length > 0) {
                destinationIpPortsStr = buildDestinationIpPortsFromEvents(rows);
              } else {
                destinationIpPortsStr = "Tidak ada data Destination IP & Port detected";
              }
            }

            sectionBText = destinationIpPortsStr;
          }

          let waText = template
            .replace(/{salam}/g, greeting)
            .replace(/{tanggal}/g, tanggal)
            .replace(/{jam}/g, jam)
            .replace(/{offenses}/g, offensesStr)
            .replace(/{log_activity}/g, logsStr)
            .replace(/{alerts}/g, alertsStr)
            .replace(/{destination_ip_ports}/g, destinationIpPortsStr);

          const shiftOutdir = cleanShiftFolder(outputDir, shift);
          const waFileName = `wa_${instansi.toLowerCase()}_shift${shift}.txt`;
          const waFilePath = path.join(shiftOutdir, waFileName);
          fs.writeFileSync(waFilePath, waText, 'utf-8');

          resultFiles.push({
            name: waFileName,
            path: waFilePath,
            downloadUrl: `/api/download?path=${encodeURIComponent(waFilePath)}`,
            type: 'wa',
            content: waText
          });

          processLog.push(`💬 WA Report successfully created: ${waFileName}`);
        } else {
          processLog.push(`⚠️ WA template not found at templates/${instansi}/wa_template_${instansi}.txt`);
        }
      }
    }

    if (!hasTextContent && !hasXmlFile) {
      processLog.push(`❌ Unknown file format: ${fileExt}`);
    }

    // Populate base64 content for reliable serverless downloads
    for (const f of resultFiles) {
      try {
        if (f.path && fs.existsSync(f.path)) {
          const fileBuffer = fs.readFileSync(f.path);
          f.base64 = fileBuffer.toString('base64');
          if (f.type !== 'excel') {
            f.content = fileBuffer.toString('utf-8');
          }
        }
      } catch (err) {
        console.error(`Error reading file for base64:`, err);
      }
    }

    res.json({
      success: true,
      message: "Proses selesai!",
      instansi,
      shift,
      processLog,
      resultFiles,
      medikaPivotData,
      sectionBText
    });

  } catch (error: any) {
    processLog.push(`💥 Terjadi kesalahan: ${error.message}`);
    res.json({
      success: false,
      message: `Gagal memproses file: ${error.message}`,
      instansi,
      shift,
      processLog,
      resultFiles: []
    });
  } finally {
    // Clean up uploaded input file & image
    try {
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      if (imageFile && imageFile.path && fs.existsSync(imageFile.path)) {
        fs.unlinkSync(imageFile.path);
      }
    } catch (e) {}
  }
});

app.get('/api/download', (req, res) => {
  const filePathQuery = req.query.path as string;
  if (!filePathQuery) {
    return res.status(400).send('Path is required');
  }

  const safePath = path.resolve(filePathQuery);
  const rootDir = process.cwd();

  // Security check: ensure path is inside the project directory or inside /tmp (for Vercel serverless)
  const isInsideRootDir = safePath.startsWith(rootDir);
  const isInsideTmpDir = safePath.startsWith('/tmp');

  if (!isInsideRootDir && !isInsideTmpDir) {
    return res.status(403).send('Access Denied');
  }

  if (!fs.existsSync(safePath)) {
    return res.status(404).send('File not found');
  }

  res.download(safePath);
});

// Unhandled error-handling middleware to prevent HTML leak
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    processLog: [`💥 Server Error: ${err.message || 'Internal Server Error'}`],
    resultFiles: []
  });
});

// Configure Vite or Static files depending on mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
