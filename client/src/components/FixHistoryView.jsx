import React, { useState, useEffect } from 'react';
import { History, CheckCircle, RotateCcw, AlertCircle, ChevronDown, ChevronUp, FileCode } from 'lucide-react';
import DiffViewer from './DiffViewer.jsx';

export default function FixHistoryView({ onRevertFix }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [revertingId, setRevertingId] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRevert = async (checkpointId) => {
    if (!confirm('Are you sure you want to revert this fix? This will restore files to their pre-fix checkpoint.')) {
      return;
    }
    setRevertingId(checkpointId);
    try {
      await onRevertFix(checkpointId);
      await fetchHistory();
    } finally {
      setRevertingId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-dark-900 border border-slate-800 rounded-xl p-5">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <span>Fix History & Checkpoint Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Every applied patch is secured with an automatic Git snapshot checkpoint allowing instant one-click rollback.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading fix history...</div>
      ) : history.length === 0 ? (
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
          <History className="w-10 h-10 text-slate-700 mx-auto mb-2" />
          <p className="text-sm font-medium">No previous fixes recorded yet.</p>
          <p className="text-xs text-slate-600 mt-1">Fixes applied by the agent will be cataloged here with verification records.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => {
            const isExpanded = expandedId === item.id;
            const isReverting = revertingId === item.checkpointId;

            return (
              <div
                key={item.id}
                className="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden transition-all"
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-200">{item.file}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-medium">
                          {item.appliedVia}
                        </span>
                        <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-900/40 px-2 py-0.5 rounded font-medium">
                          ✔ Verified Passed
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 font-mono">
                        <span>Checkpoint: {item.checkpointId}</span>
                        <span>•</span>
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRevert(item.checkpointId)}
                      disabled={isReverting}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-900/40 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isReverting ? 'Reverting...' : 'Revert Fix'}</span>
                    </button>

                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Diff Preview */}
                {isExpanded && (
                  <div className="border-t border-slate-800 p-4 bg-dark-950/60">
                    <DiffViewer patchText={item.diff} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
