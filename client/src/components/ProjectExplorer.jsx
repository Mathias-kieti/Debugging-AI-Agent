import React, { useState, useEffect } from 'react';
import { File, Folder, FolderOpen, Code, AlertCircle, Layers } from 'lucide-react';

export default function ProjectExplorer({ projectScan, highlightedFile, highlightedLine }) {
  const [selectedFile, setSelectedFile] = useState(highlightedFile || null);
  const [fileDetails, setFileDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (highlightedFile) {
      loadFile(highlightedFile);
    } else if (projectScan?.files?.[0]) {
      loadFile(projectScan.files[0].path);
    }
  }, [highlightedFile, projectScan]);

  const loadFile = async (filePath) => {
    setSelectedFile(filePath);
    setLoading(true);
    try {
      const res = await fetch(`/api/project/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setFileDetails(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderTree = (node, depth = 0) => {
    if (!node) return null;

    if (node.type === 'file') {
      const isSelected = selectedFile === node.path;
      const isProblematic = highlightedFile === node.path;

      return (
        <button
          key={node.path}
          onClick={() => loadFile(node.path)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left rounded transition-colors ${
            isSelected
              ? 'bg-blue-600/20 text-blue-400 font-medium'
              : 'text-slate-400 hover:bg-dark-800 hover:text-slate-200'
          }`}
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          <File className={`w-3.5 h-3.5 flex-shrink-0 ${isProblematic ? 'text-rose-400' : 'text-slate-500'}`} />
          <span className="truncate">{node.name}</span>
          {isProblematic && (
            <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
      );
    }

    return (
      <div key={node.name} className="space-y-0.5">
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 font-medium select-none"
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
        <div>
          {node.children && node.children.map((child) => renderTree(child, depth + 1))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-160px)]">
      {/* File Tree Panel */}
      <div className="col-span-3 bg-dark-900 border border-slate-800 rounded-xl p-3 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-2 pb-3 mb-2 border-b border-slate-800 text-slate-300 font-semibold text-xs tracking-wider uppercase">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Project Hierarchy</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {projectScan?.tree ? renderTree(projectScan.tree) : (
            <div className="text-slate-500 text-xs p-4 italic">No project loaded</div>
          )}
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="col-span-9 bg-dark-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        {selectedFile && fileDetails ? (
          <>
            <div className="bg-dark-850 px-4 py-2.5 border-b border-slate-800 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-slate-200">{selectedFile}</span>
                <span className="text-slate-500">({fileDetails.lineCount} lines)</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-400 font-medium">
                  {fileDetails.language}
                </span>
              </div>
              {fileDetails.functions?.length > 0 && (
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <span>{fileDetails.functions.length} functions</span>
                  <span>•</span>
                  <span>{fileDetails.classes?.length || 0} classes</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4 bg-dark-950 font-mono text-xs leading-relaxed">
              {fileDetails.content.split('\n').map((line, idx) => {
                const lineNum = idx + 1;
                const isCulprit = selectedFile === highlightedFile && lineNum === highlightedLine;

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 px-2 py-0.5 rounded ${
                      isCulprit
                        ? 'bg-rose-950/60 border-l-4 border-rose-500 text-rose-200 font-semibold'
                        : 'hover:bg-dark-850/60 text-slate-300'
                    }`}
                  >
                    <span className={`w-10 text-right select-none ${isCulprit ? 'text-rose-400 font-bold' : 'text-slate-600'}`}>
                      {lineNum}
                    </span>
                    <span className="flex-1 whitespace-pre">{line || ' '}</span>
                    {isCulprit && (
                      <span className="bg-rose-500/20 text-rose-400 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">
                        Error Origin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm">
            <Code className="w-8 h-8 text-slate-700 mb-2" />
            <p>Select a file from the explorer to view source code.</p>
          </div>
        )}
      </div>
    </div>
  );
}
