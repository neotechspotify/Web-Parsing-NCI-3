import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  FileText, 
  Check, 
  GitBranch, 
  GitCommit, 
  History, 
  Terminal, 
  ArrowRight, 
  Shield, 
  Globe, 
  RefreshCw, 
  FileCode, 
  X, 
  ChevronRight, 
  Info, 
  Copy,
  User,
  ShieldAlert,
  AlertTriangle,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Filter,
  Layers,
  FileCheck,
  Download,
  Github,
  Settings,
  ExternalLink,
  AlertCircle,
  CloudDownload,
  CloudUpload,
  Lock,
  Unlock,
  ShieldCheck,
  Key
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface BlacklistFile {
  name: string;
  size: number;
  lines: number;
  totalLines: number;
  updatedAt: string;
}

interface RepositoryTabProps {
  instansiList: string[];
}

// Custom mock commits to make it feel extremely realistic
const MOCK_COMMITS: Record<string, { author: string; hash: string; msg: string; date: string }> = {
  "List-IP-Blacklist.txt": {
    author: "Fadil (SOC Analyst)",
    hash: "6e2a89c",
    msg: "Update List-IP-Blacklist.txt with malicious IPs from ticket SOC-20260721-0094",
    date: "2026-07-21 07:39 WIB"
  },
  "List-IP-Whitelist.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "a4f10dd",
    msg: "Add new local subnets and internal gateway ranges",
    date: "2026-07-20 14:15 WIB"
  },
  "List-Domain-Blacklist.txt": {
    author: "Bayu (SOC Lead)",
    hash: "ff901b5",
    msg: "Block malicious domains identified from threat feed",
    date: "2026-07-21 08:12 WIB"
  },
  "List-Domain-Ads-Blacklist.txt": {
    author: "System Bot",
    hash: "401ad89",
    msg: "Cron Update: Sync telemetry and ad blocker listings",
    date: "2026-07-19 03:00 WIB"
  },
  "List-Domain-Whitelist-General.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "dc7721a",
    msg: "Approve trusted government domains for whitelist",
    date: "2026-07-18 11:24 WIB"
  },
  "List-Domain-Whitelist-Wifi.txt": {
    author: "Bayu (SOC Lead)",
    hash: "88ea9b3",
    msg: "Allow high-bandwidth music and video streaming on Wi-Fi",
    date: "2026-07-17 16:45 WIB"
  },
  "List-URL-Filtering.txt": {
    author: "Fadil (SOC Analyst)",
    hash: "c299e5a",
    msg: "Block known path exploits and phpinfo exposure endpoints",
    date: "2026-07-21 07:49 WIB"
  },
  "List-URL-Whitelist-General.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "3e102f4",
    msg: "Add standard application health and landing paths",
    date: "2026-07-15 09:12 WIB"
  },
  "List-URL-Whitelist-Wifi.txt": {
    author: "Bayu (SOC Lead)",
    hash: "740adff",
    msg: "Allow local captive portal and asset pathings",
    date: "2026-07-15 10:00 WIB"
  },
  "AutomationBlacklistSOC.txt": {
    author: "SOC Automator",
    hash: "da99281",
    msg: "Auto-Block: Detect active brute-force attacker IP",
    date: "2026-07-21 06:15 WIB"
  },
  "WebHook-Test.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "b0193cf",
    msg: "Configure Discord alerting integration",
    date: "2026-07-20 18:22 WIB"
  }
};

const LOCKED_INSTANSI_LIST = ['kemkes', 'sophos'];

export default function RepositoryTab({ instansiList }: RepositoryTabProps) {
  const [selectedInstansi, setSelectedInstansi] = useState<string>('medika');
  const [files, setFiles] = useState<BlacklistFile[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('List-IP-Blacklist.txt');
  const [loading, setLoading] = useState<boolean>(false);
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  
  // File Content State
  const [fileContent, setFileContent] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [isEditingRaw, setIsEditingRaw] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'code' | 'blame'>('code');

  // Interactive Table States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newEntry, setNewEntry] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [copiedLine, setCopiedLine] = useState<number | null>(null);

  // Excel / CSV / Text Importer States
  interface ParsedIPItem {
    ip: string;
    originalRow: number;
    status: 'new' | 'duplicate_in_file' | 'already_in_repo';
    rawRowData?: Record<string, any>;
  }

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importSourceType, setImportSourceType] = useState<'file' | 'paste'>('file');
  const [importFileName, setImportFileName] = useState<string>('');
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [parsedColumns, setParsedColumns] = useState<string[]>([]);
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<string>('source.ip');
  const [parsedRawRows, setParsedRawRows] = useState<Record<string, any>[]>([]);
  const [parsedIPList, setParsedIPList] = useState<ParsedIPItem[]>([]);
  const [importFilterMode, setImportFilterMode] = useState<'all' | 'new_only' | 'duplicates_only'>('all');
  const [copiedFormattedOutput, setCopiedFormattedOutput] = useState<boolean>(false);
  const [showFormattedOutputPreview, setShowFormattedOutputPreview] = useState<boolean>(false);

  // GitHub Integration & Auto-Sync States
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false);
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem('github_pat') || '');
  const [githubRepo, setGithubRepo] = useState<string>(() => localStorage.getItem('github_repo') || 'neotechspotify/Web-Parsing-NCI');
  const [githubBranch, setGithubBranch] = useState<string>(() => localStorage.getItem('github_branch') || 'main');
  const [githubFilePath, setGithubFilePath] = useState<string>(() => localStorage.getItem('github_filepath') || 'database/medika/blacklists/List-IP-Blacklist.txt');
  const [githubAutoSync, setGithubAutoSync] = useState<boolean>(() => localStorage.getItem('github_autosync') === 'true');
  const [githubSyncStatus, setGithubSyncStatus] = useState<{ loading: boolean; type: 'success' | 'error' | null; message: string; lastSyncTime?: string }>({
    loading: false,
    type: null,
    message: ''
  });

  // Fetch central GitHub configuration from server (/api/github-config)
  useEffect(() => {
    const fetchCentralGithubConfig = async () => {
      try {
        const res = await fetch('/api/github-config');
        const data = await res.json();
        const localPat = localStorage.getItem('github_pat') || '';
        const localRepo = localStorage.getItem('github_repo') || '';
        const localBranch = localStorage.getItem('github_branch') || '';
        const localPath = localStorage.getItem('github_filepath') || '';

        if (data && data.success && data.config) {
          const cfg = data.config;

          // 1. Token logic
          const finalToken = (cfg.githubToken && cfg.githubToken.trim()) ? cfg.githubToken : localPat;
          if (finalToken) {
            setGithubToken(finalToken);
            localStorage.setItem('github_pat', finalToken);

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
            localStorage.setItem('github_repo', finalRepo);
          }

          // 3. Branch logic
          const finalBranch = cfg.githubBranch || localBranch || 'main';
          setGithubBranch(finalBranch);
          localStorage.setItem('github_branch', finalBranch);

          // 4. File path logic
          const finalPath = cfg.githubFilePath || localPath;
          if (finalPath) {
            setGithubFilePath(finalPath);
            localStorage.setItem('github_filepath', finalPath);
          }

          if (cfg.githubAutoSync !== undefined) {
            setGithubAutoSync(cfg.githubAutoSync);
            localStorage.setItem('github_autosync', cfg.githubAutoSync ? 'true' : 'false');
          }
        }
      } catch (err) {
        console.error('Failed to fetch central github config in RepositoryTab:', err);
      }
    };
    fetchCentralGithubConfig();
  }, []);

  // Admin Privacy Mode States (Lock GitHub Push / Sync / Download for regular users)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => localStorage.getItem('repo_admin_unlocked') === 'true');
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string>('');
  const [storedAdminPin, setStoredAdminPin] = useState<string>(() => localStorage.getItem('repo_admin_pin') || 'wisnuganteng');

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
    } else {
      setAdminPinError('PIN Admin salah. Silakan masukkan PIN yang benar.');
    }
  };

  // Lock Admin Mode
  const handleLockAdminMode = () => {
    setIsAdminUnlocked(false);
    localStorage.setItem('repo_admin_unlocked', 'false');
  };

  // Check if active selected instansi is locked (AAL, KEMKES, SOPHOS)
  const isInstansiLocked = LOCKED_INSTANSI_LIST.includes(selectedInstansi.toLowerCase()) && !isAdminUnlocked;

  // Download / Export current file content as .txt
  const handleDownloadFile = () => {
    if (!fileContent) return;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFilename || 'List-IP-Blacklist.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Save GitHub Config
  const saveGithubSettings = async (pat: string, repo: string, branch: string, path: string, autoSync: boolean) => {
    setGithubToken(pat);
    setGithubRepo(repo);
    setGithubBranch(branch);
    setGithubFilePath(path);
    setGithubAutoSync(autoSync);

    localStorage.setItem('github_pat', pat);
    localStorage.setItem('github_repo', repo);
    localStorage.setItem('github_branch', branch);
    localStorage.setItem('github_filepath', path);
    localStorage.setItem('github_autosync', autoSync ? 'true' : 'false');

    try {
      await fetch('/api/github-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: pat,
          githubRepo: repo,
          githubBranch: branch,
          githubFilePath: path,
          githubAutoSync: autoSync
        })
      });
    } catch (err) {
      console.error('Failed to save central github config from RepositoryTab:', err);
    }
  };

  // Commit & Push File directly to GitHub REST API
  const commitToGitHub = async (customContent?: string, customMsg?: string) => {
    const pat = githubToken.trim();
    const repoRaw = githubRepo.trim();
    if (!pat || !repoRaw) {
      setGithubSyncStatus({ loading: false, type: 'error', message: 'GitHub Personal Access Token and Repo Name are required.' });
      setShowGithubModal(true);
      return false;
    }

    const contentToPush = customContent !== undefined ? customContent : fileContent;
    const cleanRepo = repoRaw.replace('https://github.com/', '').replace('.git', '').trim();
    const targetBranch = githubBranch.trim() || 'main';
    const targetPath = githubFilePath.trim() || `database/${selectedInstansi}/blacklists/${selectedFilename}`;

    setGithubSyncStatus({ loading: true, type: null, message: `Committing to GitHub...` });

    try {
      // 1. Get existing file SHA if present on branch
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

      // 2. Base64 encode content (UTF-8 safe)
      const utf8Bytes = new TextEncoder().encode(contentToPush);
      let binaryString = '';
      for (let i = 0; i < utf8Bytes.byteLength; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binaryString);

      // 3. Commit/Push file via PUT request
      const activeCount = contentToPush.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
      const commitMsg = customMsg || `feat(repo): update ${selectedFilename} via Web UI [${activeCount} active entries]`;

      const putRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${targetPath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: commitMsg,
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
          message: `Successfully pushed commit to GitHub at ${nowStr}!`,
          lastSyncTime: nowStr
        });
        return true;
      } else {
        let errMsg = putData.message || 'GitHub API error';
        if (errMsg.includes('Resource not accessible by personal access token')) {
          errMsg = 'Resource not accessible by personal access token. Token Anda tidak memiliki izin Write/Repo ke repository ini. Gunakan Personal Access Token Classic dengan centang centang "repo", atau jika Fine-grained token set Repository permissions -> Contents menjadi "Read and write".';
        }
        throw new Error(errMsg);
      }
    } catch (err: any) {
      console.error('GitHub Sync Error:', err);
      let msg = err.message || 'Unknown error';
      if (msg.includes('Resource not accessible by personal access token')) {
        msg = 'Resource not accessible by personal access token. Token Anda tidak memiliki izin Write/Repo. Solusi: Gunakan Personal Access Token (Classic) & centang checkbox "repo".';
      }
      setGithubSyncStatus({
        loading: false,
        type: 'error',
        message: `GitHub Sync Failed: ${msg}`
      });
      return false;
    }
  };

  // Pull latest content from GitHub repository
  const pullFromGitHub = async () => {
    const pat = githubToken.trim();
    const repoRaw = githubRepo.trim();
    if (!pat || !repoRaw) {
      setShowGithubModal(true);
      return;
    }

    const cleanRepo = repoRaw.replace('https://github.com/', '').replace('.git', '').trim();
    const targetBranch = githubBranch.trim() || 'main';
    const targetPath = githubFilePath.trim() || `database/${selectedInstansi}/blacklists/${selectedFilename}`;

    setGithubSyncStatus({ loading: true, type: null, message: `Pulling from GitHub...` });

    try {
      const getRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${targetPath}?ref=${targetBranch}`, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getRes.ok) {
        const getData = await getRes.json();
        const rawBase64 = getData.content.replace(/\n/g, '');
        const binaryString = atob(rawBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const fetchedText = new TextDecoder().decode(bytes);

        await saveFileContent(fetchedText, `Synced from GitHub`);
        const nowStr = new Date().toLocaleTimeString();
        setGithubSyncStatus({
          loading: false,
          type: 'success',
          message: `Successfully pulled latest content from GitHub!`,
          lastSyncTime: nowStr
        });
      } else {
        const errData = await getRes.json();
        throw new Error(errData.message || 'File not found on GitHub');
      }
    } catch (err: any) {
      setGithubSyncStatus({
        loading: false,
        type: 'error',
        message: `Failed to pull from GitHub: ${err.message}`
      });
    }
  };

  // Fetch file list for selected instansi
  const fetchFiles = async (instansi: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blacklists/${encodeURIComponent(instansi)}`);
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        console.warn(`Failed to fetch files for ${instansi}: HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        let fileList = data.files;
        if (instansi.toLowerCase() === 'aal') {
          fileList = data.files.filter((f: BlacklistFile) => f.name === 'List-Domain-Blacklist.txt');
        } else if (instansi.toLowerCase() === 'medika') {
          fileList = data.files.filter((f: BlacklistFile) => f.name === 'List-IP-Blacklist.txt');
        }
        setFiles(fileList);
        
        const defaultFilename = instansi.toLowerCase() === 'aal' ? 'List-Domain-Blacklist.txt' : 'List-IP-Blacklist.txt';
        if (!fileList.some((f: BlacklistFile) => f.name === selectedFilename)) {
          if (fileList.some((f: BlacklistFile) => f.name === defaultFilename)) {
            setSelectedFilename(defaultFilename);
          } else if (fileList.length > 0) {
            setSelectedFilename(fileList[0].name);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch blacklists files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch content for a specific file
  const fetchFileContent = async (instansi: string, filename: string) => {
    if (!instansi || !filename) return;

    // Prevent requesting invalid file for restricted instansi
    if (instansi.toLowerCase() === 'aal' && filename !== 'List-Domain-Blacklist.txt') {
      return;
    }
    if (instansi.toLowerCase() === 'medika' && filename !== 'List-IP-Blacklist.txt') {
      return;
    }

    setFileLoading(true);
    setIsEditingRaw(false);
    setSearchTerm('');
    setNewEntry('');
    setSaveStatus({ type: null, message: '' });
    try {
      const res = await fetch(`/api/blacklists/${encodeURIComponent(instansi)}/${encodeURIComponent(filename)}`);
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        console.warn(`Response for ${filename} was non-JSON or HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setFileContent(data.content);
        setInitialContent(data.content);
      }
    } catch (error) {
      console.error(`Failed to fetch file content for ${filename}:`, error);
    } finally {
      setFileLoading(false);
    }
  };

  // Save/Commit file content to the server
  const saveFileContent = async (contentToSave: string, actionMsg: string = "Updated file") => {
    try {
      const res = await fetch(`/api/blacklists/${encodeURIComponent(selectedInstansi)}/${encodeURIComponent(selectedFilename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentToSave })
      });
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        setSaveStatus({ type: 'error', message: `Server error (HTTP ${res.status})` });
        return;
      }
      const data = await res.json();
      if (data.success) {
        setFileContent(contentToSave);
        setInitialContent(contentToSave);
        setSaveStatus({ type: 'success', message: `${selectedFilename} successfully updated on server!` });
        // Refresh metadata list
        fetchFiles(selectedInstansi);
        setTimeout(() => setSaveStatus({ type: null, message: '' }), 5000);

        // Auto Sync to GitHub if enabled
        if (githubAutoSync && githubToken && githubRepo) {
          commitToGitHub(contentToSave, `feat(repo): ${actionMsg} [${selectedFilename}]`);
        }
      } else {
        setSaveStatus({ type: 'error', message: `Failed to save: ${data.error}` });
      }
    } catch (error: any) {
      setSaveStatus({ type: 'error', message: `Server error: ${error.message}` });
    }
  };

  // Trigger loading files on mount and instansi change
  useEffect(() => {
    fetchFiles(selectedInstansi);
  }, [selectedInstansi]);

  // Trigger loading file content when file selection changes
  useEffect(() => {
    if (selectedFilename) {
      fetchFileContent(selectedInstansi, selectedFilename);
    }
  }, [selectedFilename, selectedInstansi]);

  // Parsing individual lines of the file for the interactive view
  const fileLines = useMemo(() => {
    if (!fileContent) return [];
    return fileContent.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      const isComment = trimmed.startsWith('#') || trimmed.startsWith('//');
      const isEmpty = trimmed.length === 0;
      return {
        id: idx + 1,
        text: line,
        trimmed,
        isComment,
        isEmpty
      };
    });
  }, [fileContent]);

  // Clean elements (excluding comments and empty lines) for search and count
  const structuredEntries = useMemo(() => {
    return fileLines.filter(line => !line.isComment && !line.isEmpty);
  }, [fileLines]);

  // Filtered entries for search
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return structuredEntries;
    const lower = searchTerm.toLowerCase();
    return structuredEntries.filter(entry => entry.trimmed.toLowerCase().includes(lower));
  }, [structuredEntries, searchTerm]);

  // Extraction & Auto-Filtering Helper for Excel / CSV / Text
  const extractAndFilterIPs = (rows: Record<string, any>[], columnKey: string) => {
    const items: ParsedIPItem[] = [];
    const seenInFile = new Set<string>();
    const existingInRepo = new Set(structuredEntries.map(e => e.trimmed.toLowerCase()));
    const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/;
    const domainRegex = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d+)?$/;

    rows.forEach((row, idx) => {
      let rawVal = row[columnKey];
      if (rawVal === undefined || rawVal === null || rawVal === '') {
        const keyMatch = Object.keys(row).find(k => k.trim().toLowerCase() === columnKey.trim().toLowerCase());
        if (keyMatch) rawVal = row[keyMatch];
      }

      if (rawVal !== undefined && rawVal !== null) {
        let valStr = String(rawVal).replace(/["']/g, '').trim();
        let cleanEntry = '';

        if (isDomainFile || columnKey.toLowerCase().includes('domain') || columnKey.toLowerCase().includes('host')) {
          // Clean URL prefixes/paths if any
          valStr = valStr.replace(/^https?:\/\//i, '').replace(/:\d+$/, '').split('/')[0].trim();
          const isPureIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(valStr) || /^[\d\.:]+$/.test(valStr);
          const parts = valStr.split('.');
          const tld = parts[parts.length - 1];
          const isValidTld = /^[a-zA-Z]{2,}$/.test(tld);

          if (valStr && valStr.includes('.') && !valStr.includes(' ') && valStr !== '-' && valStr !== 'null' && !isPureIp && isValidTld) {
            cleanEntry = valStr;
          }
        } else {
          const match = valStr.match(ipRegex);
          if (match) {
            cleanEntry = match[0];
          }
        }

        if (cleanEntry) {
          const lowerVal = cleanEntry.toLowerCase();

          let status: 'new' | 'duplicate_in_file' | 'already_in_repo' = 'new';
          if (existingInRepo.has(lowerVal)) {
            status = 'already_in_repo';
          } else if (seenInFile.has(lowerVal)) {
            status = 'duplicate_in_file';
          } else {
            seenInFile.add(lowerVal);
          }

          items.push({
            ip: cleanEntry,
            originalRow: idx + 2,
            status,
            rawRowData: row
          });
        }
      }
    });

    setParsedIPList(items);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setImportFileName(uploadedFile.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        let cols: string[] = [];
        if (jsonRows.length > 0) {
          cols = Object.keys(jsonRows[0]);
        } else {
          cols = isDomainFile ? ['botnetdomain', 'domain'] : ['source.ip'];
        }

        setParsedColumns(cols);
        setParsedRawRows(jsonRows);

        const preferredCols = isDomainFile 
          ? ['botnetdomain', 'botnet_domain', 'botnet domain', 'domain', 'domain.name', 'dns.query', 'host', 'destination.domain', 'target.domain', 'domain_name']
          : ['source.ip', 'source_ip', 'src_ip', 'source ip', 'src ip', 'ip', 'source', 'sourceip'];

        const autoCol = cols.find(c => preferredCols.includes(c.trim().toLowerCase())) || cols[0] || (isDomainFile ? 'botnetdomain' : 'source.ip');

        setSelectedTargetColumn(autoCol);
        extractAndFilterIPs(jsonRows, autoCol);
      } catch (err: any) {
        console.error("Failed to parse file:", err);
        setSaveStatus({ type: 'error', message: `Failed to parse file: ${err.message}` });
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleTargetColumnChange = (newCol: string) => {
    setSelectedTargetColumn(newCol);
    if (parsedRawRows.length > 0) {
      extractAndFilterIPs(parsedRawRows, newCol);
    }
  };

  const handlePasteTextChange = (text: string) => {
    // Automatically strip double quotes (") and single quotes (') attached when copying multi-line cells from Excel / Google Sheets
    const sanitizedText = text.replace(/["']/g, '');
    setRawPasteText(sanitizedText);
    if (!sanitizedText.trim()) {
      setParsedIPList([]);
      setParsedRawRows([]);
      setParsedColumns([]);
      return;
    }

    if (sanitizedText.includes(',') || sanitizedText.includes('source.ip') || sanitizedText.includes('botnetdomain') || sanitizedText.includes('\t')) {
      try {
        const workbook = XLSX.read(sanitizedText, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonRows.length > 0) {
          const cols = Object.keys(jsonRows[0]);
          setParsedColumns(cols);
          setParsedRawRows(jsonRows);

          const preferredCols = isDomainFile 
            ? ['botnetdomain', 'botnet_domain', 'botnet domain', 'domain', 'domain.name', 'dns.query', 'host', 'destination.domain', 'target.domain', 'domain_name']
            : ['source.ip', 'source_ip', 'src_ip', 'source ip', 'src ip', 'ip', 'source', 'sourceip'];
          const autoCol = cols.find(c => preferredCols.includes(c.trim().toLowerCase())) || cols[0] || (isDomainFile ? 'botnetdomain' : 'source.ip');

          setSelectedTargetColumn(autoCol);
          extractAndFilterIPs(jsonRows, autoCol);
          return;
        }
      } catch (e) {
        // ignore
      }
    }

    const lines = sanitizedText.split('\n');
    const items: ParsedIPItem[] = [];
    const seenInFile = new Set<string>();
    const existingInRepo = new Set(structuredEntries.map(e => e.trimmed.toLowerCase()));
    const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;

    lines.forEach((line, idx) => {
      let cleanEntry = '';
      if (isDomainFile) {
        const cleaned = line.trim().replace(/^https?:\/\//i, '').replace(/:\d+$/, '').split('/')[0].trim();
        const isPureIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(cleaned) || /^[\d\.:]+$/.test(cleaned);
        const parts = cleaned.split('.');
        const tld = parts[parts.length - 1];
        const isValidTld = /^[a-zA-Z]{2,}$/.test(tld);

        if (cleaned && cleaned.includes('.') && !cleaned.includes(' ') && cleaned !== '-' && cleaned !== 'null' && !isPureIp && isValidTld) {
          cleanEntry = cleaned;
        }
      } else {
        const matches = line.match(ipRegex);
        if (matches && matches.length > 0) {
          cleanEntry = matches[0].trim();
        }
      }

      if (cleanEntry) {
        const lowerVal = cleanEntry.toLowerCase();

        let status: 'new' | 'duplicate_in_file' | 'already_in_repo' = 'new';
        if (existingInRepo.has(lowerVal)) {
          status = 'already_in_repo';
        } else if (seenInFile.has(lowerVal)) {
          status = 'duplicate_in_file';
        } else {
          seenInFile.add(lowerVal);
        }

        items.push({
          ip: cleanEntry,
          originalRow: idx + 1,
          status
        });
      }
    });

    setParsedIPList(items);
  };

  const handleConfirmImport = () => {
    const newIPs = parsedIPList.filter(i => i.status === 'new').map(i => i.ip);
    if (newIPs.length === 0) return;

    const currentLines = fileContent.split('\n');
    if (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() !== '') {
      currentLines.push('');
    }

    const updatedContent = [...currentLines, ...newIPs].join('\n');
    const duplicatesFiltered = parsedIPList.length - newIPs.length;

    saveFileContent(
      updatedContent,
      `Imported ${newIPs.length} unique IPs from ${importFileName || 'Excel/CSV input'} (${duplicatesFiltered} duplicates auto-filtered)`
    );

    setShowImportModal(false);
    setParsedIPList([]);
    setParsedRawRows([]);
    setRawPasteText('');
    setImportFileName('');
  };

  // Formatted Output computation for New Unique IPs (Source IP, Source Geo Country Name, Destination IP, Destination Port)
  const formattedNewUniqueOutput = useMemo(() => {
    const newItems = parsedIPList.filter(i => i.status === 'new');
    if (newItems.length === 0) return '';

    const getRowVal = (row: Record<string, any> | undefined, candidates: string[], fallback: string = '-') => {
      if (!row) return fallback;
      const keys = Object.keys(row);
      for (const cand of candidates) {
        const candLower = cand.toLowerCase().trim();
        const foundKey = keys.find(k => k.toLowerCase().trim() === candLower);
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
          return String(row[foundKey]).replace(/["']/g, '').trim();
        }
      }
      return fallback;
    };

    const sourceIPs = newItems.map(item => getRowVal(item.rawRowData, ['source.ip', 'source_ip', 'src_ip', 'source ip', 'source', 'ip'], item.ip));
    const sourceCountries = newItems.map(item => getRowVal(item.rawRowData, ['source.geo.country_name', 'source.geo.country_iso_code', 'source_geo_country_name', 'source_country', 'source country', 'country_name', 'country', 'geo', 'source.country'], '-'));
    const destIPs = newItems.map(item => getRowVal(item.rawRowData, ['destination.ip', 'destination_ip', 'dst_ip', 'destination ip', 'destination', 'dest_ip', 'dest ip'], '-'));
    const destPorts = newItems.map(item => getRowVal(item.rawRowData, ['destination.port', 'destination_port', 'dst_port', 'destination port', 'dest_port', 'dest port', 'port'], '-'));

    return `Source IP :\n${sourceIPs.join('\n')}\n\nSoure IP Country : \n${sourceCountries.join('\n')}\n\nDestination IP :\n${destIPs.join('\n')}\n\nDestination Port :\n${destPorts.join('\n')}`;
  }, [parsedIPList]);

  const handleCopyFormattedOutput = () => {
    if (!formattedNewUniqueOutput) return;
    navigator.clipboard.writeText(formattedNewUniqueOutput);
    setCopiedFormattedOutput(true);
    setTimeout(() => setCopiedFormattedOutput(false), 3000);
  };

  // Handle adding an individual entry
  const handleAddEntry = () => {
    const trimmedEntry = newEntry.replace(/["']/g, '').trim();
    if (!trimmedEntry) return;

    // Check for duplicates
    const isDuplicate = structuredEntries.some(entry => entry.trimmed.toLowerCase() === trimmedEntry.toLowerCase());
    if (isDuplicate) {
      setSaveStatus({ type: 'error', message: `"${trimmedEntry}" already exists in the list!` });
      return;
    }

    const currentLines = fileContent.split('\n');
    // If the last line isn't empty, add a newline
    if (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() !== '') {
      currentLines.push('');
    }
    currentLines.push(trimmedEntry);
    const updatedContent = currentLines.join('\n');

    saveFileContent(updatedContent, `Added entry ${trimmedEntry}`);
    setNewEntry('');
  };

  // Handle deleting an entry
  const handleDeleteEntry = (entryText: string) => {
    const lines = fileContent.split('\n');
    const filteredLines = lines.filter(line => line.trim() !== entryText.trim());
    const updatedContent = filteredLines.join('\n');

    saveFileContent(updatedContent, `Deleted entry ${entryText}`);
  };

  // Copy line to clipboard helper
  const handleCopyLine = (text: string, id: number) => {
    navigator.clipboard.writeText(text.trim());
    setCopiedLine(id);
    setTimeout(() => setCopiedLine(null), 1500);
  };

  // Selected file details
  const currentFileMeta = files.find(f => f.name === selectedFilename);
  const activeCommit = MOCK_COMMITS[selectedFilename] || {
    author: "System Admin",
    hash: "a1b2c3d",
    msg: "Update configuration file",
    date: "2026-07-21 00:00 WIB"
  };

  // Determine file type category to render correct styling
  const isIPFile = selectedFilename.toLowerCase().includes('ip');
  const isDomainFile = selectedFilename.toLowerCase().includes('domain');
  const isURLFile = selectedFilename.toLowerCase().includes('url');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      id="repository-container"
      className="flex flex-col gap-6"
    >
      {/* Top Controller Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            Threat Intelligence & Whitelist Repository
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage cybersecurity blacklists, whitelists, and webhook logs in a fully featured GitHub-like collaborative repo structure.
          </p>
        </div>

        {/* Instansi Selection Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <label htmlFor="instansi-select" className="text-xs font-semibold text-slate-300">Active Instansi:</label>
          <div className="relative">
            <select
              id="instansi-select"
              value={selectedInstansi}
              onChange={(e) => {
                const nextInstansi = e.target.value;
                setSelectedInstansi(nextInstansi);
                if (nextInstansi.toLowerCase() === 'aal') {
                  setSelectedFilename('List-Domain-Blacklist.txt');
                } else if (nextInstansi.toLowerCase() === 'medika') {
                  setSelectedFilename('List-IP-Blacklist.txt');
                }
              }}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase cursor-pointer"
            >
              {instansiList.map((ins) => {
                const isLocked = LOCKED_INSTANSI_LIST.includes(ins.toLowerCase());
                return (
                  <option key={ins} value={ins}>
                    {ins.toUpperCase()} {isLocked ? '🔒 (Locked)' : ''}
                  </option>
                );
              })}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
          
          <button 
            onClick={() => fetchFiles(selectedInstansi)}
            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Refresh Repository"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split Layout or Locked State Banner */}
      {isInstansiLocked ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 md:p-14 text-center flex flex-col items-center justify-center max-w-2xl mx-auto my-8 shadow-2xl backdrop-blur-md"
        >
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 mb-5">
            <Lock className="h-10 w-10 text-amber-400" />
          </div>
          <span className="text-[11px] font-bold font-mono tracking-widest text-amber-400 uppercase bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/20 mb-3">
            Instansi Repository Locked
          </span>
          <h3 className="text-xl font-bold text-slate-100 mb-2">
            Repositori Instansi {selectedInstansi.toUpperCase()} Terkunci
          </h3>
          <p className="text-xs md:text-sm text-slate-400 max-w-md leading-relaxed mb-6">
            Fitur repositori untuk instansi <span className="text-slate-200 font-semibold uppercase">{selectedInstansi}</span> saat ini belum dibuka karena belum ada kebutuhan aktif threat intelligence/blacklist. Seluruh pengelolaan repositori saat ini difokuskan pada instansi <span className="text-indigo-400 font-bold">MEDIKA</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              id="btn-switch-to-medika"
              onClick={() => setSelectedInstansi('medika')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-2"
            >
              <Shield className="h-4 w-4 text-indigo-200" />
              Beralih ke Repositori MEDIKA
            </button>

            {!isAdminUnlocked && (
              <button
                id="btn-unlock-admin-from-locked"
                onClick={() => setShowAdminPinModal(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-xs rounded-xl transition-all flex items-center gap-2"
              >
                <Key className="h-3.5 w-3.5 text-amber-400" />
                Unlock Mode Admin
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SIDEBAR: File Tree View */}
        <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">Repository Explorer</span>
            </div>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full font-mono font-bold">
              {files.length} Files
            </span>
          </div>

          {/* Repository Branch/Tag indicator */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-900 text-[11px] text-slate-400 font-mono">
            <GitBranch className="h-3 w-3 text-indigo-400 shrink-0" />
            <span className="text-slate-200 font-bold shrink-0">main</span>
            <span className="text-slate-600">|</span>
            <span className="truncate">SOC-{selectedInstansi.toUpperCase()}</span>
          </div>

          {/* Files List tree */}
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[500px] pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                <span className="text-xs text-slate-400">Loading files...</span>
              </div>
            ) : (
              files.map((file) => {
                const isSelected = file.name === selectedFilename;
                const fileIconColor = file.name.includes('Blacklist') 
                  ? 'text-red-400' 
                  : file.name.includes('Whitelist') 
                  ? 'text-emerald-400' 
                  : 'text-indigo-400';

                return (
                  <button
                    key={file.name}
                    id={`file-tree-item-${file.name.replace(/\./g, '-')}`}
                    onClick={() => setSelectedFilename(file.name)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-150 text-left ${
                      isSelected 
                        ? 'bg-indigo-600/15 border border-indigo-500/30 text-white' 
                        : 'hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCode className={`h-4 w-4 shrink-0 ${fileIconColor}`} />
                      <span className="text-xs font-medium truncate font-mono">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                      {file.lines} entries
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* MAIN BODY: GitHub-like Code Viewer & Editor */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Repository Header Details */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            
            {/* File Path and Header info */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-slate-400">
                <span className="text-slate-300 font-bold hover:underline cursor-pointer">SOC-{selectedInstansi.toUpperCase()}</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400 hover:underline cursor-pointer">database</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400 hover:underline cursor-pointer">blacklists</span>
                <span className="text-slate-600">/</span>
                <span className="text-indigo-400 font-bold font-mono">{selectedFilename}</span>
              </div>

              {/* Action Buttons: RAW download, Admin Lock & GitHub Sync */}
              <div className="flex items-center gap-2">
                {currentFileMeta && (
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3 mr-2 hidden md:flex">
                    <span>{(currentFileMeta.size / 1024).toFixed(2)} KB</span>
                    <span>•</span>
                    <span>{currentFileMeta.totalLines} lines ({currentFileMeta.lines} active entries)</span>
                  </div>
                )}

                {/* Admin Privacy Mode Lock Toggle Button */}
                {isAdminUnlocked ? (
                  <button
                    id="btn-lock-admin-mode"
                    onClick={handleLockAdminMode}
                    className="px-2.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
                    title="Lock Admin Mode (Hide GitHub & Export features from regular users)"
                  >
                    <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Admin Mode</span>
                  </button>
                ) : (
                  <button
                    id="btn-unlock-admin-mode"
                    onClick={() => setShowAdminPinModal(true)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
                    title="Unlock Admin Mode with PIN to access GitHub Sync & Export"
                  >
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    <span>Admin Lock</span>
                  </button>
                )}

                {/* Private Actions - Visible ONLY when Admin Mode is UNLOCKED */}
                {isAdminUnlocked && (
                  <>
                    {/* 1. Download / Export .txt File Button */}
                    <button
                      id="btn-download-file-txt"
                      onClick={handleDownloadFile}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow animate-fade-in"
                      title="Export & Download active file as .txt"
                    >
                      <Download className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Download .txt</span>
                    </button>

                    {/* 2. GitHub Sync / Config Button */}
                    <button
                      id="btn-open-github-modal"
                      onClick={() => setShowGithubModal(true)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow animate-fade-in ${
                        githubToken
                          ? 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                      }`}
                      title="Configure GitHub API Token & Sync settings"
                    >
                      <Github className="h-3.5 w-3.5 text-slate-300" />
                      {githubToken ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          GitHub Sync
                        </span>
                      ) : (
                        <span>GitHub Config</span>
                      )}
                    </button>
                  </>
                )}
                
                {/* Save Alert Messages */}
                {saveStatus.type && (
                  <div className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 animate-fade-in ${
                    saveStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {saveStatus.type === 'success' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {saveStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* Commit bar details (Simulates GitHub Commit info header) */}
            <div className="px-5 py-3.5 bg-slate-900/30 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold font-mono text-[10px] uppercase shrink-0">
                  {activeCommit.author.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-200">{activeCommit.author}</span>
                    <span className="text-slate-400 truncate max-w-md">{activeCommit.msg}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Commit <span className="font-mono text-slate-400">{activeCommit.hash}</span> on {activeCommit.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* 3. Push to GitHub Button - Visible ONLY in Admin Mode */}
                {isAdminUnlocked && githubToken && (
                  <button
                    id="btn-quick-github-commit"
                    onClick={() => commitToGitHub()}
                    disabled={githubSyncStatus.loading}
                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-semibold flex items-center gap-1 transition-all shadow"
                    title="Commit & Push current file directly to GitHub"
                  >
                    {githubSyncStatus.loading ? (
                      <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                    ) : (
                      <CloudUpload className="h-3 w-3 text-emerald-400" />
                    )}
                    Push to GitHub
                  </button>
                )}
                <div className="text-[10px] font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-400 shrink-0">
                  Latest Commit: <span className="text-indigo-400">{activeCommit.hash}</span>
                </div>
              </div>
            </div>

            {/* View Mode Toolbar: Code vs Blame */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/60 border-b border-slate-800">
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  id="tab-view-code"
                  onClick={() => { setViewMode('code'); setIsEditingRaw(false); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'code' 
                      ? 'bg-slate-950 text-white border border-slate-800' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Code
                </button>
                <button
                  id="tab-view-blame"
                  onClick={() => { setViewMode('blame'); setIsEditingRaw(false); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'blame' 
                      ? 'bg-slate-950 text-white border border-slate-800' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Blame
                </button>
              </div>

              {viewMode === 'code' && (
                <button
                  id="toggle-raw-editor"
                  onClick={() => setIsEditingRaw(!isEditingRaw)}
                  className={`text-xs px-3 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors ${
                    isEditingRaw 
                      ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white' 
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <Edit3 className="h-3 w-3" />
                  {isEditingRaw ? "Interactive View" : "Edit Raw File"}
                </button>
              )}
            </div>

            {/* CORE CONTENT VIEWER OR EDITOR */}
            <div className="p-0 font-mono text-xs min-h-[400px] flex flex-col bg-slate-950">
              
              {fileLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className="text-xs text-slate-400">Loading file content...</span>
                </div>
              ) : isEditingRaw ? (
                
                /* 1. RAW TEXT AREA EDITOR */
                <div className="flex flex-col flex-1 p-4 gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 rounded-lg font-sans">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>You are editing the raw file content. Please write one entry per line. Lines starting with # are comments. Duplicate values are ignored in standard parsing.</span>
                  </div>
                  
                  <textarea
                    id="raw-blacklist-textarea"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    className="flex-1 w-full min-h-[400px] bg-slate-950 border border-slate-800 text-slate-200 p-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs leading-relaxed"
                    placeholder="# Comments go here\n45.205.1.222"
                  />

                  <div className="flex items-center justify-end gap-3 pt-2 font-sans">
                    <button
                      id="cancel-raw-edit"
                      onClick={() => { setFileContent(initialContent); setIsEditingRaw(false); }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-all font-semibold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      id="save-raw-edit"
                      onClick={() => { saveFileContent(fileContent, "Updated raw file contents"); setIsEditingRaw(false); }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-bold text-xs flex items-center gap-2 shadow"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Commit Changes
                    </button>
                  </div>
                </div>

              ) : viewMode === 'blame' ? (
                
                /* 2. GIT BLAME VIEW */
                <div className="flex flex-col flex-1 divide-y divide-slate-900 overflow-x-auto">
                  {fileLines.length === 0 ? (
                    <div className="text-slate-500 italic p-10 text-center">Empty File</div>
                  ) : (
                    fileLines.map((line) => {
                      // Dynamically associate line content to mock users for extreme realism
                      let blameUser = "System Admin";
                      let blameHash = "0000000";
                      let blameDate = "2026-07-15";
                      
                      if (line.isComment) {
                        blameUser = "System Admin";
                        blameHash = "1a08cb3";
                        blameDate = "2026-07-15";
                      } else {
                        // Spread lines among Wisnu, Fadil, and Bayu
                        const seed = (line.id * 7) % 3;
                        if (seed === 0) {
                          blameUser = "Fadil";
                          blameHash = activeCommit.hash;
                          blameDate = "2026-07-21";
                        } else if (seed === 1) {
                          blameUser = "Wisnu";
                          blameHash = "a4f10dd";
                          blameDate = "2026-07-20";
                        } else {
                          blameUser = "Bayu";
                          blameHash = "ff901b5";
                          blameDate = "2026-07-21";
                        }
                      }

                      return (
                        <div key={line.id} className="flex items-stretch text-left hover:bg-slate-900/20 font-mono text-[11px] leading-6 min-w-[700px]">
                          {/* Blame Metadata pane */}
                          <div className="w-56 bg-slate-950 border-r border-slate-900 px-3 py-0.5 select-none text-slate-500 flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-600 font-mono tracking-tight">{blameHash}</span>
                            <span className="text-slate-700 shrink-0">•</span>
                            <span className="truncate max-w-[80px] font-bold text-slate-400">{blameUser}</span>
                            <span className="text-slate-700 shrink-0">•</span>
                            <span className="text-[10px] tracking-tight">{blameDate}</span>
                          </div>

                          {/* Line number */}
                          <div className="w-12 border-r border-slate-900 text-right pr-3 select-none text-slate-600 shrink-0 bg-slate-950/20">
                            {line.id}
                          </div>

                          {/* Line content */}
                          <div className={`pl-4 flex-1 whitespace-pre pr-4 ${line.isComment ? 'text-slate-500 italic' : 'text-slate-300'}`}>
                            {line.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              ) : (
                
                /* 3. INTERACTIVE STRUCTURED TABLE (Quick View & Add/Delete) */
                <div className="flex flex-col flex-1 p-5 gap-5 font-sans animate-fade-in">
                  
                  {/* Quick-add and Filter controllers */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/30 p-3.5 rounded-xl border border-slate-800/80">
                    
                    {/* Add form */}
                    <div className="flex-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          id="add-entry-input"
                          type="text"
                          value={newEntry}
                          onChange={(e) => setNewEntry(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
                          placeholder={
                            isIPFile 
                              ? "Add IP address (e.g., 185.120.45.10)..." 
                              : isDomainFile 
                              ? "Add Domain name (e.g., badserver.com)..."
                              : isURLFile
                              ? "Add URL pattern (e.g., /config/db_test.php)..."
                              : "Add new blacklist entry..."
                          }
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3.5 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                        {newEntry && (
                          <button 
                            onClick={() => setNewEntry('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <button
                        id="add-entry-button"
                        onClick={handleAddEntry}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Entry
                      </button>

                      <button
                        id="open-import-excel-modal"
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 font-bold text-xs rounded-lg transition-all flex items-center gap-2 shrink-0 shadow"
                        title="Import IPs from Excel or CSV file"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                        Import Excel / CSV
                      </button>
                    </div>

                    {/* Filter bar */}
                    <div className="md:w-64 relative shrink-0">
                      <input
                        id="search-entry-input"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search entries inside file..."
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  {/* Clean List Table */}
                  <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    
                    {/* Header line count */}
                    <div className="bg-slate-900/40 px-4 py-2.5 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                      <span>Showing <strong className="text-white font-mono">{filteredEntries.length}</strong> of <strong className="text-white font-mono">{structuredEntries.length}</strong> active entries</span>
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-slate-900 max-h-[400px] overflow-y-auto">
                      {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 bg-slate-950 text-slate-500">
                          <Search className="h-8 w-8 text-slate-600 animate-pulse" />
                          <p className="text-xs">No matching entries found inside the file.</p>
                        </div>
                      ) : (
                        filteredEntries.map((line, idx) => {
                          const iconColor = isIPFile 
                            ? 'text-red-400/80 bg-red-500/5' 
                            : isDomainFile 
                            ? 'text-amber-400/80 bg-amber-500/5' 
                            : 'text-indigo-400/80 bg-indigo-500/5';

                          return (
                            <div 
                              key={line.id} 
                              className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[10px] text-slate-600 font-mono w-8 text-right shrink-0">
                                  {idx + 1}
                                </span>
                                
                                {isIPFile && (
                                  <div className={`h-6 w-6 rounded flex items-center justify-center font-mono text-[9px] shrink-0 font-bold ${iconColor}`}>
                                    IP
                                  </div>
                                )}
                                {isDomainFile && (
                                  <div className={`h-6 w-6 rounded flex items-center justify-center font-mono text-[9px] shrink-0 font-bold ${iconColor}`}>
                                    DOM
                                  </div>
                                )}
                                {isURLFile && (
                                  <div className={`h-6 w-6 rounded flex items-center justify-center font-mono text-[9px] shrink-0 font-bold ${iconColor}`}>
                                    URL
                                  </div>
                                )}
                                
                                <span className="text-xs font-mono font-semibold text-slate-200 select-all truncate">
                                  {line.trimmed}
                                </span>
                              </div>

                              {/* Action tools */}
                              <div className="flex items-center gap-2">
                                <button
                                  id={`btn-copy-entry-${line.id}`}
                                  onClick={() => handleCopyLine(line.trimmed, line.id)}
                                  className={`p-1.5 rounded border border-transparent transition-colors ${
                                    copiedLine === line.id 
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                                  }`}
                                  title="Copy to clipboard"
                                >
                                  {copiedLine === line.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </button>
                                
                                <button
                                  id={`btn-delete-entry-${line.id}`}
                                  onClick={() => handleDeleteEntry(line.trimmed)}
                                  className="p-1.5 bg-slate-950 hover:bg-red-950/40 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded transition-all"
                                  title="Delete Entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Excel / CSV Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      Import {isDomainFile ? 'Domain' : 'IP'} Repository
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Auto Deduplication
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Import Excel (.xlsx), CSV, or text files and auto-filter duplicate {isDomainFile ? 'domain' : 'IP'} entries
                    </p>
                  </div>
                </div>
                <button
                  id="close-import-modal"
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                {/* Source Selection Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <button
                    id="tab-import-file"
                    onClick={() => setImportSourceType('file')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      importSourceType === 'file'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <UploadCloud className="h-4 w-4" />
                    Upload Excel / CSV File
                  </button>
                  <button
                    id="tab-import-paste"
                    onClick={() => setImportSourceType('paste')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      importSourceType === 'paste'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    Paste Text / Copy-Paste Data
                  </button>
                </div>

                {/* Source Input Area */}
                {importSourceType === 'file' ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 text-center bg-slate-950/40 transition-colors cursor-pointer relative group">
                      <input
                        id="excel-file-input"
                        type="file"
                        accept=".xlsx, .xls, .csv, .txt"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <UploadCloud className="h-10 w-10 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                        <div>
                          <p className="text-sm font-semibold text-slate-200">
                            {importFileName ? importFileName : 'Click or Drag & Drop Excel / CSV file here'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Supports .xlsx, .xls, .csv, or plain text (.txt)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Target Column Selector if file loaded */}
                    {parsedColumns.length > 0 && (
                      <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/60 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-medium text-slate-300">
                            Target {isDomainFile ? 'Domain (e.g. botnetdomain)' : 'IP'} Column:
                          </span>
                        </div>
                        <select
                          id="select-target-column"
                          value={selectedTargetColumn}
                          onChange={(e) => handleTargetColumnChange(e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                        >
                          {parsedColumns.map((col, i) => (
                            <option key={i} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Paste CSV content or line-separated {isDomainFile ? 'domain names' : 'IP addresses'}:
                      </label>
                      <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        Auto-Clean Quotes (&quot;) Active
                      </span>
                    </div>
                    <textarea
                      id="input-paste-ip-text"
                      rows={5}
                      value={rawPasteText}
                      onChange={(e) => handlePasteTextChange(e.target.value)}
                      placeholder={isDomainFile ? `botnetdomain, logsource, action\nnqwjmb.biz, FortiGate600E-AALHO-Main, redirect\niuzpxe.biz, FortiGate600E-AALHO-Main, redirect` : `source.ip, destination.ip, description\n192.168.1.1, 10.0.0.1, Gateway\n10.0.0.15, 10.0.0.2, Host A`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                  </div>
                )}

                {/* Parsing Summary & Statistics */}
                {parsedIPList.length > 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Detected</span>
                        <div className="text-lg font-bold text-slate-100 mt-0.5">{parsedIPList.length}</div>
                      </div>
                      <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl text-center flex flex-col items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">New Unique</span>
                          <div className="text-lg font-bold text-emerald-300 mt-0.5">
                            {parsedIPList.filter(i => i.status === 'new').length}
                          </div>
                        </div>
                        {parsedIPList.filter(i => i.status === 'new').length > 0 && (
                          <button
                            id="btn-copy-card-formatted-output"
                            onClick={handleCopyFormattedOutput}
                            className="mt-1 px-2 py-0.5 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/30 rounded-md font-semibold transition-all inline-flex items-center gap-1 shadow"
                            title="Copy formatted metadata text"
                          >
                            {copiedFormattedOutput ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy Output
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">File Duplicates</span>
                        <div className="text-lg font-bold text-amber-300 mt-0.5">
                          {parsedIPList.filter(i => i.status === 'duplicate_in_file').length}
                        </div>
                      </div>
                      <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">In Repository</span>
                        <div className="text-lg font-bold text-purple-300 mt-0.5">
                          {parsedIPList.filter(i => i.status === 'already_in_repo').length}
                        </div>
                      </div>
                    </div>

                    {/* Formatted Output Action / Toggle Bar */}
                    <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Copy className="h-4 w-4 text-emerald-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-200">Copy New Unique Formatted Metadata</p>
                          <p className="text-[11px] text-slate-400">Extracts metadata columns from Excel / CSV</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          id="btn-toggle-formatted-preview"
                          onClick={() => setShowFormattedOutputPreview(!showFormattedOutputPreview)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all"
                        >
                          {showFormattedOutputPreview ? 'Hide Preview' : 'Preview Format'}
                        </button>
                        <button
                          id="btn-copy-formatted-banner"
                          onClick={handleCopyFormattedOutput}
                          disabled={parsedIPList.filter(i => i.status === 'new').length === 0}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow"
                        >
                          {copiedFormattedOutput ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              Copied Format!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy Formatted Output
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Formatted Textarea Preview */}
                    {showFormattedOutputPreview && (
                      <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <Copy className="h-3.5 w-3.5" /> Formatted Text Output (Extracted from Excel)
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {parsedIPList.filter(i => i.status === 'new').length} New Unique Entries
                          </span>
                        </div>
                        <textarea
                          readOnly
                          rows={10}
                          value={formattedNewUniqueOutput}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-emerald-300 font-mono focus:outline-none resize-none custom-scrollbar"
                        />
                      </div>
                    )}

                    {/* Filter Mode Filter Tabs */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          id="btn-filter-import-all"
                          onClick={() => setImportFilterMode('all')}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                            importFilterMode === 'all'
                              ? 'bg-slate-800 text-slate-100 shadow'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          All ({parsedIPList.length})
                        </button>
                        <button
                          id="btn-filter-import-new"
                          onClick={() => setImportFilterMode('new_only')}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                            importFilterMode === 'new_only'
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow'
                              : 'text-slate-400 hover:text-emerald-300'
                          }`}
                        >
                          New Only ({parsedIPList.filter(i => i.status === 'new').length})
                        </button>
                        <button
                          id="btn-filter-import-duplicates"
                          onClick={() => setImportFilterMode('duplicates_only')}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                            importFilterMode === 'duplicates_only'
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow'
                              : 'text-slate-400 hover:text-amber-300'
                          }`}
                        >
                          Duplicates ({parsedIPList.filter(i => i.status !== 'new').length})
                        </button>
                      </div>

                      <span className="text-[11px] text-slate-400">
                        Showing preview of extracted {isDomainFile ? 'domains' : 'IPs'}
                      </span>
                    </div>

                    {/* Preview Table */}
                    <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase text-slate-400 font-bold sticky top-0">
                            <th className="py-2 px-3 w-16">Row</th>
                            <th className="py-2 px-3">{isDomainFile ? 'Domain Name' : 'IP Address'}</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                          {parsedIPList
                            .filter(item => {
                              if (importFilterMode === 'new_only') return item.status === 'new';
                              if (importFilterMode === 'duplicates_only') return item.status !== 'new';
                              return true;
                            })
                            .slice(0, 100)
                            .map((item, index) => (
                              <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-2 px-3 text-slate-400">{item.originalRow}</td>
                                <td className="py-2 px-3 font-semibold text-slate-200">{item.ip}</td>
                                <td className="py-2 px-3 font-sans">
                                  {item.status === 'new' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <CheckCircle2 className="h-3 w-3" /> New
                                    </span>
                                  )}
                                  {item.status === 'duplicate_in_file' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Duplicate in File
                                    </span>
                                  )}
                                  {item.status === 'already_in_repo' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                      Already in Repository
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-sans text-[11px] text-slate-400">
                                  {item.status === 'new' ? (
                                    <span className="text-emerald-400 font-medium">Will Import</span>
                                  ) : (
                                    <span className="text-slate-400 line-through">Filtered Out</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-400">
                  {parsedIPList.filter(i => i.status === 'new').length > 0 ? (
                    <span className="text-emerald-400 font-medium">
                      {parsedIPList.filter(i => i.status === 'new').length} unique {isDomainFile ? 'domains' : 'IPs'} ready to append to repository
                    </span>
                  ) : (
                    `Select or paste data containing ${isDomainFile ? 'domain names' : 'IP addresses'}`
                  )}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    id="btn-cancel-import"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-confirm-import-ips"
                    onClick={handleConfirmImport}
                    disabled={parsedIPList.filter(i => i.status === 'new').length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2"
                  >
                    <FileCheck className="h-4 w-4" />
                    Import {parsedIPList.filter(i => i.status === 'new').length} New {isDomainFile ? 'Domains' : 'IPs'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GitHub Integration & Auto-Sync Modal */}
      <AnimatePresence>
        {showGithubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                    <Github className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      GitHub Integration & Auto-Sync
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        REST API Sync
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Sync repository blacklists directly with your remote GitHub repository
                    </p>
                  </div>
                </div>
                <button
                  id="close-github-modal"
                  onClick={() => setShowGithubModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {/* Status Message if any */}
                {githubSyncStatus.message && (
                  <div className={`p-3 rounded-xl border flex flex-col gap-2 text-xs ${
                    githubSyncStatus.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : githubSyncStatus.type === 'error'
                      ? 'bg-red-950/40 border-red-500/40 text-red-300'
                      : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {githubSyncStatus.loading ? (
                        <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      ) : githubSyncStatus.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                      )}
                      <span className="font-medium flex-1">{githubSyncStatus.message}</span>
                    </div>

                    {/* Troubleshooting advice for 403 / PAT permission error */}
                    {githubSyncStatus.type === 'error' && (
                      <div className="mt-1 pt-2 border-t border-red-500/20 text-[11px] text-red-200/90 space-y-1 bg-red-950/50 p-2.5 rounded-lg">
                        <p className="font-bold text-red-300">Cara Memperbaiki Error Ini:</p>
                        <ol className="list-decimal list-inside space-y-1 text-[10px] opacity-90">
                          <li>Klik tombol <span className="font-semibold underline">"Generate PAT (Classic)"</span> di bawah.</li>
                          <li>Pastikan centang checkbox <code className="bg-red-900/50 px-1 py-0.5 rounded text-white font-mono">repo</code> (Full control of private repositories).</li>
                          <li>Jika memakai <i>Fine-grained token</i>, buka Settings -&gt; Developer Settings -&gt; Personal Access Tokens -&gt; Fine-grained tokens -&gt; Pilih Repo <code className="bg-red-900/50 px-1 py-0.5 rounded text-white font-mono">{githubRepo || 'neotechspotify/Web-Parsing-NCI'}</code> -&gt; Set <b>Repository permissions: Contents</b> menjadi <b>Read and write</b>.</li>
                          <li>Salin token baru (<code className="font-mono">ghp_...</code> atau <code className="font-mono">github_pat_...</code>) dan tempel ke field di bawah.</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {/* PAT Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                      GitHub Personal Access Token (PAT):
                    </label>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo&description=Web-Parsing-NCI-Sync"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      Generate PAT <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <input
                    id="input-github-pat"
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Token is stored locally in your browser. Needs <code className="text-slate-300 font-mono">repo</code> permissions.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Repo Name */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-300">
                      GitHub Repository (owner/repo):
                    </label>
                    <input
                      id="input-github-repo"
                      type="text"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="neotechspotify/Web-Parsing-NCI"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Branch */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-300">
                      Target Branch:
                    </label>
                    <input
                      id="input-github-branch"
                      type="text"
                      value={githubBranch}
                      onChange={(e) => setGithubBranch(e.target.value)}
                      placeholder="main"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* File Path */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">
                    File Path in GitHub Repo:
                  </label>
                  <input
                    id="input-github-filepath"
                    type="text"
                    value={githubFilePath}
                    onChange={(e) => setGithubFilePath(e.target.value)}
                    placeholder="database/medika/blacklists/List-IP-Blacklist.txt"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Path where <span className="text-indigo-300 font-mono">{selectedFilename}</span> will be committed in your repository.
                  </p>
                </div>

                {/* Auto-Commit Toggle */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-200 block">Auto-Sync to GitHub on Save / Import</span>
                    <span className="text-[11px] text-slate-400 block">
                      Automatically push commits to GitHub whenever you add, import Excel, or edit raw files in Web UI.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                    <input
                      id="toggle-github-autosync"
                      type="checkbox"
                      checked={githubAutoSync}
                      onChange={(e) => setGithubAutoSync(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Direct Action Buttons */}
                <div className="pt-2 grid grid-cols-2 gap-3">
                  <button
                    id="btn-manual-pull-github"
                    onClick={pullFromGitHub}
                    disabled={githubSyncStatus.loading || !githubToken}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <CloudDownload className="h-4 w-4 text-indigo-400" />
                    Pull Latest from GitHub
                  </button>

                  <button
                    id="btn-manual-push-github"
                    onClick={() => commitToGitHub()}
                    disabled={githubSyncStatus.loading || !githubToken}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow"
                  >
                    <CloudUpload className="h-4 w-4 text-white" />
                    Commit & Push to GitHub Now
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400">
                  {githubSyncStatus.lastSyncTime ? `Last sync at ${githubSyncStatus.lastSyncTime}` : 'Configured settings save automatically'}
                </span>

                <button
                  id="btn-save-github-config"
                  onClick={() => {
                    saveGithubSettings(githubToken, githubRepo, githubBranch, githubFilePath, githubAutoSync);
                    setShowGithubModal(false);
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  id="close-admin-pin-modal"
                  onClick={() => {
                    setShowAdminPinModal(false);
                    setAdminPinError('');
                    setAdminPinInput('');
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
                    3 Menu GitHub & Export Dibatasi
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Menu <b className="text-slate-200">Download .txt</b>, <b className="text-slate-200">GitHub Sync</b>, dan <b className="text-slate-200">Push to GitHub</b> hanya dapat diakses oleh Admin untuk keamanan repositori.
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
                    id="input-admin-pin"
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
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1.5"
                  >
                    <Unlock className="h-3.5 w-3.5 text-indigo-200" />
                    Unlock Mode Admin
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
