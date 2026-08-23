import React from 'react';
import { X, FileCode, ExternalLink, Copy, Check } from 'lucide-react';

export default function SnippetModal({ isOpen, onClose, source, repoUrl, defaultBranch = 'main' }) {
  const [copied, setCopied] = React.useState(false);
  if (!isOpen || !source) return null;

  const gitHubLineUrl = repoUrl
    ? `${repoUrl}/blob/${defaultBranch}/${source.filePath}#L${source.startLine}-L${source.endLine}`
    : '#';

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(source.snippet || source.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-850 border border-dark-700 w-full max-w-2xl rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-dark-700 flex items-center justify-between bg-dark-900">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-brand-400" />
            <div className="text-xs font-mono text-white font-semibold">
              {source.filePath} <span className="text-slate-500">:L{source.startLine}-L{source.endLine}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {repoUrl && (
              <a
                href={gitHubLineUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-700 text-[11px] text-slate-300 font-mono border border-dark-700 transition"
              >
                <span>View on GitHub</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-dark-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="p-4 bg-dark-900 overflow-x-auto max-h-[60vh] font-mono text-xs text-slate-200 leading-relaxed">
          <pre className="p-3 bg-[#0d131f] rounded-lg border border-dark-750">
            <code>{source.snippet || source.content || 'Snippet not available.'}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-dark-700 bg-dark-900 flex justify-between items-center">
          <span className="text-[11px] text-slate-500 font-mono">
            Lines {source.startLine} to {source.endLine}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySnippet}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-xs text-slate-300 border border-dark-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Snippet'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
