import React from 'react';
import { Terminal, Github, User as UserIcon, LogOut, BookOpen, Sparkles, Layers } from 'lucide-react';

export default function Navbar({ user, onOpenAuth, onLogout, onOpenSummary, activeRepo }) {
  return (
    <header className="h-14 border-b border-dark-700 bg-dark-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-md shadow-brand-500/20">
          <Terminal className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-white font-mono text-base">RepoMind</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-mono border border-brand-500/30">
              RAG v1.0
            </span>
          </div>
        </div>
      </div>

      {/* Center active repo indicator */}
      {activeRepo && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-dark-800 border border-dark-700 text-xs">
          <Github className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">{activeRepo.owner}/</span>
          <span className="text-slate-100 font-medium font-mono">{activeRepo.repoName}</span>
          <span className={`w-2 h-2 rounded-full ${
            activeRepo.status === 'ready' ? 'bg-accent-emerald' :
            activeRepo.status === 'indexing' ? 'bg-accent-amber animate-pulse' : 'bg-red-500'
          }`} />
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {activeRepo && (
          <button
            onClick={onOpenSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-600 text-xs font-medium text-slate-200 transition"
            title="Auto-generated Architecture Summary"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-amber" />
            <span>README Summary</span>
          </button>
        )}

        {user ? (
          <div className="flex items-center gap-3 pl-2 border-l border-dark-700">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-600/30 border border-brand-500/40 text-brand-300 flex items-center justify-center text-xs font-semibold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-slate-300 hidden sm:inline">{user.name}</span>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg hover:bg-dark-800 text-slate-400 hover:text-red-400 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
