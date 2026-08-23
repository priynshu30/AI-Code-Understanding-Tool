# 🧠 RepoMind — AI-Powered GitHub Code Understanding Tool (MERN + RAG)

> **Chat with any public GitHub repository using AST-aware Vector Search, Retrieval-Augmented Generation (RAG), and Token-by-Token Streaming with Verifiable Source Citations.**

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://ai-code-understanding-tool.vercel.app)
[![Tech Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20RAG-indigo?style=for-the-badge)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

---

## 📸 Application Screenshot & Interface Preview

<div align="center">
  <img src="https://raw.githubusercontent.com/priynshu30/AI-Code-Understanding-Tool/main/client/public/demo_preview.png" alt="RepoMind Interface Preview" width="95%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
  <p align="center"><i>Interactive RAG Chat with real-time token streaming, VS Code style file explorer, and clickable source line citations.</i></p>
</div>

---

## 🎯 The Core Problem RepoMind Solves

### The Real-World Developer Problem:
1. **Slow Developer Onboarding**: When developers or open-source contributors join a new project, they spend **hours to days** manually reading unfamiliar files, tracing data flows, and locating entry points just to make simple changes.
2. **Context Window Limits & Extreme LLM Cost**: Feeding an entire repository (thousands of files and millions of tokens) directly into ChatGPT or Claude exceeds LLM context windows and costs dollars per query.
3. **AI Hallucinations**: Standard LLMs often hallucinate and guess how authentication, database models, or controllers work instead of referencing the actual repository code.

### 💡 How RepoMind Solves It:
- **Instant 1-Click Codebase Indexing**: Paste any public GitHub URL. RepoMind traverses the tree, filters out non-essential binaries and lockfiles, parses function & class boundaries, and embeds them into high-dimensional vector representations.
- **Precision RAG Retrieval**: When a user asks a question, RepoMind retrieves only the **top-5 most relevant code chunks** (saving 95%+ token costs) and injects them as grounded context into the LLM.
- **100% Verifiable Source Citations**: Every single explanation cites exact file paths and line ranges (e.g., `[src/auth/jwt.js:L15-L35]`) with interactive deep-links to GitHub!

---

## 🏗️ System Architecture & Data Flow

```
┌─────────────────────────────────────────┐
│ React (Vite) + Tailwind CSS Frontend    │ ◄─── Modern VS Code File Explorer & Chat UI
└──────────────────┬──────────────────────┘
                   │ HTTP / SSE Token Stream
                   ▼
┌─────────────────────────────────────────┐
│ Node.js + Express API Backend           │ ◄─── JWT Auth, Rate Limiter, Controllers
└──────┬───────────────────────────┬──────┘
       │                           │
       ▼                           ▼
┌──────────────┐          ┌──────────────────────────────────┐
│ GitHub API   │          │ OpenAI Embeddings & LLM          │
│ (Octokit)    │          │ (text-embedding-3-small, 4o-mini)│
└──────────────┘          └────────────────┬─────────────────┘
                                           │
                                           ▼
                          ┌──────────────────────────────────┐
                          │ MongoDB Atlas / Storage Cache    │
                          │ ($vectorSearch / 1536-dim vectors│
                          └──────────────────────────────────┘
```

---

## ✨ Key Technical Highlights & Innovations

- 🌳 **Smart Semantic Chunking**: Unlike naive fixed-character splits that break syntax (cutting functions in half), RepoMind uses **AST / Regex function & class boundary chunking** (JS, TS, Python, Go, Java) with a sliding-window fallback.
- ⚡ **Real-Time Token Streaming (SSE)**: Uses unidirectional **Server-Sent Events (SSE)** to stream responses word-by-word like ChatGPT with near-zero latency.
- 📂 **VS Code Style File Explorer**: Interactive collapsible directory tree with real-time search filtering.
- 📊 **One-Click Architecture & README Synthesis**: Automatically generates structured 3-part technical overviews of repositories.
- 🛡️ **Enterprise-Grade Security**: Bcrypt password hashing (10 salt rounds), Mongoose `select: false` projection, IP rate limiting (`express-rate-limit`), and complete user tenant data isolation.

---

## 🛠️ Tech Stack & Dependencies

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, React Markdown, Remark GFM
* **Backend**: Node.js, Express.js, Octokit (GitHub REST SDK), JSON Web Tokens (JWT), BcryptJS, Express Rate Limit
* **AI & Vector Layer**: OpenAI API (`text-embedding-3-small`, `gpt-4o-mini`), MongoDB Atlas Vector Search / Hybrid Cosine Search
* **Deployment**: Vercel (Serverless Full-Stack Monorepo) / Render / MongoDB Atlas

---

## 🚀 Local Setup & Quickstart Guide

### 1. Clone the Repository
```bash
git clone https://github.com/priynshu30/AI-Code-Understanding-Tool.git
cd AI-Code-Understanding-Tool
```

### 2. Backend Setup
```bash
cd server
npm install
npm run dev
```
*(Server runs on `http://localhost:5000` with automatic local cache persistence)*

### 3. Frontend Setup
```bash
cd ../client
npm install
npm run dev
```
*(Open `http://localhost:5173` in your browser)*

---

## 🎤 Interview Cheatsheet & Technical Defense

> **Q1: Why did you choose RAG over fine-tuning or feeding whole files into the LLM?**
>
> *"Fine-tuning is expensive and static (it cannot update as code changes daily). Sending entire repositories exceeds context window limits and costs dollars per query. RAG retrieves only the top-5 semantically relevant code chunks (reducing prompt size by 95%+) and grounds LLM responses on actual source code to prevent hallucinations."*

> **Q2: Why did you use Server-Sent Events (SSE) instead of WebSockets?**
>
> *"LLM streaming is strictly unidirectional (server pushing tokens to client). SSE runs natively over HTTP, avoids custom socket handshakes, works seamlessly through firewalls and corporate proxies, and is much simpler to authenticate and load balance."*

> **Q3: How does your code chunking strategy differ from character splitting?**
>
> *"Fixed-character chunking destroys syntax by slicing functions or loops in the middle. Our chunker is AST/regex-aware: it identifies function, class, and method definitions across multiple languages and tags each chunk with exact `startLine` and `endLine` metadata to enable precise citations."*

---

## 📜 License
This project is licensed under the [MIT License](LICENSE).
