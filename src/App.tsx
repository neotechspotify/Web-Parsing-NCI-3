import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Upload,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clipboard,
  Download,
  Search,
  Plus,
  Edit3,
  Trash2,
  Clock,
  ArrowRight,
  Info,
  RefreshCw,
  Copy,
  PlusCircle,
  Check,
  FileDown,
  X,
  HelpCircle,
  Database,
  Eye,
  Github,
  GitBranch,
  CloudUpload,
  Settings,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Shield,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import companyLogo from './assets/images/nci_shield_white_bg_1783343904191.jpg'; 
import { LogEvent, ProcessResult } from './types';
import AalPivotVisualizer from './components/AalPivotVisualizer';
import { MedikaPivotVisualizer } from './components/MedikaPivotVisualizer';
import RepositoryTab from './components/RepositoryTab';

export const downloadSingleFile = (fileObj: { name: string; content?: string; base64?: string; type?: string }) => {
  let blob: Blob;
  if (fileObj.base64) {
    const binaryString = window.atob(fileObj.base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const mimeType = fileObj.type === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/plain;charset=utf-8';
    blob = new Blob([bytes], { type: mimeType });
  } else {
    blob = new Blob([fileObj.content || ''], { type: 'text/plain;charset=utf-8' });
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileObj.name;
  link.click();
  URL.revokeObjectURL(url);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'processor' | 'manual' | 'templates' | 'docs' | 'repository'>('processor');
  const [instansiList, setInstansiList] = useState<string[]>(['kemkes', 'sophos', 'aal', 'medika', 'asei']);
  const [templates, setTemplates] = useState<Record<string, string[]>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Fetch templates list
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
      const keys = Object.keys(data);
      if (keys.length > 0) {
        // Ensure 'aal' and 'asei' are always included as valid instansi for the processor
        const combined = Array.from(new Set([...keys, 'aal', 'asei']));
        setInstansiList(combined);
      }
    } catch (e) {
      console.error('Failed to load templates', e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-xl h-20 w-20 flex items-center justify-center shadow-lg border border-slate-200 shrink-0">
            <img 
              src={companyLogo} 
              alt="NCI Cybersecurity Logo" 
              className="h-full w-full object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="border-l border-slate-800 pl-4">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Log Parsing & Report Generator
            </h1>
            <p className="text-xs text-slate-400">Cybersecurity Shift Handover Operations Suite</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <nav className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-center">
          {(['processor', 'manual', 'templates', 'repository', 'docs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize flex items-center gap-2 ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tab === 'processor' && <Upload className="h-3.5 w-3.5" />}
              {tab === 'manual' && <Edit3 className="h-3.5 w-3.5" />}
              {tab === 'templates' && <FileText className="h-3.5 w-3.5" />}
              {tab === 'repository' && <Database className="h-3.5 w-3.5" />}
              {tab === 'docs' && <HelpCircle className="h-3.5 w-3.5" />}
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <AnimatePresence mode="wait">
          {activeTab === 'processor' && (
            <ProcessorTab
              instansiList={instansiList}
              onProcessComplete={fetchTemplates}
            />
          )}

          {activeTab === 'manual' && (
            <ManualTab
              instansiList={instansiList}
              templates={templates}
              fetchTemplates={fetchTemplates}
            />
          )}

          {activeTab === 'templates' && (
            <TemplatesTab
              templates={templates}
              loading={loadingTemplates}
              fetchTemplates={fetchTemplates}
              setActiveTab={setActiveTab}
              instansiList={instansiList}
            />
          )}

          {activeTab === 'repository' && (
            <RepositoryTab
              instansiList={instansiList}
            />
          )}

          {activeTab === 'docs' && <DocsTab />}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-8 text-center text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} Log Parsing & Report Generator. Powered by Node.js, Express & React.</p>
        <p className="flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
          SOC Dashboard Live
        </p>
      </footer>
    </div>
  );
}

// ==========================================
// 1. PROCESSOR TAB
// ==========================================
function ProcessorTab({ instansiList, onProcessComplete }: { instansiList: string[]; onProcessComplete: () => void }) {
  const [instansi, setInstansi] = useState('kemkes');
  const [shift, setShift] = useState('1');
  const [file, setFile] = useState<File | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [simpanSelama, setSimpanSelama] = useState('3 Hari');

  // Clipboard paste event listener for screenshot image
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const imgFile = new File([blob], `dashboard_screenshot_${Date.now()}.png`, { type: blob.type });
            setScreenshotFile(imgFile);
            const reader = new FileReader();
            reader.onload = (evt) => setScreenshotPreview(evt.target?.result as string);
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleProcess = async () => {
    if (!file && !pasteText.trim() && !screenshotFile) return;
    setProcessing(true);
    setResult(null);

    const formData = new FormData();
    formData.append('instansi', instansi);
    formData.append('shift', shift);
    formData.append('simpan_selama', simpanSelama);
    if (file) {
      formData.append('file', file);
    }
    if (pasteText.trim()) {
      formData.append('paste_text', pasteText);
    }
    if (screenshotFile) {
      formData.append('image_file', screenshotFile);
    }

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setResult(data);
      onProcessComplete(); // Refresh template list in case of updates
    } catch (e: any) {
      setResult({
        success: false,
        message: `Terjadi kesalahan koneksi: ${e.message}`,
        instansi,
        shift,
        processLog: [`💥 Connection failed: ${e.message}`],
        resultFiles: []
      });
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Upload & Setup Config Card */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5 h-fit shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold uppercase text-slate-300 tracking-wider">Proses File Event</h2>
        </div>

        {/* Instansi Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
            <span>🏢</span> Instansi
          </label>
          <select
            value={instansi}
            onChange={(e) => setInstansi(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
          >
            {instansiList.map((ins) => (
              <option key={ins} value={ins}>
                {ins.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Shift Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
            <span>⏱️</span> Shift
          </label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
          >
            <option value="1">Shift 1 (08.00 - 16.00)</option>
            <option value="2">Shift 2 (16.00 - 00.00)</option>
            <option value="3">Shift 3 (00.00 - 08.00)</option>
          </select>
        </div>

        {/* Simpan file selama Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
            <span>✍️</span> Simpan file selama
          </label>
          <select
            value={simpanSelama}
            onChange={(e) => setSimpanSelama(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
          >
            <option value="1 Hari">1 Hari</option>
            <option value="3 Hari">3 Hari</option>
            <option value="7 Hari">7 Hari</option>
            <option value="30 Hari">30 Hari</option>
          </select>
        </div>

        {/* Paste isi file .txt Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
            <span>✏️</span> Atau Paste isi file .txt
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 resize-y min-h-[100px]"
            placeholder="Paste isi file .txt di sini jika tidak ingin upload file..."
          />
        </div>

        {/* Upload File Drag & Drop Area */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
            <span>📎</span> Upload File (.txt / .xml)
          </label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerUpload}
            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[110px] ${
              isDragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : file
                ? 'border-emerald-600 bg-emerald-600/5'
                : 'border-slate-800 bg-slate-950 hover:border-slate-700'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.xml,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {!file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
                  <Upload className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">Drag & drop file or click to browse</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {instansi === 'aal' ? 'Botnet CSV file (.csv) (Max 50MB)' : 'TSV raw .txt or OffenseForm .xml (Max 50MB)'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="h-8 w-8 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center">
                  {file.name.endsWith('.xml') || file.name.endsWith('.csv') ? (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-emerald-400" />
                  )}
                </div>
                <div className="w-full max-w-xs truncate">
                  <p className="text-[11px] font-semibold text-emerald-400 truncate">{file.name}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {file.name.split('.').pop()?.toUpperCase()} File
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile();
                  }}
                  className="px-2 py-0.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white rounded text-[9px] font-semibold text-slate-300 transition-colors"
                >
                  Change File
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Screenshot Dashboard Upload & Paste Zone (Hidden for ASEI since Section B is omitted) */}
        {instansi.toLowerCase() !== 'asei' ? (
          <div className="flex flex-col gap-1.5 border-t border-slate-800/80 pt-3">
            <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>🖼️</span> Screenshot Dashboard (Heatmap/Top Ports)
              </span>
              <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/60 border border-indigo-800/50 px-1.5 py-0.5 rounded">Ctrl+V Paste</span>
            </label>

            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const img = e.target.files[0];
                  setScreenshotFile(img);
                  const reader = new FileReader();
                  reader.onload = (evt) => setScreenshotPreview(evt.target?.result as string);
                  reader.readAsDataURL(img);
                }
              }}
              className="hidden"
            />

            {!screenshotFile ? (
              <div
                onClick={() => screenshotInputRef.current?.click()}
                className="border border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950 rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="flex flex-col">
                  <p className="text-[11px] font-medium text-slate-200">
                    Upload screenshot atau tekan <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[9px] text-indigo-300 font-mono">Ctrl+V</kbd>
                  </p>
                  <p className="text-[9px] text-slate-500">Otomatis dibaca Gemini Vision untuk Bagian B</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-emerald-800/60 rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {screenshotPreview && (
                    <img src={screenshotPreview} alt="Screenshot preview" className="h-10 w-10 object-cover rounded-lg border border-slate-800 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-[11px] font-semibold text-emerald-400 truncate">{screenshotFile.name}</p>
                    <p className="text-[9px] text-slate-400">{(screenshotFile.size / 1024).toFixed(1)} KB • Disiapkan untuk Gemini Vision OCR</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScreenshotFile(null);
                    setScreenshotPreview(null);
                    if (screenshotInputRef.current) screenshotInputRef.current.value = '';
                  }}
                  className="px-2 py-1 bg-slate-900 hover:bg-rose-950/50 hover:text-rose-400 border border-slate-800 text-[10px] font-semibold text-slate-300 rounded-lg shrink-0 transition-colors cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-slate-800/80 pt-2.5">
            <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-xl p-2.5 flex items-center gap-2 text-[11px] text-indigo-300">
              <span className="text-sm">🏢</span>
              <span>Format Report 8 Jam <strong>ASEI</strong>: Menggunakan ringkasan Alert & Rekomendasi (tanpa Bagian B).</span>
            </div>
          </div>
        )}

        {/* Process Button */}
        <button
          onClick={handleProcess}
          disabled={(!file && !pasteText.trim() && !screenshotFile) || processing}
          className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-md ${
            (!file && !pasteText.trim() && !screenshotFile)
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : processing
              ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/15 hover:shadow-indigo-600/30 cursor-pointer'
          }`}
        >
          {processing ? (
            <>
              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
              Memproses File Event...
            </>
          ) : (
            <>
              <span>🚀</span>
              Proses Sekarang
            </>
          )}
        </button>
      </div>

      {/* Terminal Output & Results Area */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        {/* If no result and not processing, show helper cards */}
        {!result && !processing && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 text-center items-center justify-center min-h-[350px] shadow-lg">
            <div className="h-12 w-12 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
              <Database className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Terminal Process Console</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                Configure your client instansi, select your current shift, and drag in a log file. Once processed, the generated reports and Excel files will appear here.
              </p>
            </div>
          </div>
        )}

        {/* Processing Spinner state */}
        {processing && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 items-center justify-center min-h-[350px] shadow-lg">
            <div className="relative flex items-center justify-center">
              <div className="h-16 w-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin"></div>
              <Database className="h-5 w-5 text-indigo-400 absolute" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-slate-200">Processing Security Logs</h3>
              <p className="text-xs text-indigo-400 mt-2 animate-pulse font-mono">Running parsing pipeline...</p>
            </div>
          </div>
        )}

        {/* Results Area */}
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Status Header */}
            <div className={`p-4 border rounded-xl flex items-start gap-3 shadow-md ${
              result.success
                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
            }`}>
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="text-sm font-semibold">{result.success ? 'Proses Selesai!' : 'Terjadi Kesalahan!'}</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{result.message}</p>
              </div>
            </div>

            {/* Terminal Console View */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-inner flex flex-col">
              <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-900 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">terminal_process_log.sh</span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  STDOUT
                </span>
              </div>
              <div className="p-4 font-mono text-[11px] text-slate-300 max-h-[160px] overflow-y-auto flex flex-col gap-1.5">
                {result.processLog.map((log, index) => (
                  <p key={index} className="leading-relaxed whitespace-pre-wrap">{log}</p>
                ))}
              </div>
            </div>

            {/* Outputs View */}
            {result.resultFiles.filter((f) => f.type !== 'text').length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Generated Report Files</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.resultFiles
                    .filter((fileObj) => fileObj.type !== 'text')
                    .map((fileObj, index) => (
                      <div
                        key={fileObj.name}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${
                            fileObj.type === 'excel'
                              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                              : fileObj.type === 'wa'
                              ? 'bg-teal-950/50 border-teal-800 text-teal-400'
                              : fileObj.type === 'pivot'
                              ? 'bg-indigo-950/50 border-indigo-800 text-indigo-400'
                              : 'bg-indigo-950/50 border-indigo-800 text-indigo-400'
                          }`}>
                            {fileObj.type === 'excel' ? (
                              <FileSpreadsheet className="h-4.5 w-4.5" />
                            ) : (
                              <FileText className="h-4.5 w-4.5" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="text-xs font-semibold text-slate-200 truncate">{fileObj.name}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{fileObj.type === 'pivot' ? 'Pivot Table' : fileObj.type} Output Report</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadSingleFile(fileObj)}
                            className="flex-1 py-1 px-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-lg text-[10px] font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Download className="h-3 w-3 text-indigo-400" />
                            Download File
                          </button>

                          {(fileObj.type === 'wa' || fileObj.type === 'pivot') && fileObj.content && (
                            <button
                              onClick={() => copyToClipboard(fileObj.content!, index)}
                              className="py-1 px-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-lg text-[10px] font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {copiedIndex === index ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-indigo-400" />
                                  Copy
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Individual Ticket Files Section */}
            {result.resultFiles.filter((f) => f.type === 'text').length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Generated Individual Event Tickets</h3>
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 max-h-[360px] overflow-y-auto flex flex-col gap-2">
                  {result.resultFiles
                    .filter((fileObj) => fileObj.type === 'text')
                    .map((fileObj, index) => (
                      <div
                        key={fileObj.name}
                        className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-slate-800 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span className="text-xs font-medium text-slate-300 truncate font-mono">{fileObj.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => downloadSingleFile(fileObj)}
                            className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-semibold text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Download className="h-3 w-3 text-indigo-400" />
                            Download
                          </button>
                          {fileObj.content && (
                            <button
                              onClick={() => copyToClipboard(fileObj.content!, index + 1000)}
                              className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-semibold text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              {copiedIndex === index + 1000 ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-indigo-400" />
                                  Copy
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* If there is aalPivotData, render the interactive pivot table */}
            {result.aalPivotData && result.aalRawData && (
              <AalPivotVisualizer 
                pivotData={result.aalPivotData} 
                rawData={result.aalRawData} 
                isDga={result.isDga}
              />
            )}

            {/* If there is medikaPivotData or sectionBText, render Medika visualizer */}
            {(result.medikaPivotData || result.sectionBText) && (
              <MedikaPivotVisualizer
                pivotData={result.medikaPivotData}
                sectionBText={result.sectionBText}
              />
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// 2. MANUAL EVENT TAB
// ==========================================
function ManualTab({
  instansiList,
  templates,
  fetchTemplates,
}: {
  instansiList: string[];
  templates: Record<string, string[]>;
  fetchTemplates: () => void;
}) {
  const [instansi, setInstansi] = useState('kemkes');
  const [shift, setShift] = useState('1');
  const [useRaw, setUseRaw] = useState(false);
  const [rawText, setRawText] = useState('');
  const [analyst, setAnalyst] = useState('SOC Analyst');

  // Manual inputs
  const [eventName, setEventName] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [srcIp, setSrcIp] = useState('');
  const [srcCountry, setSrcCountry] = useState('');
  const [dstIp, setDstIp] = useState('');
  const [dstPort, setDstPort] = useState('');
  const [dstCountry, setDstCountry] = useState('');
  const [query, setQuery] = useState('');
  const [urlDns, setUrlDns] = useState('');
  const [waktuDeteksi, setWaktuDeteksi] = useState('');
  const [description, setDescription] = useState('');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ files: Array<{ name: string; content: string }> } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [previewModes, setPreviewModes] = useState<Record<number, 'rendered' | 'raw'>>({});
  const [sophosFields, setSophosFields] = useState({
    incident_id: '[SOC-NEOTECH] -2780',
    username: 'sysadmin',
    hostname: 'api-test',
    detection_ip: '172.17.220.235',
    device_type: 'server',
    operating_system: 'Ubuntu 22.04.1 LTS (Jammy Jellyfish)',
    file_name: '/bin/sh',
    file_path: '/bin/sh',
    command_line: '["/bin/sh","-c","sync; echo 3 > /proc/sys/vm/drop_caches"]',
    ioc_value: '4f291296e89b784cd35479fca606f228126e3641f5bcaee68dee36583d7c9483',
    action: 'Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious.',
    deskripsi: 'LNX-DET-RAM-CACHE-CLEARED adalah Alert yang menandakan bahwa sistem telah berhasil mengosongkan atau membersihkan cache RAM (memori sementara) untuk melepaskan ruang agar dapat digunakan kembali oleh sistem, atau sebagai bagian dari siklus pemeliharaan rutin',
    analisa_awal: 'LNX-DET-RAM-CACHE-CLEARED terdeteksi saat akun sysadmin menjalankan script /bin/sh pada server api-test. Aktivitas tersebut mengindikasikan proses pembersihan cache RAM yang umumnya dilakukan untuk keperluan maintenance dan optimasi penggunaan memori. Berdasarkan informasi yang tersedia, belum ditemukan indikasi malicious activity, namun diperlukan verifikasi terhadap isi script, sumber file, dan mekanisme eksekusinya untuk memastikan aktivitas merupakan proses operasional yang sah.',
    reputasi: '-',
    mitigasi: `1. Verifikasi isi file  /bin/sh dan validasi hash file.
2. Konfirmasi kepada administrator server terkait tujuan dan jadwal eksekusi script.
3. Periksa cron job atau automation task yang menjalankan script.
4. Monitor aktivitas lanjutan pada akun sysadmin and server terkait.
5. Jika terkonfirmasi legitimate, lakukan whitelisting sesuai prosedur keamanan yang berlaku.`,
  });

  // Template prefill triggers
  const handleTemplateSelect = async (templateName: string) => {
    if (!templateName) return;
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(instansi)}/${encodeURIComponent(templateName)}`);
      const data = await res.json();
      if (data && data.content) {
        setEventName(data.formattedName);
        if (instansi === 'sophos') {
          setWaktuDeteksi('Jul 6, 2026, 7:00:14 AM');
          if (data.formattedName.includes('LNX-DET-RAM-CACHE-CLEARED') || templateName.includes('LNX-DET-RAM-CACHE-CLEARED')) {
            setSophosFields({
              incident_id: '[SOC-NEOTECH] -2780',
              username: 'sysadmin',
              hostname: 'api-test',
              detection_ip: '172.17.220.235',
              device_type: 'server',
              operating_system: 'Ubuntu 22.04.1 LTS (Jammy Jellyfish)',
              file_name: '/bin/sh',
              file_path: '/bin/sh',
              command_line: '["/bin/sh","-c","sync; echo 3 > /proc/sys/vm/drop_caches"]',
              ioc_value: '4f291296e89b784cd35479fca606f228126e3641f5bcaee68dee36583d7c9483',
              action: 'Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious.',
              deskripsi: 'LNX-DET-RAM-CACHE-CLEARED adalah Alert yang menandakan bahwa sistem telah berhasil mengosongkan atau membersihkan cache RAM (memori sementara) untuk melepaskan ruang agar dapat digunakan kembali oleh sistem, atau sebagai bagian dari siklus pemeliharaan rutin',
              analisa_awal: 'LNX-DET-RAM-CACHE-CLEARED terdeteksi saat akun sysadmin menjalankan script /bin/sh pada server api-test. Aktivitas tersebut mengindikasikan proses pembersihan cache RAM yang umumnya dilakukan untuk keperluan maintenance dan optimasi penggunaan memori. Berdasarkan informasi yang tersedia, belum ditemukan indikasi malicious activity, namun diperlukan verifikasi terhadap isi script, sumber file, dan mekanisme eksekusinya untuk memastikan aktivitas merupakan proses operasional yang sah.',
              reputasi: '-',
              mitigasi: `1. Verifikasi isi file  /bin/sh dan validasi hash file.
2. Konfirmasi kepada administrator server terkait tujuan dan jadwal eksekusi script.
3. Periksa cron job atau automation task yang menjalankan script.
4. Monitor aktivitas lanjutan pada akun sysadmin and server terkait.
5. Jika terkonfirmasi legitimate, lakukan whitelisting sesuai prosedur keamanan yang berlaku.`,
            });
          }
        } else {
          // Default some mock IPs for easier template filling
          setSrcIp('192.168.1.100\n10.0.4.15');
          setSrcCountry('Indonesia');
          setDstIp('185.220.101.5\n45.227.254.10');
          setDstPort('443\n8080');
          setDstCountry('Netherlands\nSeychelles');
          setWaktuDeteksi(new Date().toLocaleString('id-ID'));
          setDescription('Tim SOC mendeteksi adanya aktivitas mencurigakan yang mengindikasikan serangan siber terhadap infrastruktur.');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setResult(null);

    const bodyObj = useRaw
      ? { instansi, shift, use_raw: true, raw_text: rawText, analyst }
      : {
          instansi,
          shift,
          use_raw: false,
          analyst,
          event_name: eventName,
          severity: severity,
          src_ip: srcIp,
          src_country: srcCountry,
          dst_ip: dstIp,
          dst_port: dstPort,
          dst_country: dstCountry,
          query,
          url_dns: urlDns,
          waktu_deteksi: waktuDeteksi,
          description,
          ...sophosFields,
        };

    try {
      const res = await fetch('/api/buat_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const copySingleFileToClipboard = async (content: string, index: number) => {
    try {
      if (content.includes('<table') || content.includes('</table>')) {
        // Build formatted rich-text HTML block to preserve typography and table formatting on paste
        // We MUST NOT use white-space: pre-wrap on HTML templates, as this causes Outlook to render raw HTML code newlines as massive visual empty vertical spacing!
        const richHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${content}</div>`;
        const blobHtml = new Blob([richHtml], { type: 'text/html' });
        const blobText = new Blob([content], { type: 'text/plain' });
        const item = new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(content);
      }
    } catch (err) {
      console.error('Clipboard write failed, falling back to writeText:', err);
      try {
        await navigator.clipboard.writeText(content);
      } catch (fallbackErr) {
        console.error('Fallback clipboard write also failed:', fallbackErr);
      }
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Form Area */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 shadow-lg h-fit">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold uppercase text-slate-300 tracking-wider">Manual Report Creator</h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useRaw}
              onChange={(e) => setUseRaw(e.target.checked)}
              className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            Use RAW Log Input
          </label>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-medium">Instansi</label>
              <select
                value={instansi}
                onChange={(e) => setInstansi(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
              >
                {instansiList.map((ins) => (
                  <option key={ins} value={ins}>
                    {ins.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-medium">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
              >
                <option value="1">Shift 1</option>
                <option value="2">Shift 2</option>
                <option value="3">Shift 3</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-medium">SOC Analyst</label>
              <input
                type="text"
                value={analyst}
                onChange={(e) => setAnalyst(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                placeholder="Analyst Name"
              />
            </div>
          </div>

          {useRaw ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300 font-medium">Raw TSV Log Line</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full h-[220px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 resize-none"
                placeholder="Paste the full tab-separated raw log line here..."
              ></textarea>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Raw lines must contains at least 4 tab-separated parts mapping to standard fields. Placeholders will be filled dynamically based on template matches.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Template Quick prefill select */}
              <div className="flex flex-col gap-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800/60">
                <label className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">⚡ Prefill from template</label>
                <select
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 mt-1 font-medium cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>-- Pilih Event Template --</option>
                  {(templates[instansi] || []).map((tName) => (
                    <option key={tName} value={tName}>
                      {tName.replace(/[_\-]+/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {instansi.toLowerCase() === 'sophos' ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Event Name / Title</label>
                      <input
                        type="text"
                        value={eventName || 'LNX-DET-RAM-CACHE-CLEARED'}
                        onChange={(e) => setEventName(e.target.value)}
                        required
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. LNX-DET-RAM-CACHE-CLEARED"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Severity / Priority</label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Incident ID</label>
                      <input
                        type="text"
                        value={sophosFields.incident_id}
                        onChange={(e) => setSophosFields({ ...sophosFields, incident_id: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. [SOC-NEOTECH] -2780"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Waktu Deteksi</label>
                      <input
                        type="text"
                        value={waktuDeteksi}
                        onChange={(e) => setWaktuDeteksi(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. Jul 6, 2026, 7:00:14 AM"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Computer Name / Hostname</label>
                      <input
                        type="text"
                        value={sophosFields.hostname}
                        onChange={(e) => setSophosFields({ ...sophosFields, hostname: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. api-test"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">IP Address</label>
                      <input
                        type="text"
                        value={sophosFields.detection_ip}
                        onChange={(e) => setSophosFields({ ...sophosFields, detection_ip: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. 172.17.220.235"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Account Name / Username</label>
                      <input
                        type="text"
                        value={sophosFields.username}
                        onChange={(e) => setSophosFields({ ...sophosFields, username: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. sysadmin"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Device Type</label>
                      <input
                        type="text"
                        value={sophosFields.device_type}
                        onChange={(e) => setSophosFields({ ...sophosFields, device_type: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. server"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Operating System</label>
                      <input
                        type="text"
                        value={sophosFields.operating_system}
                        onChange={(e) => setSophosFields({ ...sophosFields, operating_system: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. Ubuntu 22.04"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">File Name</label>
                      <input
                        type="text"
                        value={sophosFields.file_name}
                        onChange={(e) => setSophosFields({ ...sophosFields, file_name: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. /bin/sh"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">File Path</label>
                      <input
                        type="text"
                        value={sophosFields.file_path}
                        onChange={(e) => setSophosFields({ ...sophosFields, file_path: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. /bin/sh"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">IOC SHA256</label>
                      <input
                        type="text"
                        value={sophosFields.ioc_value}
                        onChange={(e) => setSophosFields({ ...sophosFields, ioc_value: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="SHA256 Hash"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-medium">Command Line</label>
                    <input
                      type="text"
                      value={sophosFields.command_line}
                      onChange={(e) => setSophosFields({ ...sophosFields, command_line: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                      placeholder='e.g. ["/bin/sh","-c","sync"]'
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-medium">Action taken</label>
                    <textarea
                      value={sophosFields.action}
                      onChange={(e) => setSophosFields({ ...sophosFields, action: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white h-12 resize-none"
                      placeholder="Melakukan verifikasi terhadap file target..."
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-medium">Description</label>
                    <textarea
                      value={sophosFields.deskripsi}
                      onChange={(e) => setSophosFields({ ...sophosFields, deskripsi: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white h-12 resize-none"
                      placeholder="LNX-DET-RAM-CACHE-CLEARED adalah Alert yang..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Initial Analysis</label>
                      <textarea
                        value={sophosFields.analisa_awal}
                        onChange={(e) => setSophosFields({ ...sophosFields, analisa_awal: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white h-12 resize-none"
                        placeholder="LNX-DET-RAM-CACHE-CLEARED terdeteksi saat..."
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Reputation</label>
                      <input
                        type="text"
                        value={sophosFields.reputasi}
                        onChange={(e) => setSophosFields({ ...sophosFields, reputasi: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="-"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-medium">Recommendation / Mitigasi</label>
                    <textarea
                      value={sophosFields.mitigasi}
                      onChange={(e) => setSophosFields({ ...sophosFields, mitigasi: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white h-16 resize-none"
                      placeholder="1. Verifikasi isi file..."
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Event Name & Severity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Event Name</label>
                      <input
                        type="text"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        required
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. AndroxGh0st Scanning Traffic"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Severity / Magnitude</label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                      >
                        <option value="Low">Low (1-3)</option>
                        <option value="Medium">Medium (4-6)</option>
                        <option value="High">High (7-10)</option>
                      </select>
                    </div>
                  </div>

                  {/* Src IP & Src Country */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Source IPs (one per line)</label>
                      <textarea
                        value={srcIp}
                        onChange={(e) => setSrcIp(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-mono h-14 resize-none"
                        placeholder="192.168.1.1"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Source Country (one per line)</label>
                      <textarea
                        value={srcCountry}
                        onChange={(e) => setSrcCountry(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-mono h-14 resize-none"
                        placeholder="Indonesia"
                      />
                    </div>
                  </div>

                  {/* Dst IP & Dst Port & Dst Country */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Dest IPs</label>
                      <textarea
                        value={dstIp}
                        onChange={(e) => setDstIp(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-mono h-14 resize-none"
                        placeholder="10.0.1.20"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Dest Ports</label>
                      <textarea
                        value={dstPort}
                        onChange={(e) => setDstPort(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-mono h-14 resize-none"
                        placeholder="80, 443"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Dest Countries</label>
                      <textarea
                        value={dstCountry}
                        onChange={(e) => setDstCountry(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-mono h-14 resize-none"
                        placeholder="Indonesia"
                      />
                    </div>
                  </div>

                  {/* URL/DNS & Query */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">URL / DNS</label>
                      <input
                        type="text"
                        value={urlDns}
                        onChange={(e) => setUrlDns(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="https://test.com/env"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">SQL / String Query</label>
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="select * from users"
                      />
                    </div>
                  </div>

                  {/* Deteksi & Deskripsi */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Waktu Deteksi</label>
                      <input
                        type="text"
                        value={waktuDeteksi}
                        onChange={(e) => setWaktuDeteksi(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-medium"
                        placeholder="e.g. 06-07-2026 12:45:30"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-medium">Deskripsi Event / Action</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white h-16 resize-none"
                        placeholder="Describe what occurred and findings..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={generating}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/10"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating Event Report...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Generate Event Report Preview
              </>
            )}
          </button>
        </form>
      </div>

      {/* Output / Preview Area */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        {/* If no generation result yet */}
        {!result && !generating && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 text-center items-center justify-center min-h-[500px] shadow-lg">
            <div className="h-12 w-12 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
              <Eye className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Event Report Preview</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                Fill the form or paste a raw log line, then click Generate. The complete report filled with variables will render here ready to copy or download.
              </p>
            </div>
          </div>
        )}

        {generating && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 items-center justify-center min-h-[500px] shadow-lg">
            <div className="h-10 w-10 rounded-full border-2 border-slate-800 border-t-indigo-500 animate-spin"></div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-slate-200">Processing Variables</h3>
              <p className="text-xs text-indigo-400 mt-2 font-mono">Filling event template placeholders...</p>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Generated Event Reports ({result.files.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.files.map((fileObj, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border bg-indigo-950/50 border-indigo-800 text-indigo-400">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <h4 className="text-xs font-semibold text-slate-200 truncate" title={fileObj.name}>{fileObj.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Event Output Report</p>
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    fileObj.content && (fileObj.content.includes('<table') || fileObj.content.includes('</table>'))
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-950 border-slate-900'
                  }`}>
                    {fileObj.content && (fileObj.content.includes('<table') || fileObj.content.includes('</table>')) ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-end gap-1 border-b border-slate-800 pb-1.5 mb-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewModes(prev => ({ ...prev, [index]: 'rendered' }))}
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${
                              (previewModes[index] || 'rendered') === 'rendered'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Rendered
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewModes(prev => ({ ...prev, [index]: 'raw' }))}
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${
                              (previewModes[index] || 'rendered') === 'raw'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Raw Code
                          </button>
                        </div>
                        {(previewModes[index] || 'rendered') === 'rendered' ? (
                          <div 
                            className="text-[11px] text-slate-800 max-h-[350px] overflow-y-auto select-text bg-white p-4 rounded-md border border-slate-200"
                            dangerouslySetInnerHTML={{ __html: fileObj.content }}
                          />
                        ) : (
                          <pre className="text-[10px] font-mono text-slate-400 max-h-[250px] overflow-y-auto whitespace-pre-wrap select-all bg-slate-950 p-2 rounded border border-slate-800">
                            {fileObj.content}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <pre className="text-[10px] font-mono text-slate-400 max-h-[120px] overflow-y-auto whitespace-pre-wrap select-all">
                        {fileObj.content}
                      </pre>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadSingleFile(fileObj)}
                      className="flex-1 py-1.5 px-3 bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-lg text-[10px] font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="h-3 w-3 text-indigo-400" />
                      Download File
                    </button>

                    <button
                      onClick={() => copySingleFileToClipboard(fileObj.content, index)}
                      className="flex-1 py-1.5 px-3 bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-lg text-[10px] font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-indigo-400" />
                          Copy Report
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// 3. TEMPLATES TAB
// ==========================================
function TemplatesTab({
  templates,
  loading,
  fetchTemplates,
  setActiveTab,
  instansiList,
}: {
  templates: Record<string, string[]>;
  loading: boolean;
  fetchTemplates: () => void;
  setActiveTab: (tab: 'processor' | 'manual' | 'templates' | 'docs') => void;
  instansiList: string[];
}) {
  const [selectedInstansi, setSelectedInstansi] = useState('kemkes');
  const [searchQuery, setSearchQuery] = useState('');

  // Template View state
  const [activeTemplate, setActiveTemplate] = useState<{ name: string; instansi: string; content: string; formattedName: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for Create Template
  const [newInstansi, setNewInstansi] = useState('kemkes');
  const [newFilename, setNewFilename] = useState('');
  const [newDeskripsi, setNewDeskripsi] = useState('');
  const [newMitigasi, setNewMitigasi] = useState('');
  const [newAnalisaAwal, setNewAnalisaAwal] = useState('');
  const [newReputasi, setNewReputasi] = useState('-');
  const [templatePreviewMode, setTemplatePreviewMode] = useState<'rendered' | 'raw'>('rendered');
  const [creating, setCreating] = useState(false);
  const [formMessage, setFormMessage] = useState<{ success: boolean; text: string } | null>(null);

  // GitHub Integration States (Shared with RepositoryTab via server /api/github-config & localStorage)
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem('github_pat') || '');
  const [githubRepo, setGithubRepo] = useState<string>(() => localStorage.getItem('github_repo') || '');
  const [githubBranch, setGithubBranch] = useState<string>(() => localStorage.getItem('github_branch') || 'main');
  const [githubAutoSync, setGithubAutoSync] = useState<boolean>(() => localStorage.getItem('github_autosync') === 'true');
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false);
  const [githubSyncStatus, setGithubSyncStatus] = useState<{
    loading: boolean;
    type: 'success' | 'error' | null;
    message: string;
  }>({ loading: false, type: null, message: '' });

  // Temp form states for Modal
  const [tempPat, setTempPat] = useState(githubToken);
  const [tempRepo, setTempRepo] = useState(githubRepo);
  const [tempBranch, setTempBranch] = useState(githubBranch);
  const [tempAutoSync, setTempAutoSync] = useState(githubAutoSync);

  // Admin Privacy Mode States (Lock GitHub Settings / Push / Pull for regular users)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => localStorage.getItem('repo_admin_unlocked') === 'true');
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string>('');
  const [storedAdminPin] = useState<string>(() => localStorage.getItem('repo_admin_pin') || 'wisnuganteng');
  const [pendingAdminAction, setPendingAdminAction] = useState<('github_settings' | 'pull_github' | 'push_github') | null>(null);

  // Verify PIN to Unlock Admin Mode
  const handleVerifyAdminPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const inputClean = adminPinInput.trim();
    if (inputClean === storedAdminPin || inputClean === 'wisnuganteng' || inputClean === 'admin') {
      setIsAdminUnlocked(true);
      localStorage.setItem('repo_admin_unlocked', 'true');
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setAdminPinError('');

      // Execute pending action if any
      if (pendingAdminAction === 'github_settings') {
        setTempPat(githubToken);
        setTempRepo(githubRepo);
        setTempBranch(githubBranch);
        setTempAutoSync(githubAutoSync);
        setShowGithubModal(true);
      } else if (pendingAdminAction === 'pull_github') {
        syncPullFromGitHub(true);
      } else if (pendingAdminAction === 'push_github' && activeTemplate) {
        commitTemplateToGitHub(activeTemplate.instansi, activeTemplate.name, activeTemplate.content);
      }
      setPendingAdminAction(null);
    } else {
      setAdminPinError('PIN Admin salah. Silakan masukkan PIN yang benar.');
    }
  };

  // Lock Admin Mode
  const handleLockAdminMode = () => {
    setIsAdminUnlocked(false);
    localStorage.setItem('repo_admin_unlocked', 'false');
  };

  // Pull / Sync latest templates & database files from GitHub repository to local disk
  const syncPullFromGitHub = async (showNotification = true) => {
    if (showNotification) {
      setGithubSyncStatus({ loading: true, type: null, message: 'Menarik (pull sync) file terbaru dari GitHub repository...' });
    }
    try {
      const res = await fetch('/api/github-sync-pull', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (showNotification) {
          setGithubSyncStatus({
            loading: false,
            type: 'success',
            message: data.message || `Berhasil sync ${data.count} file dari GitHub!`
          });
        }
        await fetchTemplates();
        return true;
      } else {
        if (showNotification) {
          setGithubSyncStatus({
            loading: false,
            type: 'error',
            message: data.message || 'Gagal menarik data dari GitHub.'
          });
        }
        return false;
      }
    } catch (err: any) {
      if (showNotification) {
        setGithubSyncStatus({
          loading: false,
          type: 'error',
          message: `Error pull sync: ${err.message}`
        });
      }
      return false;
    }
  };

  // Auto load central GitHub configuration from server (/api/github-config) on mount
  useEffect(() => {
    const loadCentralGithubConfig = async () => {
      try {
        const res = await fetch('/api/github-config');
        const data = await res.json();
        const localPat = localStorage.getItem('github_pat') || '';
        const localRepo = localStorage.getItem('github_repo') || '';
        const localBranch = localStorage.getItem('github_branch') || '';

        if (data && data.success && data.config) {
          const cfg = data.config;

          // 1. Token logic: Prefer server token if non-empty; otherwise fallback to localPat if present
          const finalToken = (cfg.githubToken && cfg.githubToken.trim()) ? cfg.githubToken : localPat;
          if (finalToken) {
            setGithubToken(finalToken);
            setTempPat(finalToken);
            localStorage.setItem('github_pat', finalToken);

            // Sync to server if server token was empty
            if (!cfg.githubToken || !cfg.githubToken.trim()) {
              fetch('/api/github-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ githubToken: finalToken })
              }).catch(() => {});
            }
          }

          // 2. Repo logic
          const finalRepo = cfg.githubRepo || localRepo;
          if (finalRepo) {
            setGithubRepo(finalRepo);
            setTempRepo(finalRepo);
            localStorage.setItem('github_repo', finalRepo);
          }

          // 3. Branch logic
          const finalBranch = cfg.githubBranch || localBranch || 'main';
          setGithubBranch(finalBranch);
          setTempBranch(finalBranch);
          localStorage.setItem('github_branch', finalBranch);

          // 4. AutoSync logic
          if (cfg.githubAutoSync !== undefined) {
            setGithubAutoSync(cfg.githubAutoSync);
            setTempAutoSync(cfg.githubAutoSync);
            localStorage.setItem('github_autosync', cfg.githubAutoSync ? 'true' : 'false');
          }

          // Auto pull templates from GitHub if token is set
          if (finalToken && finalToken.trim()) {
            await syncPullFromGitHub(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch central github config:', err);
      }
    };
    loadCentralGithubConfig();
  }, []);

  const saveGithubSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setGithubToken(tempPat);
    setGithubRepo(tempRepo);
    setGithubBranch(tempBranch);
    setGithubAutoSync(tempAutoSync);

    localStorage.setItem('github_pat', tempPat);
    localStorage.setItem('github_repo', tempRepo);
    localStorage.setItem('github_branch', tempBranch);
    localStorage.setItem('github_autosync', tempAutoSync ? 'true' : 'false');
    setShowGithubModal(false);

    try {
      await fetch('/api/github-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: tempPat,
          githubRepo: tempRepo,
          githubBranch: tempBranch,
          githubAutoSync: tempAutoSync
        })
      });
      setGithubSyncStatus({
        loading: false,
        type: 'success',
        message: 'Konfigurasi GitHub Sync berhasil disimpan secara terpusat di server!'
      });
    } catch (err) {
      console.error('Failed to save github config to server:', err);
      setGithubSyncStatus({
        loading: false,
        type: 'success',
        message: 'Konfigurasi tersimpan lokal.'
      });
    }
  };

  const list = templates[selectedInstansi] || [];
  const filteredTemplates = list.filter((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

  // Commit template directly to GitHub REST API
  const commitTemplateToGitHub = async (instansi: string, filename: string, content: string, customMsg?: string) => {
    const pat = githubToken.trim();
    const repoRaw = githubRepo.trim();
    if (!pat || !repoRaw) {
      setGithubSyncStatus({
        loading: false,
        type: 'error',
        message: 'GitHub Sync belum dikonfigurasi. Silakan isi Personal Access Token & Repo Name.'
      });
      return false;
    }

    const cleanRepo = repoRaw.replace('https://github.com/', '').replace('.git', '').trim();
    const targetBranch = githubBranch.trim() || 'main';
    const cleanName = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    const targetPath = `templates/${instansi.toLowerCase()}/${cleanName}`;

    setGithubSyncStatus({ loading: true, type: null, message: `Mengirim ${targetPath} ke GitHub...` });

    try {
      // 1. Get existing file SHA if present
      let existingSha = '';
      const getRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${targetPath}?ref=${targetBranch}`, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getRes.ok) {
        const getData = await getRes.json();
        existingSha = getData.sha;
      }

      // 2. Encode UTF-8 content to Base64
      const utf8Bytes = new TextEncoder().encode(content);
      let binaryString = '';
      for (let i = 0; i < utf8Bytes.byteLength; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binaryString);

      // 3. PUT request to commit file
      const putRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${targetPath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: customMsg || `feat(template): sync ${targetPath} via Web UI`,
          content: base64Content,
          branch: targetBranch,
          ...(existingSha ? { sha: existingSha } : {})
        })
      });

      const putData = await putRes.json();
      if (putRes.ok) {
        const nowStr = new Date().toLocaleTimeString();
        setGithubSyncStatus({
          loading: false,
          type: 'success',
          message: `Berhasil sync template ${targetPath} ke GitHub pada ${nowStr}!`
        });
        return true;
      } else {
        let errMsg = putData.message || 'Error dari API GitHub';
        if (errMsg.includes('Bad credentials')) {
          errMsg = 'Token GitHub (PAT) tidak valid atau sudah kedaluwarsa. Silakan perbarui Token di menu GitHub Settings.';
        }
        throw new Error(errMsg);
      }
    } catch (err: any) {
      let errMsg = err.message || 'Error';
      if (errMsg.includes('Bad credentials')) {
        errMsg = 'Token GitHub (PAT) tidak valid atau sudah kedaluwarsa. Silakan perbarui Token di menu GitHub Settings.';
      }
      setGithubSyncStatus({
        loading: false,
        type: 'error',
        message: `Gagal sync ke GitHub: ${errMsg}`
      });
      return false;
    }
  };

  // Delete template file from GitHub REST API
  const deleteTemplateFromGitHub = async (instansi: string, filename: string) => {
    const pat = githubToken.trim();
    const repoRaw = githubRepo.trim();
    if (!pat || !repoRaw) return false;

    const cleanRepo = repoRaw.replace('https://github.com/', '').replace('.git', '').trim();
    const targetBranch = githubBranch.trim() || 'main';
    const cleanName = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    const targetPath = `templates/${instansi.toLowerCase()}/${cleanName}`;

    try {
      const getRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${targetPath}?ref=${targetBranch}`, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getRes.ok) {
        const getData = await getRes.json();
        const existingSha = getData.sha;

        await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${targetPath}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `chore(template): delete ${targetPath} via Web UI`,
            sha: existingSha,
            branch: targetBranch
          })
        });
        setGithubSyncStatus({
          loading: false,
          type: 'success',
          message: `Template ${targetPath} berhasil dihapus dari GitHub!`
        });
      }
    } catch (e) {
      console.error('Failed to delete template from GitHub:', e);
    }
  };

  const handlePreview = async (tName: string) => {
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(selectedInstansi)}/${encodeURIComponent(tName)}`);
      const data = await res.json();
      if (data && data.content) {
        setActiveTemplate({
          name: tName,
          instansi: selectedInstansi,
          content: data.content,
          formattedName: data.formattedName,
        });
        setEditedContent(data.content);
        setEditing(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveChanges = async () => {
    if (!activeTemplate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(activeTemplate.instansi)}/${encodeURIComponent(activeTemplate.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTemplate((prev) => (prev ? { ...prev, content: editedContent } : null));
        setEditing(false);

        // Auto Sync or Push to GitHub if credentials set
        if (githubToken && githubRepo) {
          await commitTemplateToGitHub(activeTemplate.instansi, activeTemplate.name, editedContent);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(activeTemplate.instansi)}/${encodeURIComponent(activeTemplate.name)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        if (githubToken && githubRepo) {
          await deleteTemplateFromGitHub(activeTemplate.instansi, activeTemplate.name);
        }
        setActiveTemplate(null);
        setDeleting(false);
        fetchTemplates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormMessage(null);
    try {
      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instansi: newInstansi,
          filename: newFilename,
          deskripsi: newDeskripsi,
          mitigasi: newMitigasi,
          analisa_awal: newAnalisaAwal,
          reputasi: newReputasi,
        }),
      });
      const data = await res.json();
      if (data.success) {
        let textMsg = data.message;
        // Auto commit to GitHub if Token & Repo are configured
        if (githubToken && githubRepo) {
          const synced = await commitTemplateToGitHub(
            newInstansi,
            data.cleanFilename || newFilename,
            data.content || '',
            `feat(template): add new template ${newInstansi}/${data.cleanFilename || newFilename}`
          );
          if (synced) {
            textMsg += ' & tersync langsung ke GitHub!';
          }
        }
        setFormMessage({ success: true, text: textMsg });
        setNewFilename('');
        setNewDeskripsi('');
        setNewMitigasi('');
        fetchTemplates();
      } else {
        setFormMessage({ success: false, text: data.error || 'Gagal membuat template' });
      }
    } catch (e: any) {
      setFormMessage({ success: false, text: e.message });
    } finally {
      setCreating(false);
    }
  };

  const isGithubConfigured = Boolean(githubToken.trim() && githubRepo.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-6"
    >
      {/* GitHub Sync Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg border shrink-0 ${isGithubConfigured ? 'bg-indigo-950/50 border-indigo-800/60 text-indigo-400' : 'bg-amber-950/40 border-amber-800/40 text-amber-400'}`}>
            <Github className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-200">GitHub Template Sync Engine</h3>
              {isGithubConfigured ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  Sync Disconnected
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
              Agar template baru (seperti <code className="text-indigo-400 bg-slate-950 px-1 py-0.5 rounded">templates/kemkes/*.txt</code>) tidak hilang saat server restart, hubungkan GitHub PAT. Setiap pembuatan/perubahan template akan langsung dipush ke repository.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {/* Admin Mode Toggle Button */}
          {isAdminUnlocked ? (
            <button
              id="btn-lock-admin-mode-templates"
              onClick={handleLockAdminMode}
              className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
              title="Lock Admin Mode (Melindungi GitHub Settings & Sync)"
            >
              <Unlock className="h-3.5 w-3.5 text-emerald-400" />
              <span>Admin Mode</span>
            </button>
          ) : (
            <button
              id="btn-unlock-admin-mode-templates"
              onClick={() => {
                setPendingAdminAction(null);
                setShowAdminPinModal(true);
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
              title="Unlock Mode Admin untuk Akses Pengaturan GitHub & Sync"
            >
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>Admin Lock</span>
            </button>
          )}

          {isGithubConfigured && (
            <button
              onClick={() => {
                if (!isAdminUnlocked) {
                  setPendingAdminAction('pull_github');
                  setShowAdminPinModal(true);
                } else {
                  syncPullFromGitHub(true);
                }
              }}
              disabled={githubSyncStatus.loading}
              className="px-3 py-1.5 bg-emerald-950/80 border border-emerald-700/60 hover:bg-emerald-900/80 text-emerald-300 disabled:opacity-50 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow"
              title="Tarik (Pull) template & data terbaru dari GitHub ke server"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${githubSyncStatus.loading ? 'animate-spin' : ''}`} />
              Pull from GitHub
            </button>
          )}

          {activeTemplate && isGithubConfigured && (
            <button
              onClick={() => {
                if (!isAdminUnlocked) {
                  setPendingAdminAction('push_github');
                  setShowAdminPinModal(true);
                } else {
                  commitTemplateToGitHub(activeTemplate.instansi, activeTemplate.name, activeTemplate.content);
                }
              }}
              disabled={githubSyncStatus.loading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow"
              title="Push template ini langsung ke GitHub"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              Push to GitHub
            </button>
          )}

          <button
            onClick={() => {
              if (!isAdminUnlocked) {
                setPendingAdminAction('github_settings');
                setShowAdminPinModal(true);
              } else {
                setTempPat(githubToken);
                setTempRepo(githubRepo);
                setTempBranch(githubBranch);
                setTempAutoSync(githubAutoSync);
                setShowGithubModal(true);
              }
            }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <Settings className="h-3.5 w-3.5 text-indigo-400" />
            GitHub Settings
          </button>
        </div>
      </div>

      {/* Sync status alert banner if active */}
      {githubSyncStatus.message && (
        <div
          className={`px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            githubSyncStatus.loading
              ? 'bg-indigo-950/40 border-indigo-800/40 text-indigo-300'
              : githubSyncStatus.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {githubSyncStatus.loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            ) : githubSyncStatus.type === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            )}
            <span>{githubSyncStatus.message}</span>
          </div>
          <button
            onClick={() => setGithubSyncStatus({ loading: false, type: null, message: '' })}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: List & Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* List & Search Side */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold uppercase text-slate-300 tracking-wider">Templates Library</h2>
            </div>
            {/* Instansi Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-md border border-slate-800">
              {instansiList.map((ins) => (
                <button
                  key={ins}
                  onClick={() => {
                    setSelectedInstansi(ins);
                    setActiveTemplate(null);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all ${
                    selectedInstansi === ins
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ins}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
              placeholder="Search templates..."
            />
          </div>

          {/* Templates Items Scroll container */}
          <div className="flex-1 max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-1.5 border border-slate-800/40 p-2 rounded-lg bg-slate-950/40">
            {loading ? (
              <p className="text-xs text-slate-500 text-center py-6">Loading templates...</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No matching templates found</p>
            ) : (
              filteredTemplates.map((tName) => {
                const isActive = activeTemplate?.name === tName;
                return (
                  <button
                    key={tName}
                    onClick={() => handlePreview(tName)}
                    className={`w-full px-3 py-2 text-left rounded-lg text-xs font-medium transition-all flex items-center justify-between border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 border-transparent text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-4">{tName.replace(/[_\-]+/g, ' ')}</span>
                    <ChevronIcon isActive={isActive} />
                  </button>
                );
              })
            )}
          </div>

          {/* Create Template Subform */}
          <div className="border-t border-slate-800 pt-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4 text-indigo-400" />
              Create New Template
            </h3>
            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newInstansi}
                  onChange={(e) => setNewInstansi(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  {instansiList.map((ins) => (
                    <option key={ins} value={ins}>
                      {ins.toUpperCase()}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none placeholder-slate-600"
                  placeholder="Filename (e.g. Malware_Scan)"
                />
              </div>

              <textarea
                value={newDeskripsi}
                onChange={(e) => setNewDeskripsi(e.target.value)}
                className="w-full h-12 bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-slate-200 focus:outline-none resize-none placeholder-slate-600"
                placeholder="Deskripsi Event placeholder value..."
              />

              {newInstansi === 'sophos' && (
                <>
                  <textarea
                    value={newAnalisaAwal}
                    onChange={(e) => setNewAnalisaAwal(e.target.value)}
                    className="w-full h-12 bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-slate-200 focus:outline-none resize-none placeholder-slate-600"
                    placeholder="Analisa Awal placeholder value..."
                  />

                  <input
                    type="text"
                    value={newReputasi}
                    onChange={(e) => setNewReputasi(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none placeholder-slate-600"
                    placeholder="Reputasi (e.g. Malicious/Legitimate/-)"
                  />
                </>
              )}

              <textarea
                value={newMitigasi}
                onChange={(e) => setNewMitigasi(e.target.value)}
                className="w-full h-12 bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-slate-200 focus:outline-none resize-none placeholder-slate-600"
                placeholder="Mitigasi placeholder value..."
              />

              {formMessage && (
                <p className={`text-[10px] ${formMessage.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formMessage.text}
                </p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[10px] font-bold text-white rounded-lg flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate & Sync Template
              </button>
            </form>
          </div>
        </div>

        {/* Editor & Preview Side */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {!activeTemplate ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 text-center items-center justify-center min-h-[500px] shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                <Eye className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Template Viewer & Editor</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                  Select a template from the list to preview its exact text layout, edit placeholders directly on disk, or delete them safely.
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-full min-h-[500px]"
            >
              {/* Template Header Toolbar */}
              <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-400 bg-indigo-950/50 border border-indigo-900/40 px-2 py-0.5 rounded-md">
                    {activeTemplate.instansi}
                  </span>
                  <h3 className="text-xs font-bold text-slate-200 mt-1 truncate max-w-[200px] sm:max-w-md">
                    {activeTemplate.formattedName}
                  </h3>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setActiveTab('manual');
                    }}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-white rounded-lg text-[10px] font-semibold text-indigo-400 transition-all flex items-center gap-1"
                    title="Use in manual report form"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Use Template
                  </button>

                  {isGithubConfigured && (
                    <button
                      onClick={() => commitTemplateToGitHub(activeTemplate.instansi, activeTemplate.name, activeTemplate.content)}
                      disabled={githubSyncStatus.loading}
                      className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-indigo-400 rounded-lg text-slate-300 transition-colors"
                      title="Push to GitHub"
                    >
                      <CloudUpload className="h-4 w-4 text-indigo-400" />
                    </button>
                  )}

                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-white rounded-lg text-slate-300 transition-colors"
                      title="Edit Template text"
                    >
                      <Edit3 className="h-4 w-4 text-indigo-400" />
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={handleSaveChanges}
                        disabled={saving}
                        className="p-1.5 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600 rounded-lg text-emerald-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold"
                        title="Save & Push Changes"
                      >
                        <Check className="h-4 w-4" />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditedContent(activeTemplate.content);
                        }}
                        className="p-1.5 bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600 rounded-lg text-rose-400 hover:text-white transition-colors"
                        title="Cancel Edit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Delete template toggle */}
                  {!deleting ? (
                    <button
                      onClick={() => setDeleting(true)}
                      className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-rose-950 hover:border-rose-900 rounded-lg text-slate-300 hover:text-rose-400 transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="h-4 w-4 text-indigo-400 hover:text-rose-400" />
                    </button>
                  ) : (
                    <div className="flex bg-rose-950/20 border border-rose-800 p-0.5 rounded-lg items-center gap-1">
                      <span className="text-[9px] text-rose-400 font-bold px-2">Sure?</span>
                      <button
                        onClick={handleDeleteTemplate}
                        className="py-1 px-2 bg-rose-600 hover:bg-rose-500 text-[9px] font-bold text-white rounded"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleting(false)}
                        className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-[9px] font-bold text-slate-300 rounded"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Body display / Textarea */}
              <div className="p-4 flex-1 bg-slate-950 overflow-y-auto flex flex-col">
                {!editing && activeTemplate.content && (activeTemplate.content.includes('<table') || activeTemplate.content.includes('</table>')) && (
                  <div className="flex justify-end gap-1.5 border-b border-slate-800 pb-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setTemplatePreviewMode('rendered')}
                      className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                        templatePreviewMode === 'rendered'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Rendered
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplatePreviewMode('raw')}
                      className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                        templatePreviewMode === 'raw'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Raw Template Code
                    </button>
                  </div>
                )}

                {editing ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-[400px] bg-slate-950 border-0 p-2 font-mono text-xs text-slate-200 focus:outline-none focus:ring-0 resize-none leading-relaxed"
                  />
                ) : (
                  templatePreviewMode === 'rendered' && (activeTemplate.content.includes('<table') || activeTemplate.content.includes('</table>')) ? (
                    <div 
                      className="text-xs text-slate-800 bg-white p-4 rounded border border-slate-200 select-text max-h-[400px] overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: activeTemplate.content }}
                    />
                  ) : (
                    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-slate-300 p-2 select-text">
                      {activeTemplate.content}
                    </pre>
                  )
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* GitHub Integration Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Konfigurasi GitHub Sync</h3>
              </div>
              <button
                onClick={() => setShowGithubModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveGithubSettings} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={tempPat}
                  onChange={(e) => setTempPat(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Butuh scope <code className="text-indigo-400">repo</code> atau <code className="text-indigo-400">contents:write</code>.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Repository (username/repository)
                </label>
                <input
                  type="text"
                  value={tempRepo}
                  onChange={(e) => setTempRepo(e.target.value)}
                  placeholder="username/my-soc-repo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Target Branch
                </label>
                <input
                  type="text"
                  value={tempBranch}
                  onChange={(e) => setTempBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <p className="font-semibold text-slate-200">Auto-Sync to GitHub</p>
                  <p className="text-[10px] text-slate-400">Otomatis push saat template dibuat / diedit</p>
                </div>
                <input
                  type="checkbox"
                  checked={tempAutoSync}
                  onChange={(e) => setTempAutoSync(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGithubModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Simpan Konfigurasi
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Admin Privacy Mode PIN Modal */}
      <AnimatePresence>
        {showAdminPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      Admin Privacy Mode
                    </h3>
                    <p className="text-xs text-slate-400">
                      Akses Terproteksi Mode Admin
                    </p>
                  </div>
                </div>
                <button
                  id="close-admin-pin-modal-app"
                  onClick={() => {
                    setShowAdminPinModal(false);
                    setAdminPinError('');
                    setAdminPinInput('');
                    setPendingAdminAction(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleVerifyAdminPin} className="p-6 space-y-4">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed space-y-1">
                  <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    Akses Fitur GitHub Dibatasi Admin
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Fitur <b className="text-slate-200">GitHub Settings</b>, <b className="text-slate-200">Pull from GitHub</b>, dan <b className="text-slate-200">Push to GitHub</b> hanya dapat diakses oleh Admin untuk keamanan repositori.
                  </p>
                </div>

                {adminPinError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{adminPinError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-indigo-400" />
                    Masukkan PIN Admin:
                  </label>
                  <input
                    id="input-admin-pin-app"
                    type="password"
                    autoFocus
                    value={adminPinInput}
                    onChange={(e) => {
                      setAdminPinInput(e.target.value);
                      setAdminPinError('');
                    }}
                    placeholder="Masukkan Password Admin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-center tracking-widest"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>Akses khusus Admin / Penanggung Jawab Repositori</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminPinModal(false);
                      setAdminPinError('');
                      setAdminPinInput('');
                      setPendingAdminAction(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-2"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Unlock Mode Admin</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ==========================================
// 4. DOCUMENTATION TAB
// ==========================================
function DocsTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl flex flex-col gap-6"
    >
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <HelpCircle className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-bold text-white">Panduan Penggunaan Sistem</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-300 leading-relaxed text-xs">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="h-5 w-5 rounded bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-[10px]">1</span>
            Format & Cara Parsing Logs (.txt)
          </h3>
          <p>
            Parsing file report mendeteksi log aktivitas yang diekspor dari SIEM / QRadar dalam bentuk tab-separated values (.txt). Baris log dipisahkan berdasarkan karakter tab (<code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 text-[10px] font-mono">\t</code>).
          </p>
          <p>
            Setiap baris logs mencakup minimal data-data penting: ID Event, Nama Analyst, ID Ticket, Tipe Event, Severity/Magnitude, Tanggal, Waktu Deteksi, dan IP Address asal (Source IP) serta IP Address tujuan (Destination IP).
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400 flex flex-col gap-1">
            <span className="text-slate-500 font-bold border-b border-slate-800/60 pb-1 mb-1 block">Log TSV Structure:</span>
            <span>Index 0: Event ID</span>
            <span>Index 1: Analyst Name</span>
            <span>Index 2: Ticket ID</span>
            <span>Index 3: Event Type (Log Activity / Offensess)</span>
            <span>Index 7: Event Name (Mencocokkan nama template)</span>
            <span>Index 8: Magnitude</span>
            <span>Index 20: Source IP Address</span>
            <span>Index 22: Destination IP Address</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="h-5 w-5 rounded bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-[10px]">2</span>
            Mekanisme Placeholders Template
          </h3>
          <p>
            Setiap nama event yang terdeteksi di logs dicocokkan dengan file template teks di folder <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 text-[10px]">templates/{`{instansi}`}/*.txt</code>. Variabel di dalam template diapit oleh tanda kurung kurawal (<code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-400 text-[10px]">{`{ }`}</code>).
          </p>
          <p>
            Sistem secara otomatis mengganti placeholders tersebut dengan nilai riil dari logs saat parsing selesai.
          </p>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-2">
            <h4 className="text-[10px] font-semibold text-slate-200">List Placeholder Variabel:</h4>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
              <div>
                <p className="text-indigo-400">{`{event_name}`}</p>
                <p className="text-slate-500">Nama Event Utama</p>
              </div>
              <div>
                <p className="text-indigo-400">{`{severity}`}</p>
                <p className="text-slate-500">Skala Bahaya (Low/Med/High)</p>
              </div>
              <div>
                <p className="text-indigo-400">{`{sev_magnitude}`}</p>
                <p className="text-slate-500">Nilai Angka Magnitude</p>
              </div>
              <div>
                <p className="text-indigo-400">{`{tanggal} {waktu}`}</p>
                <p className="text-slate-500">Waktu Kejadian Terdeteksi</p>
              </div>
              <div>
                <p className="text-indigo-400">{`{src_ip}`}</p>
                <p className="text-slate-500">List IP Penyerang</p>
              </div>
              <div>
                <p className="text-indigo-400">{`{dst_ip}`}</p>
                <p className="text-slate-500">List IP Target Korban</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="h-5 w-5 rounded bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-[10px]">3</span>
            Konverter Offense XML ke Excel
          </h3>
          <p>
            Jika Anda mengupload file XML, sistem mendeteksi tag <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 text-[10px]">&lt;OffenseForm&gt;</code> dan mengekstrak rincian offense SIEM QRadar (ID, Magnitude, Kategori, Deskripsi, Penyerang, dsb.).
          </p>
          <p>
            Seluruh data offenses akan disusun ke dalam baris tabel terstruktur, lalu secara otomatis diekspor ke format dokumen spreadsheet <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 text-[10px]">.xlsx</code> yang rapi, siap diunduh untuk kebutuhan reporting serah terima shift kerja.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="h-5 w-5 rounded bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-[10px]">4</span>
            Laporan Ringkasan WhatsApp (WA)
          </h3>
          <p>
            Selain file detail event individu, sistem parsing logs secara otomatis membuat laporan WhatsApp harian berdasarkan template <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 text-[10px]">wa_template_*.txt</code>.
          </p>
          <p>
            Laporan ini berisi ringkasan statistik jumlah kejadian offenses dan log activity selama shift kerja berlangsung, yang dapat langsung disalin dari console hasil parsing logs untuk diteruskan ke grup koordinasi instansi terkait.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Mini Helpers
function ChevronIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isActive ? 'rotate-90 text-white' : 'text-slate-500 hover:text-slate-300'}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
