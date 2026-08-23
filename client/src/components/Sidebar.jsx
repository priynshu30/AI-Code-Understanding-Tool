import React from 'react';
import { Plus, FolderGit2, Trash2, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react';

export default function Sidebar({
  repos,
  activeRepo,
  onSelectRepo,
  onNewRepo,
  onDeleteRepo,
  loading
}) {
  return (
    <aside className="w-64 border-r border-dark-700 bg-dark-900 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-dark-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Repositories ({repos.length})
        </span>
        <button
          onClick={onNewRepo}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 border border-brand-500/30 text-xs font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Repo List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {repos.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No repositories indexed yet. Enter a GitHub URL to start chatting.
          </div>
        ) : (
          repos.map((repo) => {
            const isActive = activeRepo?._id === repo._id;
            return (
              <div
                key={repo._id}
                onClick={() => onSelectRepo(repo)}
                className={`group relative flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition text-left ${
                  isActive
                    ? 'bg-dark-800 border border-brand-500/40 text-white shadow-sm'
                    : 'hover:bg-dark-850 text-slate-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <FolderGit2
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-brand-400' : 'text-slate-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate font-mono">
                      {repo.repoName}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate mt-0.5">
                      <span>{repo.owner}</span>
                      <span>•</span>
                      {repo.status === 'ready' && (
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> ready ({repo.chunkCount || 0})
                        </span>
                      )}
                      {repo.status === 'indexing' && (
                        <span className="text-amber-400 flex items-center gap-0.5 animate-pulse">
                          <Clock className="w-2.5 h-2.5" /> indexing...
                        </span>
                      )}
                      {repo.status === 'failed' && (
                        <span className="text-red-400 flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" /> failed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${repo.repoName} and all indexed chunks?`)) {
                        onDeleteRepo(repo._id);
                      }
                    }}
                    className="p-1 rounded hover:bg-dark-700 text-slate-400 hover:text-red-400 transition"
                    title="Delete Repository"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
