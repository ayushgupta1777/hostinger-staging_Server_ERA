import mongoose from 'mongoose';

const dailyStreakSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dateString: {
    type: String, // Format: YYYY-MM-DD local to user
    required: true
  },
  activeSeconds: {
    type: Number,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Ensure one record per user per calendar day
dailyStreakSchema.index({ user: 1, dateString: 1 }, { unique: true });

const DailyStreak = mongoose.model('DailyStreak', dailyStreakSchema);
export default DailyStreak;
