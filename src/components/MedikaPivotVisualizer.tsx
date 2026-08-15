import React, { useState } from 'react';
import { Table, Copy, Check, ShieldAlert, Sparkles, FileText, Image as ImageIcon } from 'lucide-react';

interface MedikaPivotProps {
  pivotData?: {
    rows: { ip: string; count: number }[];
    grandTotal: number;
  };
  sectionBText?: string;
}

export const MedikaPivotVisualizer: React.FC<MedikaPivotProps> = ({ pivotData, sectionBText }) => {
  const [copiedPivot, setCopiedPivot] = useState(false);
  const [copiedSectionB, setCopiedSectionB] = useState(false);
  const [editableSectionB, setEditableSectionB] = useState(sectionBText || '');

  const copyPivotToClipboard = () => {
    if (!pivotData) return;
    let text = "Row Labels\tCount of IP DESTINATION\n";
    for (const r of pivotData.rows) {
      text += `${r.ip}\t${r.count}\n`;
    }
    text += `Grand Total\t${pivotData.grandTotal}`;
    navigator.clipboard.writeText(text);
    setCopiedPivot(true);
    setTimeout(() => setCopiedPivot(false), 2000);
  };

  const copySectionBToClipboard = () => {
    const textToCopy = editableSectionB.trim() ? editableSectionB : (sectionBText || '');
    navigator.clipboard.writeText(textToCopy);
    setCopiedSectionB(true);
    setTimeout(() => setCopiedSectionB(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Pivot Table IP Destination (Image 1 Format) */}
      {pivotData && pivotData.rows.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Table className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Pivot Table IP Destination (Hasil Log Activity Raw)
              </h3>
            </div>
            <button
              onClick={copyPivotToClipboard}
              className="py-1 px-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-lg text-[10px] font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedPivot ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  Pivot Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-indigo-400" />
                  Copy Pivot Table
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-slate-900/90 text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 text-slate-300">Row Labels</th>
                  <th className="py-2.5 px-4 text-emerald-400 text-right">Count of IP DESTINATION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {pivotData.rows.map((row) => (
                  <tr key={row.ip} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2 px-4 font-medium text-slate-200">{row.ip}</td>
                    <td className="py-2 px-4 text-right font-bold text-emerald-300">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 font-bold border-t-2 border-slate-700 text-white">
                <tr>
                  <td className="py-2.5 px-4">Grand Total</td>
                  <td className="py-2.5 px-4 text-right text-emerald-400">{pivotData.grandTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Section B: Destination IP & Port Detected (Image 2 OCR Format) */}
      {(sectionBText || editableSectionB) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <span>B. Destination IP & Port Detected</span>
                <span className="text-[10px] normal-case bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full flex items-center gap-1 font-sans">
                  <Sparkles className="h-2.5 w-2.5" /> AI Gemini Vision OCR
                </span>
              </h3>
            </div>
            <button
              onClick={copySectionBToClipboard}
              className="py-1 px-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-lg text-[10px] font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedSectionB ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  Section B Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-indigo-400" />
                  Copy Section B
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] text-slate-400">Hasil Pembacaan Dashboard SIEM (Bagian B):</label>
            <textarea
              value={editableSectionB}
              onChange={(e) => setEditableSectionB(e.target.value)}
              rows={12}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              placeholder="Hasil OCR Bagian B akan muncul di sini..."
            />
          </div>
        </div>
      )}
    </div>
  );
};
