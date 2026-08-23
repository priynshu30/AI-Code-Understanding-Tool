import mongoose from 'mongoose';

const codeChunkSchema = new mongoose.Schema(
  {
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repo',
      required: true,
      index: true
    },
    filePath: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      required: true
    },
    startLine: {
      type: Number,
      required: true
    },
    endLine: {
      type: Number,
      required: true
    },
    language: {
      type: String,
      default: 'plaintext'
    },
    chunkType: {
      type: String,
      enum: ['function', 'class', 'method', 'struct', 'block', 'general'],
      default: 'general'
    },
    identifier: {
      type: String,
      default: '' // Name of function/class if identified
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying chunks per file within a repo
codeChunkSchema.index({ repoId: 1, filePath: 1 });

const CodeChunk = mongoose.model('CodeChunk', codeChunkSchema);
export default CodeChunk;
