import React, { useState } from 'react';
import { Github, Search, Loader2, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

const POPULAR_REPOS = [
  { name: 'expressjs/express', desc: 'Fast Node.js web framework' },
  { name: 'facebook/react', desc: 'The library for web and native UIs' },
  { name: 'axios/axios', desc: 'Promise based HTTP client for browser & node' },
  { name: 'vercel/next.js', desc: 'The React Framework for the Web' }
];

export default function RepoInput({ onIndexRepo, indexing }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onIndexRepo(url.trim());
  };

  const handleSelectPreset = (repoName) => {
    setUrl(`https://github.com/${repoName}`);
    onIndexRepo(`https://github.com/${repoName}`);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Vector Search & RAG-Powered Code Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Chat with any <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-accent-cyan">GitHub Repository</span>
        </h1>
        <p className="text-slate-400 text-sm mt-3 max-w-xl mx-auto">
          Paste any public GitHub repository URL. RepoMind indexes the codebase into vector embeddings so you can ask architectural, debugging, and logic questions with exact line citations.
        </p>
      </div>

      {/* Main URL Input Form */}
      <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400">
            <Github className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={indexing}
            placeholder="https://github.com/facebook/react or owner/repo"
            className="w-full bg-dark-850 border-2 border-dark-700 focus:border-brand-500 rounded-xl pl-12 pr-32 py-3.5 text-sm text-white placeholder-slate-500 shadow-xl focus:outline-none transition font-mono"
          />
          <button
            type="submit"
            disabled={indexing || !url.trim()}
            className="absolute right-2 top-2 bottom-2 px-5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition flex items-center gap-2"
          >
            {indexing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Indexing...</span>
              </>
            ) : (
              <>
                <span>Index Repo</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Preset popular repositories */}
      <div className="mt-8 max-w-2xl mx-auto">
        <p className="text-xs font-medium text-slate-500 mb-3 text-center uppercase tracking-wider">
          Or try one of these popular repositories:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {POPULAR_REPOS.map((item) => (
            <button
              key={item.name}
              onClick={() => handleSelectPreset(item.name)}
              disabled={indexing}
              className="flex items-center justify-between p-3 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-brand-500/40 text-left transition group"
            >
              <div className="truncate pr-2">
                <div className="text-xs font-mono font-semibold text-slate-200 group-hover:text-brand-400 transition">
                  {item.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.desc}</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400 group-hover:translate-x-0.5 transition flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
