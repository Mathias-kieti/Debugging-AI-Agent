import React from 'react';

export default function DiffViewer({ patchText }) {
  if (!patchText) {
    return <div class="text-slate-500 italic p-4 text-center">No diff available.</div>;
  }

  const lines = patchText.split('\n');

  return (
    <div className="bg-dark-900 border border-slate-800 rounded-lg overflow-x-auto text-xs font-mono">
      <div className="bg-dark-850 px-4 py-2 border-b border-slate-800 flex justify-between items-center text-slate-400">
        <span className="font-semibold text-slate-300">Unified Diff Preview</span>
        <span className="text-[11px] text-slate-500">Green = Added, Red = Removed</span>
      </div>
      <div className="p-2 space-y-0.5 leading-relaxed">
        {lines.map((line, idx) => {
          let lineClass = 'text-slate-300 hover:bg-slate-800/40 px-2 py-0.5 rounded';
          let indicator = ' ';

          if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass = 'text-slate-400 font-semibold px-2 py-0.5';
          } else if (line.startsWith('@@')) {
            lineClass = 'bg-blue-950/40 text-blue-400 font-semibold px-2 py-1 my-1 rounded border-y border-blue-900/40';
          } else if (line.startsWith('+')) {
            lineClass = 'bg-emerald-950/40 text-emerald-300 px-2 py-0.5 rounded border-l-2 border-emerald-500 font-medium';
            indicator = '+';
          } else if (line.startsWith('-')) {
            lineClass = 'bg-rose-950/40 text-rose-300 px-2 py-0.5 rounded border-l-2 border-rose-500 line-through opacity-80';
            indicator = '-';
          }

          return (
            <div key={idx} className={`${lineClass} whitespace-pre font-mono flex items-start gap-2`}>
              <span className="w-8 select-none text-slate-600 text-right pr-2">{idx + 1}</span>
              <span className="flex-1 overflow-x-auto">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
