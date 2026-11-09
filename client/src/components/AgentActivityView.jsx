import React, { useState } from 'react';
import { Terminal, Play, Cpu, CheckCircle2, AlertOctagon } from 'lucide-react';

export default function AgentActivityView({ logs, onRunCommand }) {
  const [cmdInput, setCmdInput] = useState('');
  const [running, setRunning] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;

    setRunning(true);
    try {
      await onRunCommand(cmdInput.trim());
      setCmdInput('');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Agent Activity Feed */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800 text-slate-200 font-semibold text-xs tracking-wider uppercase">
          <Cpu className="w-4 h-4 text-blue-400" />
          <span>Real-time Agent Decision Stream</span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-xs py-4 italic text-center">
              Agent idle. Activity events will appear here during execution.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2 rounded-lg bg-dark-850 border border-slate-800/60 text-xs"
              >
                <span className="text-[10px] font-mono text-slate-500 pt-0.5 select-none">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="bg-blue-950/60 text-blue-400 font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                  {log.event || log.type}
                </span>
                <span className="flex-1 text-slate-300 font-mono text-[11px]">
                  {log.payload?.step || log.payload?.message || log.payload?.reason || JSON.stringify(log.payload)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Terminal Shell Integration */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="bg-dark-850 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">Integrated Project Terminal</span>
            <span className="text-[11px] text-slate-500">(Allowlisted commands: npm, node, python3, pytest, git)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          </div>
        </div>

        {/* Command Form */}
        <form onSubmit={handleSubmit} className="p-3 bg-dark-950 border-b border-slate-800 flex items-center gap-2">
          <span className="text-emerald-400 font-mono text-xs font-bold pl-2">$</span>
          <input
            type="text"
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder="e.g. python3 -m unittest discover -s . -p test_*.py or npm test"
            className="flex-1 bg-transparent text-slate-200 font-mono text-xs focus:outline-none placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={running || !cmdInput.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-xs px-3 py-1.5 rounded-md transition-all"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>{running ? 'Running...' : 'Execute'}</span>
          </button>
        </form>

        <div className="p-4 bg-dark-950 font-mono text-xs text-slate-400 h-64 overflow-y-auto space-y-1">
          <p className="text-slate-600 italic">Terminal ready. Output streams directly from the sandbox.</p>
          {logs
            .filter((l) => l.event === 'TERMINAL_OUTPUT')
            .map((term, i) => (
              <pre
                key={i}
                className={`whitespace-pre-wrap leading-relaxed ${
                  term.payload?.type === 'stderr' ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                {term.payload?.text}
              </pre>
            ))}
        </div>
      </div>
    </div>
  );
}
