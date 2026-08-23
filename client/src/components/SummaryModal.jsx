import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Sparkles, BookOpen, Layers } from 'lucide-react';

export default function SummaryModal({ isOpen, onClose, summary, repoName }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-850 border border-dark-700 w-full max-w-3xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-dark-700 flex items-center justify-between bg-dark-900">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-accent-amber/10 border border-accent-amber/20 text-accent-amber">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono">
                Architecture & README Summary: {repoName}
              </h2>
              <p className="text-[11px] text-slate-400">
                AI-generated comprehensive codebase analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 prose prose-invert prose-sm max-w-none text-slate-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {summary || 'Summary is currently being generated for this codebase...'}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-dark-700 bg-dark-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-xs font-semibold text-slate-300 border border-dark-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
