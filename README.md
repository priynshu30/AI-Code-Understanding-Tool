# RepoMind — AI-Powered GitHub Code Understanding Tool (MERN + RAG)

> An intelligent full-stack developer tool that enables natural-language conversations with any public GitHub repository using AST-aware code chunking, vector embeddings, and LLM-powered Retrieval-Augmented Generation (RAG).

---

## 🌟 Key Features

- **GitHub Repository Ingestion**: One-click ingestion of any public GitHub repository via Octokit and GitHub REST Trees API.
- **Smart Semantic Chunking**: Function and class boundary extraction (JS/TS, Python, Go, Java, etc.) preserving exact `startLine` and `endLine` metadata with sliding-window fallback.
- **Vector Search Indexing**: High-dimensional embeddings (`text-embedding-3-small` / 1536-dims) stored in MongoDB Atlas with cosine similarity matching.
- **RAG-Powered Chat**: Accurate codebase Q&A grounded on retrieved source code context to prevent LLM hallucinations.
- **Verifiable Source Citations**: Every explanation cites exact file paths and line ranges (`[src/auth/jwt.js:L15-L35]`) with interactive deep links to GitHub.
- **Token-by-Token Streaming**: Low-latency response streaming powered by Server-Sent Events (SSE).
- **VS Code Style File Explorer**: Interactive tree view with collapsible folders and instantaneous file search.
- **One-Click README & Architecture Summary**: Automated multi-module architectural synthesis.

---

## 🛠️ Architecture & Tech Stack

```
┌─────────────────────────────────┐
│ React (Vite) + Tailwind CSS     │ ◄─── Frontend UI (VS Code Explorer, SSE Chat)
└──────────────┬──────────────────┘
               │ HTTP / SSE Stream
               ▼
┌─────────────────────────────────┐
│ Node.js + Express API           │ ◄─── Controllers, JWT Auth, Octokit Fetcher
└──────┬───────────────────┬──────┘
       │                   │
       ▼                   ▼
┌──────────────┐   ┌───────────────────────────────┐
│ GitHub API   │   │ OpenAI / Embeddings & LLM     │
│ (Octokit)    │   │ (text-embedding-3-small, 4o)  │
└──────────────┘   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │ MongoDB Atlas + Vector Search │
                   │ (Users, Repos, Chunks, Chats) │
                   └───────────────────────────────┘
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas cluster (or local MongoDB)
- OpenAI API Key (optional: app includes built-in deterministic vector & streaming fallbacks)

### 2. Backend Setup
```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 🎤 Interview Cheatsheet & Technical Defense

### 1. Why RAG instead of feeding whole files to the LLM?
- **Cost & Context Window**: Large repositories have millions of tokens. Sending entire codebases exceeds context limits and is economically prohibitive. RAG retrieves only top-K semantically relevant functions (e.g. 5 chunks = ~1,500 tokens).
- **Reduced Hallucinations**: Grounding answers on precise snippets guarantees that explanations match actual implementation logic.

### 2. Why Function/Class Chunking instead of Fixed Character Splits?
- Splitting code at arbitrary character lengths (e.g. 500 chars) cuts functions and conditional blocks in half, destroying syntax context.
- Function/Class chunking preserves complete semantic units and maintains exact `startLine` and `endLine` for citations.

### 3. Why Server-Sent Events (SSE) over WebSockets?
- SSE operates over standard HTTP, making it simpler to load balance, proxy, and authenticate.
- Chat streaming is unidirectional (server -> client), which is the exact use case SSE was designed for.
