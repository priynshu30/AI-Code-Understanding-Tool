import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  FileCode,
  ArrowUpRight,
  Loader2,
  Code2,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Walk me through the overall project architecture and data flow of this SaaS CRM.',
  'How is user authentication, JWT token generation, and password hashing implemented?',
  'Explain the database schema models and relationships between Leads and Users.',
  'Where is the logic for lead creation, status updates, and pipeline stages handled?'
];

export default function ChatWindow({
  activeRepo,
  messages,
  onSendMessage,
  streamingMessage,
  currentSources,
  isStreaming,
  onOpenSourceSnippet,
  showFileTree,
  onToggleFileTree
}) {
  const [input, setInput] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatContainerRef = useRef(null);

  // Smooth pinning to bottom without jumping page viewport
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-900 relative min-w-0 overflow-hidden">
      {/* Header bar */}
      <div className="h-12 border-b border-dark-700 bg-dark-850/70 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onToggleFileTree}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white border border-dark-700 text-xs transition"
            title={showFileTree ? "Hide File Explorer" : "Show File Explorer"}
          >
            {showFileTree ? <PanelLeftClose className="w-3.5 h-3.5 text-brand-400" /> : <PanelLeftOpen className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline font-mono">{showFileTree ? 'Hide Files' : 'Show Files'}</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <Code2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-200 font-mono truncate max-w-[200px] sm:max-w-xs">
              {activeRepo.owner}/{activeRepo.repoName}
            </span>
            <span className="hidden md:inline text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex-shrink-0">
              {activeRepo.chunkCount || 0} vectors indexed
            </span>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0"
      >
        {messages.length === 0 && !isStreaming ? (
          <div className="max-w-2xl mx-auto my-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Ready to explore {activeRepo.repoName}!
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
              Ask any question about the architecture, auth, database, or API controllers. Answers are retrieved directly from the codebase.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(q)}
                  className="p-3 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700 hover:border-brand-500/40 text-xs text-slate-300 transition flex items-start gap-2 group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition" />
                  <span className="flex-1 leading-snug">{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 max-w-4xl mx-auto ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-400 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`relative rounded-xl p-4 text-sm leading-relaxed max-w-[90%] sm:max-w-[85%] break-words ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 font-medium'
                      : 'bg-dark-850 border border-dark-700 text-slate-200 shadow-sm'
                  }`}
                >
                  {msg.sender === 'bot' ? (
                    <div>
                      <div className="prose prose-invert prose-sm max-w-none text-slate-200 overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>

                      {/* Source citations chips */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-dark-700/80">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                            <FileCode className="w-3.5 h-3.5 text-accent-cyan" />
                            <span>Retrieved Code Sources ({msg.sources.length}):</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => onOpenSourceSnippet(src)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-dark-900 hover:bg-dark-800 border border-dark-700 hover:border-brand-500/50 text-[11px] font-mono text-slate-300 transition group"
                              >
                                <span className="text-brand-400 font-semibold truncate max-w-[180px]">
                                  {src.filePath}
                                </span>
                                <span className="text-slate-500">
                                  :L{src.startLine}-L{src.endLine}
                                </span>
                                <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-white transition" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Copy button */}
                      <button
                        onClick={() => handleCopy(msg.text, index)}
                        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-dark-800 text-slate-400 hover:text-white transition"
                        title="Copy Response"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <div>{msg.text}</div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-dark-800 border border-dark-700 text-slate-300 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Real-time Streaming Message */}
            {isStreaming && (
              <div className="flex gap-3 max-w-4xl mx-auto justify-start">
                <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-400 flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-dark-850 border border-dark-700 text-slate-200 rounded-xl p-4 text-sm leading-relaxed max-w-[90%] sm:max-w-[85%] shadow-sm overflow-x-auto">
                  {streamingMessage ? (
                    <div className="prose prose-invert prose-sm max-w-none text-slate-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingMessage}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                      <span>Retrieving vectors & assembling prompt context...</span>
                    </div>
                  )}

                  {currentSources && currentSources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-dark-700/80 flex flex-wrap gap-1.5">
                      {currentSources.map((src, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-dark-900 text-[10px] font-mono text-slate-400 border border-dark-700"
                        >
                          {src.filePath}:L{src.startLine}-L{src.endLine}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat input box */}
      <div className="p-4 border-t border-dark-700 bg-dark-850/90 backdrop-blur-md flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder={`Ask anything about ${activeRepo.repoName}... (e.g. "Where is lead creation handled?")`}
            className="w-full bg-dark-900 border border-dark-700 focus:border-brand-500 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none shadow-lg transition font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 top-2 bottom-2 px-3 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition flex items-center justify-center shadow-md shadow-brand-600/30"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
