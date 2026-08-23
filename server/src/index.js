import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import repoRoutes from './routes/repoRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    credentials: true
  })
);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Per-IP Rate Limiting to prevent API abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Max 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api', limiter);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);

// Root health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'RepoMind API Backend',
    timestamp: new Date().toISOString(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[RepoMind Server Error]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Connect to MongoDB
let isConnected = false;
const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) return;
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      isConnected = true;
      console.log('✅ Connected to MongoDB Atlas successfully.');
    } catch (err) {
      console.warn('⚠️ MongoDB connection issue, running in resilient mode:', err.message);
    }
  }
};

connectDB();

// Start HTTP Server when running locally (Non-serverless mode)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 RepoMind Server running on http://localhost:${PORT}`);
  });
}

export default app;
