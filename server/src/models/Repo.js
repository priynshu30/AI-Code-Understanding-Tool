import mongoose from 'mongoose';

const repoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    repoUrl: {
      type: String,
      required: [true, 'Repository URL is required'],
      trim: true
    },
    repoName: {
      type: String,
      required: [true, 'Repository name is required'],
      trim: true
    },
    owner: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'indexing', 'ready', 'failed'],
      default: 'pending'
    },
    fileCount: {
      type: Number,
      default: 0
    },
    chunkCount: {
      type: Number,
      default: 0
    },
    defaultBranch: {
      type: String,
      default: 'main'
    },
    latestCommitSha: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    summary: {
      type: String,
      default: ''
    },
    error: {
      type: String,
      default: null
    },
    indexedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index to quickly find repos for a user
repoSchema.index({ userId: 1, repoUrl: 1 });

const Repo = mongoose.model('Repo', repoSchema);
export default Repo;
