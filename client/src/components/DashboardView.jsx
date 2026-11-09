import React, { useState } from 'react';
import { Bug, CheckCircle, AlertCircle, Clock, ShieldCheck, FolderGit2, Play, Cpu, ArrowRight } from 'lucide-react';

export default function DashboardView({
  status,
  projectScan,
  onRunDebugger,
  onConnectProject,
  onToggleMode
}) {
  const [customPath, setCustomPath] = useState('');

  const languages = projectScan?.languages || {};
  const totalBugs = (status.currentInvestigation ? 1 : 0) + (status.historyCount || 0);
  const resolvedBugs = status.historyCount || 0;
  const pendingBugs = status.pendingFixProposal ? 1 : 0;
  const criticalBugs = status.currentInvestigation ? 1 : 0;

  return (
    <div className="space-y-6">
      {/* Top Project Selector Card */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Connected Codebase
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold text-slate-200">
                {status.projectRoot || 'No Project Connected'}
              </h2>
              {projectScan?.primaryLanguage && (
                <span className="bg-slate-800 text-blue-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {projectScan.primaryLanguage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Sample Selector & Mode Switcher */}
        <div className="flex items-center gap-3">
          <div className="bg-dark-850 border border-slate-800 p-1 rounded-lg flex items-center gap-1 text-xs">
            <button
              onClick={() => onToggleMode('assisted')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                status.mode === 'assisted'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Assisted Mode
            </button>
            <button
              onClick={() => onToggleMode('autonomous')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                status.mode === 'autonomous'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Autonomous Mode
            </button>
          </div>

          <button
            onClick={onRunDebugger}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg shadow-md transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Run Debugger</span>
          </button>
        </div>
      </div>

      {/* Quick Switch Preset Buttons */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium">Quick switch to test projects:</span>
        <button
          onClick={() => onConnectProject('sample-projects/buggy-python')}
          className="bg-dark-850 hover:bg-dark-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-md text-xs font-mono transition-colors"
        >
          🐍 Buggy Python Project
        </button>
        <button
          onClick={() => onConnectProject('sample-projects/buggy-javascript')}
          className="bg-dark-850 hover:bg-dark-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-md text-xs font-mono transition-colors"
        >
          ⚡ Buggy JavaScript Project
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Bugs Handled</span>
            <Bug className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2">{totalBugs}</div>
          <span className="text-[11px] text-slate-500">Scan & test detections</span>
        </div>

        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Critical Errors</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">{criticalBugs}</div>
          <span className="text-[11px] text-slate-500">Require immediate fix</span>
        </div>

        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Resolved & Verified</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{resolvedBugs}</div>
          <span className="text-[11px] text-slate-500">Passing 100% tests</span>
        </div>

        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Authorization</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{pendingBugs}</div>
          <span className="text-[11px] text-slate-500">Assisted mode gate</span>
        </div>
      </div>

      {/* Language Breakdown & Framework Details */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6 bg-dark-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Language Composition
          </h3>
          <div className="space-y-3">
            {Object.entries(languages).map(([lang, count]) => (
              <div key={lang} className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{lang}</span>
                  <span className="font-mono text-slate-500">{count} files</span>
                </div>
                <div className="w-full bg-dark-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((count / (projectScan?.totalFiles || 1)) * 100))}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-6 bg-dark-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Autonomous Agent Security & Guardrails
          </h3>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-dark-850 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Path Jail: Writes restricted strictly to project root</span>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-dark-850 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Allowlisted Binaries: node, npm, python3, pytest, git</span>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-dark-850 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Zero Data Loss: Pre-modification Git checkpoint snapshot</span>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-dark-850 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Secret Redaction: API tokens and credentials masked in logs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
