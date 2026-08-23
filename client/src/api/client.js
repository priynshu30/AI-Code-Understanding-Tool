const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('repomind_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const api = {
  // Auth
  async register(name, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Session expired');
    return data;
  },

  // Repos
  async submitRepo(repoUrl) {
    const res = await fetch(`${API_BASE}/repos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ repoUrl })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to submit repo');
    return data;
  },

  async getUserRepos() {
    const res = await fetch(`${API_BASE}/repos`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch repos');
    return data;
  },

  async getRepoStatus(repoId) {
    const res = await fetch(`${API_BASE}/repos/${repoId}/status`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch repo status');
    return data;
  },

  async getRepoSummary(repoId) {
    const res = await fetch(`${API_BASE}/repos/${repoId}/summary`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch summary');
    return data;
  },

  async getRepoFiles(repoId) {
    const res = await fetch(`${API_BASE}/repos/${repoId}/files`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch file tree');
    return data;
  },

  async deleteRepo(repoId) {
    const res = await fetch(`${API_BASE}/repos/${repoId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete repo');
    return data;
  },

  // Chat
  async getChatHistory(repoId) {
    const res = await fetch(`${API_BASE}/repos/${repoId}/chat/history`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load chat history');
    return data;
  },

  /**
   * Streams chat responses via Server-Sent Events (SSE) using Fetch and ReadableStream
   */
  async streamChat(repoId, question, { onSources, onToken, onDone, onError }) {
    const token = localStorage.getItem('repomind_token');
    try {
      const response = await fetch(`${API_BASE}/repos/${repoId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep unfinished chunk in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.replace('data: ', '');
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'sources') {
                onSources?.(event.sources);
              } else if (event.type === 'token') {
                onToken?.(event.token);
              } else if (event.type === 'done') {
                onDone?.(event);
              } else if (event.type === 'error') {
                onError?.(new Error(event.message));
              }
            } catch (pErr) {
              console.warn('Failed to parse SSE payload:', jsonStr);
            }
          }
        }
      }
    } catch (err) {
      onError?.(err);
    }
  }
};
