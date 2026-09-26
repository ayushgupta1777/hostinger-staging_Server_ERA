import DailyStreak from '../models/DailyStreak.js';
import { AppError } from '../middleware/errorHandler.js';

const DAILY_GOAL_SECONDS = 300; // 5 minutes

// Calculate streak data
const calculateStreaks = (records) => {
  if (!records || records.length === 0) return { currentStreak: 0, longestStreak: 0 };
  
  // Sort descending by date
  const sorted = records.sort((a, b) => new Date(b.dateString) - new Date(a.dateString));
  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  // Generate today and yesterday in YYYY-MM-DD
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let isCurrentStreakActive = true;
  let lastProcessedDate = null;

  // We have to iterate through dates. Since records might have gaps, we should use a date iterator approach,
  // but it's simpler to just map completed records to a Set and count backwards from today.
  const completedDates = new Set(sorted.filter(r => r.isCompleted).map(r => r.dateString));

  // Calculate current streak
  let checkDate = new Date();
  while (true) {
    const checkStr = checkDate.toISOString().split('T')[0];
    if (completedDates.has(checkStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If it's today and not completed, the streak might still be active from yesterday
      if (checkStr === todayStr) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }
  }

  // Calculate longest streak by iterating all sorted completed dates
  const sortedCompleted = Array.from(completedDates).sort();
  tempStreak = 0;
  let previousDate = null;

  for (const dateStr of sortedCompleted) {
    if (!previousDate) {
      tempStreak = 1;
    } else {
      const prev = new Date(previousDate);
      const curr = new Date(dateStr);
      const diffTime = Math.abs(curr - prev);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 1;
      }
    }
    previousDate = dateStr;
  }
  if (tempStreak > longestStreak) longestStreak = tempStreak;

  return { currentStreak, longestStreak };
};

export const syncActivity = async (req, res, next) => {
  try {
    const { sessions } = req.body;
    // sessions should be an array: [{ dateString: '2026-09-27', addedSeconds: 45 }]
    
    if (!sessions || !Array.isArray(sessions)) {
      return next(new AppError('Sessions array is required', 400));
    }

    const userId = req.user._id;

    for (const session of sessions) {
      const { dateString, addedSeconds } = session;
      
      if (!dateString || typeof addedSeconds !== 'number' || addedSeconds <= 0) continue;
      
      // Basic anti-cheat: prevent massive single-sync durations (e.g. > 12 hours)
      if (addedSeconds > 43200) continue;

      // Anti-cheat: prevent syncing fake dates (only allow today and yesterday)
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (dateString !== todayStr && dateString !== yesterdayStr) {
        continue;
      }

      let record = await DailyStreak.findOne({ user: userId, dateString });
      
      if (!record) {
        record = new DailyStreak({
          user: userId,
          dateString,
          activeSeconds: addedSeconds,
          isCompleted: addedSeconds >= DAILY_GOAL_SECONDS
        });
      } else {
        record.activeSeconds += addedSeconds;
        if (record.activeSeconds >= DAILY_GOAL_SECONDS) {
          record.isCompleted = true;
        }
      }
      await record.save();
    }

    // Return the updated status for the current month
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const allRecords = await DailyStreak.find({ user: userId });
    const monthRecords = allRecords.filter(r => r.dateString.startsWith(currentMonth));
    
    const streaks = calculateStreaks(allRecords);

    res.status(200).json({
      success: true,
      data: {
        records: monthRecords,
        ...streaks
      }
    });

  } catch (error) {
    next(error);
  }
};

export const getStreakData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { month } = req.query; // YYYY-MM
    
    const allRecords = await DailyStreak.find({ user: userId });
    
    let filterMonth = month;
    if (!filterMonth) {
      const currentDate = new Date();
      filterMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    }

    const monthRecords = allRecords.filter(r => r.dateString.startsWith(filterMonth));
    const streaks = calculateStreaks(allRecords);

    res.status(200).json({
      success: true,
      data: {
        records: monthRecords,
        ...streaks
      }
    });

  } catch (error) {
    next(error);
  }
};
