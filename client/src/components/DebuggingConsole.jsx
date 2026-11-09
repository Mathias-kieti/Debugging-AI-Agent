import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ArrowRight, ShieldCheck, Terminal, Cpu, Sparkles, RefreshCw } from 'lucide-react';
import DiffViewer from './DiffViewer.jsx';

export default function DebuggingConsole({
  agentState,
  investigation,
  pendingFix,
  onApproveFix,
  onRejectFix,
  onRunDebugger,
  onSelectFile
}) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApproveFix();
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await onRejectFix();
    } finally {
      setRejecting(false);
    }
  };

  const rca = investigation?.rca;
  const error = investigation?.error;

  return (
    <div className="space-y-6">
      {/* Top Banner / Status Overview */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl flex items-center justify-center ${
            agentState === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            agentState === 'WAITING_APPROVAL' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
            agentState === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {agentState === 'RESOLVED' ? <CheckCircle className="w-6 h-6" /> :
             agentState === 'WAITING_APPROVAL' ? <AlertTriangle className="w-6 h-6" /> :
             agentState === 'FAILED' ? <XCircle className="w-6 h-6" /> :
             <Cpu className="w-6 h-6 animate-spin" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">
                {agentState === 'WAITING_APPROVAL' ? 'Fix Synthesized — Awaiting Authorization' :
                 agentState === 'RESOLVED' ? 'Codebase Clean & Verified' :
                 agentState === 'FAILED' ? 'Investigation Alert' :
                 `Agent Phase: ${agentState}`}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                agentState === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' :
                agentState === 'WAITING_APPROVAL' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {agentState}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              {agentState === 'WAITING_APPROVAL'
                ? 'The agent has deduced the root cause, validated syntax, and prepared a minimal patch. Review before applying.'
                : agentState === 'RESOLVED'
                ? 'All unit tests and static checks passed. Fix has been verified with zero regressions.'
                : 'Click "Run Autonomous Debugger" to scan, detect, and resolve issues.'}
            </p>
          </div>
        </div>

        <button
          onClick={onRunDebugger}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg shadow-md transition-all active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Run Debugger</span>
        </button>
      </div>

      {/* Main Investigation & Fix Panel */}
      {rca && (
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Root Cause Breakdown */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            {/* Error Identification Card */}
            <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Detected Error</span>
              </div>
              <div className="bg-rose-950/30 border border-rose-900/40 rounded-lg p-3">
                <div className="font-mono text-rose-300 font-bold text-xs">
                  {rca.errorClass}: {rca.rawMessage}
                </div>
                {rca.culpritFile && (
                  <button
                    onClick={() => onSelectFile && onSelectFile(rca.culpritFile, rca.culpritLine)}
                    className="mt-2 text-left text-[11px] text-slate-400 hover:text-blue-400 flex items-center gap-1 font-mono transition-colors"
                  >
                    <span>Origin:</span>
                    <span className="text-blue-400 underline">{rca.culpritFile}:{rca.culpritLine}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Root Cause Analysis (RCA) Card */}
            <div className="bg-dark-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs tracking-wider uppercase">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Root Cause Analysis</span>
                </div>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                  {Math.round(rca.confidence * 100)}% Confidence
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Observed Symptom
                </span>
                <p className="text-xs text-slate-300 bg-dark-850 p-2.5 rounded-lg border border-slate-800">
                  {rca.symptom}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-rose-400/90 uppercase tracking-wider block mb-1">
                  Actual Root Cause
                </span>
                <p className="text-xs text-rose-200 bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/30">
                  {rca.rootCause}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Architectural Explanation
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {rca.explanation}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-emerald-400/90 uppercase tracking-wider block mb-1">
                  Recommended Fix Strategy
                </span>
                <p className="text-xs text-emerald-300 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30">
                  {rca.fixStrategy}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Code Patch & Approval Action */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            {pendingFix ? (
              <div className="bg-dark-900 border border-slate-800 rounded-xl p-5 flex flex-col space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      Proposed Code Modification
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target: <span className="font-mono text-blue-400">{pendingFix.file}</span>
                      <span className="ml-2 text-slate-500">via {pendingFix.appliedVia}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 text-xs font-medium">Syntax Pre-Validated</span>
                  </div>
                </div>

                <div className="bg-dark-850 p-3 rounded-lg border border-slate-800 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Fix Rationale: </span>
                  {pendingFix.description}
                </div>

                {/* Diff Viewer Component */}
                <DiffViewer patchText={pendingFix.patch} />

                {/* Approval Action Bar */}
                {agentState === 'WAITING_APPROVAL' && (
                  <div className="bg-dark-850 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                      <p className="font-medium text-slate-200">User Authorization Required</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        A Git checkpoint will be generated before modification for instant rollback.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleReject}
                        disabled={rejecting || approving}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-700 rounded-lg transition-all"
                      >
                        {rejecting ? 'Rejecting...' : 'Reject Fix'}
                      </button>

                      <button
                        onClick={handleApprove}
                        disabled={approving || rejecting}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md transition-all active:scale-95"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{approving ? 'Applying & Verifying...' : 'Approve & Apply Fix'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-dark-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 min-h-[300px]">
                <Cpu className="w-10 h-10 text-slate-700 mb-2" />
                <p className="text-sm font-medium">No active fix proposal pending.</p>
                <p className="text-xs text-slate-600 mt-1">Run the debugger to investigate issues.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!rca && (
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <Terminal className="w-12 h-12 text-blue-500/50 mb-3" />
          <h3 className="text-base font-bold text-slate-200">No Active Debugging Investigation</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-5">
            DevDebugger AI can analyze the connected project, detect runtime or syntax bugs, investigate the root cause, and formulate a targeted patch.
          </p>
          <button
            onClick={onRunDebugger}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Start Investigation Now</span>
          </button>
        </div>
      )}
    </div>
  );
}
