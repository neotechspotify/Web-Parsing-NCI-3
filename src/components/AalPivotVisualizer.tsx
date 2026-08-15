import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  FileSpreadsheet, 
  Table, 
  Info, 
  Copy, 
  Check, 
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface DomainCount {
  domain: string;
  count: number;
}

interface PivotGroup {
  ip: string;
  subtotal: number;
  domains: DomainCount[];
}

interface AalPivotVisualizerProps {
  pivotData: PivotGroup[];
  rawData: any[];
  isDga?: boolean;
}

export default function AalPivotVisualizer({ pivotData, rawData, isDga = false }: AalPivotVisualizerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'pivot' | 'raw' | 'tutorial'>('pivot');
  const [pivotSearch, setPivotSearch] = useState('');
  const [rawSearch, setRawSearch] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Collapse state for each IP row in Pivot view
  const [collapsedIps, setCollapsedIps] = useState<Record<string, boolean>>({});

  const toggleIpCollapse = (ip: string) => {
    setCollapsedIps(prev => ({
      ...prev,
      [ip]: !prev[ip]
    }));
  };

  const toggleAllIps = (collapse: boolean) => {
    const nextState: Record<string, boolean> = {};
    pivotData.forEach(item => {
      nextState[item.ip] = collapse;
    });
    setCollapsedIps(nextState);
  };

  // Filtered pivot data
  const filteredPivot = useMemo(() => {
    if (!pivotSearch.trim()) return pivotData;
    const term = pivotSearch.toLowerCase();
    return pivotData.map(group => {
      if (group.ip.toLowerCase().includes(term)) {
        return group; // Keep entire group if IP matches
      }
      // Otherwise, filter domains
      const filteredDomains = group.domains.filter(d => d.domain.toLowerCase().includes(term));
      if (filteredDomains.length > 0) {
        const subtotal = filteredDomains.reduce((sum, d) => sum + d.count, 0);
        return {
          ...group,
          subtotal,
          domains: filteredDomains
        };
      }
      return null;
    }).filter(Boolean) as PivotGroup[];
  }, [pivotData, pivotSearch]);

  // Grand total for filtered pivot
  const filteredGrandTotal = useMemo(() => {
    return filteredPivot.reduce((sum, group) => sum + group.subtotal, 0);
  }, [filteredPivot]);

  // Filtered raw data
  const filteredRaw = useMemo(() => {
    if (!rawSearch.trim()) return rawData;
    const term = rawSearch.toLowerCase();
    return rawData.filter(row => {
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(term)
      );
    });
  }, [rawData, rawSearch]);

  // Copy pivot table as TSV (Tab Separated Values) for easy pasting to Excel
  const copyPivotAsTsv = () => {
    let tsv = `Row Labels\tCount of ${isDga ? 'url' : 'botnetdomain'}\n`;
    filteredPivot.forEach(group => {
      tsv += `${group.ip}\t${group.subtotal}\n`;
      group.domains.forEach(d => {
        tsv += `\t${d.domain}\t${d.count}\n`;
      });
    });
    tsv += `Grand Total\t${filteredGrandTotal}`;

    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-6 flex flex-col">
      {/* Visualizer Header */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              AAL {isDga ? 'DGA' : 'Botnet'} Live Report Simulation
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">High-fidelity interactive pivot analyzer matching Microsoft Excel outputs</p>
          </div>
        </div>

        {/* Tab Switchers */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 w-fit self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('pivot')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              activeSubTab === 'pivot'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Pivot View
          </button>
          <button
            onClick={() => setActiveSubTab('raw')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              activeSubTab === 'raw'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            Raw Grid
          </button>
          <button
            onClick={() => setActiveSubTab('tutorial')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              activeSubTab === 'tutorial'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="h-3.5 w-3.5 text-blue-400" />
            Excel Tutorial
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="p-6">
        
        {/* PIVOT VIEW TAB */}
        {activeSubTab === 'pivot' && (
          <div className="flex flex-col gap-4">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={`Filter IP or ${isDga ? 'url' : 'botnetdomain'}...`}
                  value={pivotSearch}
                  onChange={(e) => setPivotSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAllIps(false)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-medium text-slate-300 transition-colors"
                >
                  Expand All
                </button>
                <button
                  onClick={() => toggleAllIps(true)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-medium text-slate-300 transition-colors"
                >
                  Collapse All
                </button>
                <button
                  onClick={copyPivotAsTsv}
                  className="px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/40 rounded-lg text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 transition-colors ml-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied TSV!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Excel Pivot Data
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Excel Styled Pivot Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0d131f]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#151f32] text-slate-300 text-xs font-semibold border-b border-slate-800">
                    <th className="py-3 px-4 font-semibold text-slate-100 flex items-center gap-2">
                      <span>Row Labels</span>
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-100 w-1/3">
                      <span>Count of {isDga ? 'url' : 'botnetdomain'}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {filteredPivot.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-slate-500 italic">
                        No matches found. Check your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredPivot.map((group) => {
                      const isCollapsed = collapsedIps[group.ip] || false;
                      return (
                        <React.Fragment key={group.ip}>
                          {/* Parent IP Row */}
                          <tr 
                            onClick={() => toggleIpCollapse(group.ip)}
                            className="border-b border-slate-850 hover:bg-[#1a263d] cursor-pointer transition-colors bg-[#0e1624]"
                          >
                            <td className="py-2.5 px-4 font-bold text-slate-100 flex items-center gap-1.5 select-none">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                              )}
                              <span className="text-emerald-400">📁</span>
                              {group.ip}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-100 font-mono">
                              {group.subtotal}
                            </td>
                          </tr>

                          {/* Children Domain Rows */}
                          {!isCollapsed && group.domains.map((d) => (
                            <tr 
                              key={d.domain}
                              className="border-b border-slate-900 hover:bg-slate-800/40 bg-[#070b12]"
                            >
                              <td className="py-2 px-12 text-slate-300 flex items-center gap-1.5 font-normal">
                                <span className="text-slate-600">↳</span>
                                <span className="text-slate-500">🌐</span>
                                {d.domain}
                              </td>
                              <td className="py-2 px-4 text-right text-slate-300 font-mono">
                                {d.count}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}

                  {/* Grand Total Row */}
                  <tr className="bg-[#111929] text-sm font-bold border-t-2 border-double border-slate-700">
                    <td className="py-3 px-4 text-slate-100 flex items-center gap-2 font-sans font-semibold">
                      <span className="text-yellow-500">🏆</span>
                      Grand Total
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-mono font-bold">
                      {filteredGrandTotal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Live Visual Card Indicator */}
            <div className="bg-emerald-950/15 border border-emerald-800/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-950 border border-emerald-800 rounded-lg text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-emerald-400">Excel Pivot Table Generated Successfully</h4>
                  <p className="text-[10px] text-slate-300 mt-1">The Pivot table is prepared and embedded inside <b>Sheet1</b> in the download package.</p>
                </div>
              </div>
              <div className="text-[10px] text-emerald-500 font-mono font-bold uppercase bg-emerald-950/80 px-2 py-1 rounded border border-emerald-800/40 self-end sm:self-auto">
                {filteredGrandTotal} Total Rows Loaded
              </div>
            </div>
          </div>
        )}

        {/* RAW GRID TAB */}
        {activeSubTab === 'raw' && (
          <div className="flex flex-col gap-4">
            {/* Search and Metadata Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari data mentah (IP, domain, msg, timestamp...)"
                  value={rawSearch}
                  onChange={(e) => setRawSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="text-[10px] text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                Showing <b>{filteredRaw.length}</b> of <b>{rawData.length}</b> rows
              </div>
            </div>

            {/* Excel-like Raw Data Grid */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
                  <thead>
                    <tr className="bg-slate-900 text-slate-300 text-[10px] uppercase font-mono border-b border-slate-800">
                      <th className="p-2 border-r border-slate-850 w-8 text-center text-slate-500">#</th>
                      {rawData.length > 0 && Object.keys(rawData[0]).map((col) => (
                        <th key={col} className="p-2 border-r border-slate-850 text-slate-200 font-semibold">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[10px] font-mono">
                    {filteredRaw.length === 0 ? (
                      <tr>
                        <td colSpan={(rawData.length > 0 ? Object.keys(rawData[0]).length : 0) + 1} className="p-8 text-center text-slate-500 italic">
                          No rows found matching search term.
                        </td>
                      </tr>
                    ) : (
                      filteredRaw.slice(0, 100).map((row, idx) => (
                        <tr 
                          key={idx}
                          className="border-b border-slate-900 hover:bg-slate-900/50 transition-colors odd:bg-slate-950 even:bg-slate-900/20"
                        >
                          <td className="p-2 border-r border-slate-850 text-slate-600 text-center select-none bg-slate-900/10">{idx + 1}</td>
                          {Object.keys(row).map((col) => (
                            <td key={col} className="p-2 border-r border-slate-850 text-slate-300 max-w-xs truncate" title={String(row[col])}>
                              {String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredRaw.length > 100 && (
                <div className="bg-slate-900/40 p-2.5 text-center text-[10px] text-slate-500 border-t border-slate-850 italic">
                  Showing first 100 rows. Download the processed Excel file to view the full <b>{filteredRaw.length}</b> rows dataset.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TUTORIAL TAB */}
        {activeSubTab === 'tutorial' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-indigo-400" />
                Panduan Langkah Pengolahan File di Microsoft Excel (Sesuai Gambar Lampiran)
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Di bawah ini adalah langkah-langkah manual di Microsoft Excel yang telah disimulasikan oleh aplikasi ini secara otomatis. Gunakan file CSV hasil unduhan untuk mengulang langkah ini di Excel lokal Anda:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1 */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex gap-3">
                <div className="h-6 w-6 rounded-full bg-indigo-900 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Load Data dari Text/CSV</h5>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Buka Microsoft Excel, klik tab menu <b>Data</b> di atas ribbon menu, kemudian pilih ikon menu <b>From Text/CSV</b> (seperti yang dilingkari merah pada Gambar 3).
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex gap-3">
                <div className="h-6 w-6 rounded-full bg-indigo-900 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Pilih File & Load Data</h5>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Pilih file CSV yang Anda miliki (contoh: <code>AAL_BOTNETTTT_...csv</code>), klik tombol <b>Import</b> (Gambar 4). Di jendela preview Excel yang muncul, klik tombol <b>Load</b>. Maka data akan dimuat rapi ke sheet baru (Gambar 5).
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex gap-3">
                <div className="h-6 w-6 rounded-full bg-indigo-900 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Buat Pivot Table</h5>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Klik salah satu sel di dalam tabel hasil Load tersebut, buka tab menu <b>Insert</b>, klik ikon <b>PivotTable</b> di ujung kiri (Gambar 6). Pilih opsi <b>New Worksheet</b> pada pop-up dialog, lalu klik <b>OK</b> (Gambar 7).
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex gap-3">
                <div className="h-6 w-6 rounded-full bg-indigo-900 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Atur Struktur Pivot Fields</h5>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Di panel kanan <b>PivotTable Fields</b> (Gambar 8), centang field <code>source.ip</code> dan <code>{isDga ? 'url' : 'botnetdomain'}</code>. Tarik field <code>source.ip</code> ke kolom <b>Rows</b>, letakkan <code>{isDga ? 'url' : 'botnetdomain'}</code> di bawahnya. Terakhir, tarik field <code>{isDga ? 'url' : 'botnetdomain'}</code> ke kolom <b>Values</b> untuk menghitung total baris.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
