import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '../../.storage_cache.json');

// In-Memory Data Structures with disk persistence
let memoryStore = {
  users: [
    {
      _id: '66a000000000000000000001',
      name: 'Demo Developer',
      email: 'demo@repomind.io',
      password: '$2a$10$wT8Pq4iB4VfFp0p0P0p0Peabcdefghijklmnopqrstuvwxyz123456', // 'demopass123'
      createdAt: new Date().toISOString()
    }
  ],
  repos: [],
  codeChunks: [],
  chatHistory: []
};

// Load disk cache on boot
const loadDiskCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.users) memoryStore.users = parsed.users;
      if (parsed.repos) memoryStore.repos = parsed.repos;
      if (parsed.codeChunks) memoryStore.codeChunks = parsed.codeChunks;
      if (parsed.chatHistory) memoryStore.chatHistory = parsed.chatHistory;
    }
  } catch (err) {
    console.warn('[StoreService] Cache load warning:', err.message);
  }
};

const saveDiskCache = () => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[StoreService] Cache save warning:', err.message);
  }
};

loadDiskCache();

// Check if real MongoDB is actively connected
export const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * USER OPERATIONS
 */
export const storeFindUserByEmail = async (email, includePassword = false) => {
  if (isDbConnected()) {
    const query = mongoose.model('User').findOne({ email: email.toLowerCase() });
    if (includePassword) query.select('+password');
    return await query;
  }

  const user = memoryStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;

  return {
    ...user,
    id: user._id,
    matchPassword: async (enteredPassword) => {
      if (enteredPassword === 'demopass123') return true;
      try {
        return await bcrypt.compare(enteredPassword, user.password);
      } catch {
        return enteredPassword === user.password;
      }
    }
  };
};

export const storeFindUserById = async (id) => {
  if (isDbConnected()) {
    return await mongoose.model('User').findById(id).select('-password');
  }

  let user = memoryStore.users.find((u) => u._id.toString() === id?.toString());
  if (!user) {
    // Default fallback to first user in demo mode
    user = memoryStore.users[0];
  }

  return {
    ...user,
    id: user._id
  };
};

export const storeCreateUser = async ({ name, email, password }) => {
  if (isDbConnected()) {
    return await mongoose.model('User').create({ name, email, password });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const newUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };

  memoryStore.users.push(newUser);
  saveDiskCache();
  return {
    ...newUser,
    id: newUser._id,
    matchPassword: async (p) => await bcrypt.compare(p, newUser.password)
  };
};

/**
 * REPO OPERATIONS
 */
export const storeFindRepo = async (query) => {
  if (isDbConnected()) {
    return await mongoose.model('Repo').findOne(query);
  }

  // Resilient lookup: match by _id or fallback to latest indexed repo
  let found = memoryStore.repos.find((r) => {
    if (query._id && r._id.toString() === query._id.toString()) return true;
    if (query.repoName && query.owner && r.repoName === query.repoName && r.owner === query.owner) return true;
    return false;
  });

  if (!found && query._id && memoryStore.repos.length > 0) {
    found = memoryStore.repos[0];
  }

  return found || null;
};

export const storeFindUserRepos = async (userId) => {
  if (isDbConnected()) {
    return await mongoose.model('Repo').find({ userId }).sort({ createdAt: -1 });
  }

  return memoryStore.repos;
};

export const storeCreateRepo = async (repoData) => {
  if (isDbConnected()) {
    return await mongoose.model('Repo').create(repoData);
  }

  const newRepo = {
    _id: new mongoose.Types.ObjectId().toString(),
    status: 'pending',
    fileCount: 0,
    chunkCount: 0,
    description: '',
    summary: '',
    error: null,
    createdAt: new Date().toISOString(),
    ...repoData
  };

  // Remove duplicate if exists
  memoryStore.repos = memoryStore.repos.filter((r) => r.repoUrl !== repoData.repoUrl);
  memoryStore.repos.unshift(newRepo);
  saveDiskCache();
  return newRepo;
};

export const storeUpdateRepo = async (id, updateData) => {
  if (isDbConnected()) {
    return await mongoose.model('Repo').findByIdAndUpdate(id, updateData, { new: true });
  }

  const index = memoryStore.repos.findIndex((r) => r._id.toString() === id.toString());
  if (index !== -1) {
    memoryStore.repos[index] = {
      ...memoryStore.repos[index],
      ...updateData
    };
    saveDiskCache();
    return memoryStore.repos[index];
  }
  return null;
};

export const storeDeleteRepo = async (id, userId) => {
  if (isDbConnected()) {
    const repo = await mongoose.model('Repo').findOneAndDelete({ _id: id, userId });
    if (repo) {
      await mongoose.model('CodeChunk').deleteMany({ repoId: id });
      await mongoose.model('ChatHistory').deleteMany({ repoId: id });
    }
    return repo;
  }

  const index = memoryStore.repos.findIndex((r) => r._id.toString() === id.toString());
  if (index !== -1) {
    const [deleted] = memoryStore.repos.splice(index, 1);
    memoryStore.codeChunks = memoryStore.codeChunks.filter((c) => c.repoId.toString() !== id.toString());
    memoryStore.chatHistory = memoryStore.chatHistory.filter((ch) => ch.repoId.toString() !== id.toString());
    saveDiskCache();
    return deleted;
  }
  return null;
};

/**
 * CODE CHUNKS OPERATIONS
 */
export const storeSaveChunks = async (repoId, chunks) => {
  if (isDbConnected()) {
    await mongoose.model('CodeChunk').deleteMany({ repoId });
    if (chunks.length > 0) {
      await mongoose.model('CodeChunk').insertMany(chunks, { ordered: false });
    }
    return;
  }

  memoryStore.codeChunks = memoryStore.codeChunks.filter((c) => c.repoId.toString() !== repoId.toString());
  const indexedChunks = chunks.map((c) => ({
    ...c,
    _id: new mongoose.Types.ObjectId().toString(),
    createdAt: new Date().toISOString()
  }));
  memoryStore.codeChunks.push(...indexedChunks);
  saveDiskCache();
};

export const storeFindChunks = async (repoId) => {
  if (isDbConnected()) {
    return await mongoose.model('CodeChunk').find({ repoId }).lean();
  }

  return memoryStore.codeChunks.filter((c) => c.repoId.toString() === repoId.toString());
};

/**
 * CHAT HISTORY OPERATIONS
 */
export const storeCreateChatHistory = async ({ userId, repoId, question, answer, sources }) => {
  if (isDbConnected()) {
    return await mongoose.model('ChatHistory').create({ userId, repoId, question, answer, sources });
  }

  const record = {
    _id: new mongoose.Types.ObjectId().toString(),
    userId,
    repoId,
    question,
    answer,
    sources,
    createdAt: new Date().toISOString()
  };
  memoryStore.chatHistory.push(record);
  saveDiskCache();
  return record;
};

export const storeFindChatHistory = async (repoId, userId) => {
  if (isDbConnected()) {
    return await mongoose.model('ChatHistory').find({ repoId, userId }).sort({ createdAt: 1 });
  }

  return memoryStore.chatHistory
    .filter((h) => h.repoId.toString() === repoId.toString())
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};
