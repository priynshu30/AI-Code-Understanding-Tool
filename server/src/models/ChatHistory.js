import mongoose from 'mongoose';

const sourceCitationSchema = new mongoose.Schema(
  {
    filePath: {
      type: String,
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
    snippet: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repo',
      required: true,
      index: true
    },
    question: {
      type: String,
      required: true,
      trim: true
    },
    answer: {
      type: String,
      required: true
    },
    sources: [sourceCitationSchema]
  },
  {
    timestamps: true
  }
);

chatHistorySchema.index({ repoId: 1, userId: 1, createdAt: 1 });

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
export default ChatHistory;
