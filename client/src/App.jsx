import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import RepoInput from './components/RepoInput';
import Sidebar from './components/Sidebar';
import FileTree from './components/FileTree';
import ChatWindow from './components/ChatWindow';
import SummaryModal from './components/SummaryModal';
import SnippetModal from './components/SnippetModal';
import { api } from './api/client';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [activeRepo, setActiveRepo] = useState(null);
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  // Indexing State
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState('');

  // Chat State
  const [messages, setMessages] = useState([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentSources, setCurrentSources] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Modals
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState(null);

  // Polling ref for status checking
  const pollIntervalRef = useRef(null);

  // 1. Initial Auth & Repos load
  useEffect(() => {
    const token = localStorage.getItem('repomind_token');
    if (token) {
      api.getMe()
        .then((res) => {
          if (res.user) {
            setUser(res.user);
            loadUserRepos();
          }
        })
        .catch(() => {
          localStorage.removeItem('repomind_token');
        });
    }
  }, []);

  const loadUserRepos = async () => {
    try {
      const res = await api.getUserRepos();
      if (res.repos) {
        setRepos(res.repos);
      }
    } catch (err) {
      console.warn('Could not load repos:', err.message);
    }
  };

  // 2. Poll repo indexing status if active repo is indexing
  useEffect(() => {
    if (activeRepo && activeRepo.status === 'indexing') {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.getRepoStatus(activeRepo._id);
          if (res.repo) {
            setActiveRepo(res.repo);
            setRepos((prev) => prev.map((r) => (r._id === res.repo._id ? res.repo : r)));

            if (res.repo.status === 'ready' || res.repo.status === 'failed') {
              clearInterval(pollIntervalRef.current);
              setIndexing(false);
              if (res.repo.status === 'ready') {
                loadRepoFiles(res.repo._id);
                loadChatHistory(res.repo._id);
              }
            }
          }
        } catch (pollErr) {
          console.warn('Polling error:', pollErr.message);
        }
      }, 2500);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeRepo]);

  const loadRepoFiles = async (repoId) => {
    try {
      const res = await api.getRepoFiles(repoId);
      if (res.files) {
        setRepoFiles(res.files);
      }
    } catch (err) {
      console.warn('Could not load files:', err.message);
    }
  };

  const loadChatHistory = async (repoId) => {
    try {
      const res = await api.getChatHistory(repoId);
      if (res.history) {
        const formatted = [];
        res.history.forEach((h) => {
          formatted.push({ sender: 'user', text: h.question });
          formatted.push({ sender: 'bot', text: h.answer, sources: h.sources });
        });
        setMessages(formatted);
      }
    } catch (err) {
      console.warn('Could not load chat history:', err.message);
    }
  };

  const handleSelectRepo = (repo) => {
    setActiveRepo(repo);
    setSelectedFile(null);
    setMessages([]);
    if (repo.status === 'ready') {
      loadRepoFiles(repo._id);
      loadChatHistory(repo._id);
    }
  };

  const handleIndexRepo = async (repoUrl) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    setIndexing(true);
    setIndexError('');

    try {
      const res = await api.submitRepo(repoUrl);
      if (res.repo) {
        setActiveRepo(res.repo);
        setRepos((prev) => {
          const exists = prev.some((r) => r._id === res.repo._id);
          return exists ? prev.map((r) => (r._id === res.repo._id ? res.repo : r)) : [res.repo, ...prev];
        });

        if (res.repo.status === 'ready') {
          setIndexing(false);
          loadRepoFiles(res.repo._id);
          loadChatHistory(res.repo._id);
        }
      }
    } catch (err) {
      setIndexError(err.message || 'Failed to index repository');
      setIndexing(false);
    }
  };

  const handleDeleteRepo = async (repoId) => {
    try {
      await api.deleteRepo(repoId);
      setRepos((prev) => prev.filter((r) => r._id !== repoId));
      if (activeRepo?._id === repoId) {
        setActiveRepo(null);
        setRepoFiles([]);
        setMessages([]);
      }
    } catch (err) {
      alert('Failed to delete repository: ' + err.message);
    }
  };

  const handleSendMessage = async (question) => {
    if (!activeRepo || !question.trim()) return;

    // Add user message to state
    setMessages((prev) => [...prev, { sender: 'user', text: question }]);
    setIsStreaming(true);
    setStreamingMessage('');
    setCurrentSources([]);

    let streamedText = '';
    let resolvedSources = [];

    await api.streamChat(activeRepo._id, question, {
      onSources: (sources) => {
        setCurrentSources(sources);
        resolvedSources = sources;
      },
      onToken: (token) => {
        streamedText += token;
        setStreamingMessage(streamedText);
      },
      onDone: (doneEvent) => {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: streamedText,
            sources: doneEvent.sources || resolvedSources
          }
        ]);
        setStreamingMessage('');
        setIsStreaming(false);
      },
      onError: (err) => {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: `⚠️ **Error Generating Response**: ${err.message}`,
            sources: []
          }
        ]);
        setStreamingMessage('');
        setIsStreaming(false);
      }
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('repomind_token');
    setUser(null);
    setRepos([]);
    setActiveRepo(null);
    setMessages([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        user={user}
        activeRepo={activeRepo}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenSummary={() => setIsSummaryOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Repository List */}
        <Sidebar
          repos={repos}
          activeRepo={activeRepo}
          onSelectRepo={handleSelectRepo}
          onNewRepo={() => setActiveRepo(null)}
          onDeleteRepo={handleDeleteRepo}
        />

        {/* Center/Right Content Area */}
        <main className="flex-1 flex overflow-hidden bg-dark-900">
          {!activeRepo ? (
            <div className="flex-1 overflow-y-auto">
              <RepoInput onIndexRepo={handleIndexRepo} indexing={indexing} />

              {indexError && (
                <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{indexError}</span>
                </div>
              )}
            </div>
          ) : activeRepo.status === 'indexing' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-4 animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 font-mono">
                Indexing {activeRepo.owner}/{activeRepo.repoName}...
              </h2>
              <p className="text-xs text-slate-400 max-w-md mb-4">
                We are fetching the repository tree, parsing functions & classes, generating vector embeddings, and building the semantic index.
              </p>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-dark-800 border border-dark-700 text-xs text-slate-300 font-mono">
                <span>Status: {activeRepo.fileCount ? `${activeRepo.fileCount} files discovered` : 'Connecting to GitHub...'}</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex h-full overflow-hidden">
              {/* VS Code File Explorer */}
              <FileTree
                files={repoFiles}
                onSelectFile={(path) => setSelectedFile(path)}
                selectedFile={selectedFile}
              />

              {/* RAG Streaming Chat Window */}
              <ChatWindow
                activeRepo={activeRepo}
                messages={messages}
                onSendMessage={handleSendMessage}
                streamingMessage={streamingMessage}
                currentSources={currentSources}
                isStreaming={isStreaming}
                onOpenSourceSnippet={(src) => setActiveSnippet(src)}
              />
            </div>
          )}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          loadUserRepos();
        }}
      />

      {/* Architecture & README Summary Modal */}
      <SummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        summary={activeRepo?.summary}
        repoName={activeRepo?.repoName}
      />

      {/* Source Citation Code Snippet Modal */}
      <SnippetModal
        isOpen={Boolean(activeSnippet)}
        onClose={() => setActiveSnippet(null)}
        source={activeSnippet}
        repoUrl={activeRepo?.repoUrl}
        defaultBranch={activeRepo?.defaultBranch}
      />
    </div>
  );
}
