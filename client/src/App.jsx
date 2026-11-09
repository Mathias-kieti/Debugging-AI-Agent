import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderTree,
  Bug,
  History,
  Terminal,
  Cpu,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import DashboardView from './components/DashboardView.jsx';
import ProjectExplorer from './components/ProjectExplorer.jsx';
import DebuggingConsole from './components/DebuggingConsole.jsx';
import FixHistoryView from './components/FixHistoryView.jsx';
import AgentActivityView from './components/AgentActivityView.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [agentStatus, setAgentStatus] = useState({
    state: 'IDLE',
    mode: 'assisted',
    projectRoot: '',
    currentInvestigation: null,
    pendingFixProposal: null,
    historyCount: 0
  });
  const [projectScan, setProjectScan] = useState(null);
  const [logs, setLogs] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [highlightedFile, setHighlightedFile] = useState(null);
  const [highlightedLine, setHighlightedLine] = useState(null);

  // Initialize and WebSocket Connection
  useEffect(() => {
    fetchStatus();
    fetchScan();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setWsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWsEvent(data);
      } catch (e) {
        console.error('WS Parse Error', e);
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
    };

    return () => socket.close();
  }, []);

  const handleWsEvent = (data) => {
    setLogs((prev) => [data, ...prev].slice(0, 300));

    if (data.event === 'STATE_CHANGE') {
      setAgentStatus((prev) => ({ ...prev, state: data.payload.state }));
      if (data.payload.state === 'WAITING_APPROVAL' || data.payload.state === 'RESOLVED') {
        fetchStatus();
        fetchScan();
      }
    } else if (data.event === 'FIX_PROPOSED') {
      setAgentStatus((prev) => ({ ...prev, pendingFixProposal: data.payload }));
    } else if (data.event === 'RCA_COMPLETED') {
      setAgentStatus((prev) => ({
        ...prev,
        currentInvestigation: { error: data.payload, rca: data.payload }
      }));
      setHighlightedFile(data.payload.culpritFile);
      setHighlightedLine(data.payload.culpritLine);
    } else if (data.event === 'INIT_STATE') {
      setAgentStatus(data.payload);
      if (data.payload.currentInvestigation?.rca) {
        setHighlightedFile(data.payload.currentInvestigation.rca.culpritFile);
        setHighlightedLine(data.payload.currentInvestigation.rca.culpritLine);
      }
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setAgentStatus(data);
      if (data.currentInvestigation?.rca) {
        setHighlightedFile(data.currentInvestigation.rca.culpritFile);
        setHighlightedLine(data.currentInvestigation.rca.culpritLine);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchScan = async () => {
    try {
      const res = await fetch('/api/project/scan');
      const data = await res.json();
      setProjectScan(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunDebugger = async () => {
    setActiveTab('console');
    await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: agentStatus.mode })
    });
  };

  const handleConnectProject = async (relPath) => {
    try {
      const res = await fetch('/api/project/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: relPath, mode: agentStatus.mode })
      });
      const data = await res.json();
      if (data.success) {
        setAgentStatus((prev) => ({ ...prev, projectRoot: data.connectedPath }));
        setProjectScan(data.scan);
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMode = async (mode) => {
    await fetch('/api/agent/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    setAgentStatus((prev) => ({ ...prev, mode }));
  };

  const handleApproveFix = async () => {
    const res = await fetch('/api/fix/approve', { method: 'POST' });
    const data = await res.json();
    fetchStatus();
    fetchScan();
    return data;
  };

  const handleRejectFix = async () => {
    await fetch('/api/fix/reject', { method: 'POST' });
    fetchStatus();
  };

  const handleRevertFix = async (checkpointId) => {
    const res = await fetch('/api/fix/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpointId })
    });
    const data = await res.json();
    fetchStatus();
    fetchScan();
    return data;
  };

  const handleRunTerminalCommand = async (command) => {
    const res = await fetch('/api/terminal/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return await res.json();
  };

  const selectFileInExplorer = (file, line) => {
    setHighlightedFile(file);
    setHighlightedLine(line);
    setActiveTab('explorer');
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-dark-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>DevDebugger AI</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-medium">
                v1.0.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Autonomous Code Debugging Agent</p>
          </div>
        </div>

        {/* Status Indicator & Mode Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-dark-850 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="text-slate-400 text-[11px]">
              {wsConnected ? 'Agent Live' : 'Connecting...'}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-dark-850 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400 text-[11px]">State:</span>
            <span className="font-semibold text-slate-200">{agentStatus.state}</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="bg-dark-900/60 border-b border-slate-800 px-6">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'explorer'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Project Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'console'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bug className="w-4 h-4" />
            <span>Debugging Console</span>
            {agentStatus.pendingFixProposal && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Fix History</span>
            {agentStatus.historyCount > 0 && (
              <span className="bg-dark-800 text-slate-300 px-1.5 py-0.5 rounded-full text-[10px]">
                {agentStatus.historyCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Agent Activity & Terminal</span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <DashboardView
            status={agentStatus}
            projectScan={projectScan}
            onRunDebugger={handleRunDebugger}
            onConnectProject={handleConnectProject}
            onToggleMode={handleToggleMode}
          />
        )}

        {activeTab === 'explorer' && (
          <ProjectExplorer
            projectScan={projectScan}
            highlightedFile={highlightedFile}
            highlightedLine={highlightedLine}
          />
        )}

        {activeTab === 'console' && (
          <DebuggingConsole
            agentState={agentStatus.state}
            investigation={agentStatus.currentInvestigation}
            pendingFix={agentStatus.pendingFixProposal}
            onApproveFix={handleApproveFix}
            onRejectFix={handleRejectFix}
            onRunDebugger={handleRunDebugger}
            onSelectFile={selectFileInExplorer}
          />
        )}

        {activeTab === 'history' && (
          <FixHistoryView onRevertFix={handleRevertFix} />
        )}

        {activeTab === 'activity' && (
          <AgentActivityView logs={logs} onRunCommand={handleRunTerminalCommand} />
        )}
      </main>
    </div>
  );
}
