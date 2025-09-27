import { 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit,
  doc,
  getDoc
} from "firebase/firestore";
import { db, auth } from "./firebaseInit.js";
import { getFollowing } from "./followService.js";

// Collection name for study sessions
const STUDY_SESSIONS_COLLECTION = "studySessions";

/**
 * Generate a daily study summary for a specific date
 * @param {Date} date - The date to generate summary for
 * @param {string} userId - Optional user ID, defaults to current user
 * @returns {Object} Daily summary object
 */
export const generateDailySummary = async (date, userId = null) => {
  try {
    const user = userId || auth.currentUser?.uid;
    if (!user) {
      throw new Error("User must be authenticated to generate daily summaries");
    }

    // Get start and end of the day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Query study sessions for the specific day (without orderBy to avoid index requirement)
    const q = query(
      collection(db, STUDY_SESSIONS_COLLECTION),
      where("userId", "==", user),
      where("startTime", ">=", dayStart),
      where("startTime", "<=", dayEnd)
    );

    const querySnapshot = await getDocs(q);
    const sessions = [];
    
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort in JavaScript instead of Firestore
    sessions.sort((a, b) => {
      const dateA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
      const dateB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
      return dateA.getTime() - dateB.getTime(); // Ascending order
    });

    // Calculate summary statistics
    const summary = calculateDailyStats(sessions, date);
    
    return summary;
  } catch (error) {
    console.error("Error generating daily summary: ", error);
    throw error;
  }
};

/**
 * Generate daily summaries for the last N days
 * @param {number} days - Number of days to generate summaries for
 * @param {string} userId - Optional user ID, defaults to current user
 * @returns {Array} Array of daily summary objects
 */
export const generateRecentDailySummaries = async (days = 7, userId = null) => {
  try {
    const summaries = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const summary = await generateDailySummary(date, userId);
      summaries.push(summary);
    }
    
    return summaries;
  } catch (error) {
    console.error("Error generating recent daily summaries: ", error);
    throw error;
  }
};

/**
 * Generate social daily summaries including own data and followed users' data
 * @param {number} days - Number of days to generate summaries for
 * @param {string} userId - Optional user ID, defaults to current user
 * @returns {Array} Array of social daily summary objects
 */
export const generateSocialDailySummaries = async (days = 7, userId = null) => {
  try {
    const user = userId || auth.currentUser?.uid;
    if (!user) {
      throw new Error("User must be authenticated to generate social daily summaries");
    }

    // Get list of users that the current user is following
    const followingUsers = await getFollowing(user, 50);
    
    // Create array of user IDs to fetch summaries for (including self)
    const userIdsToFetch = [user, ...followingUsers.map(u => u.id)];
    
    const allSummaries = [];
    const today = new Date();
    
    // Get all study sessions for all users in the date range at once
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    // Fetch all sessions for all users in the date range
    const allSessions = [];
    for (const targetUserId of userIdsToFetch) {
      try {
        // Simple query without date range to avoid index issues
        const sessionsQuery = query(
          collection(db, STUDY_SESSIONS_COLLECTION),
          where("userId", "==", targetUserId)
        );
        
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const userSessions = [];
        
        sessionsSnapshot.forEach((doc) => {
          const sessionData = doc.data();
          const sessionDate = sessionData.startTime?.toDate ? sessionData.startTime.toDate() : new Date(sessionData.startTime);
          
          // Filter by date range in JavaScript
          if (sessionDate >= startDate && sessionDate <= endDate) {
            userSessions.push({
              id: doc.id,
              ...sessionData,
              userId: targetUserId
            });
          }
        });
        
        allSessions.push(...userSessions);
      } catch (error) {
        console.error(`Error fetching sessions for user ${targetUserId}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    // Group sessions by user and date
    const sessionsByUserAndDate = {};
    allSessions.forEach(session => {
      const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
      const dateKey = sessionDate.toDateString();
      const userKey = session.userId;
      
      if (!sessionsByUserAndDate[userKey]) {
        sessionsByUserAndDate[userKey] = {};
      }
      if (!sessionsByUserAndDate[userKey][dateKey]) {
        sessionsByUserAndDate[userKey][dateKey] = [];
      }
      
      sessionsByUserAndDate[userKey][dateKey].push(session);
    });
    
    // Generate summaries for each user and date
    for (const targetUserId of userIdsToFetch) {
      try {
        // Get user profile information once
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        const userData = userDoc.exists() ? userDoc.data() : null;
        
        const userProfile = {
          id: targetUserId,
          displayName: userData?.displayName || 'Unknown User',
          username: userData?.username || userData?.email?.split('@')[0] || 'user',
          profilePicture: userData?.profilePictureUrl || null,
          isOwn: targetUserId === user
        };
        
        // Generate summaries for each day
        for (let i = 0; i < days; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateKey = date.toDateString();
          
          const daySessions = sessionsByUserAndDate[targetUserId]?.[dateKey] || [];
          
          if (daySessions.length > 0) {
            const summary = calculateDailyStats(daySessions, date);
            
            if (summary.totalStudyTime > 0) {
              const socialSummary = {
                ...summary,
                userId: targetUserId,
                userProfile
              };
              
              allSummaries.push(socialSummary);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing user ${targetUserId}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    // Sort all summaries by date (newest first) and then by study time
    allSummaries.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() === dateB.getTime()) {
        return b.totalStudyTime - a.totalStudyTime;
      }
      return dateB.getTime() - dateA.getTime();
    });
    
    return allSummaries;
  } catch (error) {
    console.error("Error generating social daily summaries: ", error);
    throw error;
  }
};

/**
 * Calculate daily statistics from study sessions
 * @param {Array} sessions - Array of study sessions for the day
 * @param {Date} date - The date being analyzed
 * @returns {Object} Daily summary object
 */
const calculateDailyStats = (sessions, date) => {
  const dateString = date.toDateString();
  
  // Basic stats
  let totalStudyTime = 0; // in hours
  let sessionCount = sessions.length;
  let subjects = new Set();
  let longestSession = 0;
  let averageSessionLength = 0;
  
  // Time-based analysis
  let morningSessions = 0; // 6 AM - 12 PM
  let afternoonSessions = 0; // 12 PM - 6 PM
  let eveningSessions = 0; // 6 PM - 12 AM
  let nightSessions = 0; // 12 AM - 6 AM
  
  // Process each session
  sessions.forEach(session => {
    // Calculate session duration
    let sessionDuration = 0;
    if (session.startTime && session.endTime) {
      const start = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
      const end = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
      const durationMs = end.getTime() - start.getTime();
      sessionDuration = durationMs / (1000 * 60 * 60); // Convert to hours
    } else if (session.duration) {
      sessionDuration = session.duration / 3600; // Convert seconds to hours
    }
    
    totalStudyTime += sessionDuration;
    
    // Track subjects
    if (session.subject) {
      subjects.add(session.subject);
    }
    
    // Track longest session
    if (sessionDuration > longestSession) {
      longestSession = sessionDuration;
    }
    
    // Categorize by time of day
    const sessionStart = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const hour = sessionStart.getHours();
    
    if (hour >= 6 && hour < 12) {
      morningSessions++;
    } else if (hour >= 12 && hour < 18) {
      afternoonSessions++;
    } else if (hour >= 18 && hour < 24) {
      eveningSessions++;
    } else {
      nightSessions++;
    }
  });
  
  // Calculate average session length
  if (sessionCount > 0) {
    averageSessionLength = totalStudyTime / sessionCount;
  }
  
  // Determine most productive time of day
  const timeCategories = [
    { name: 'Morning', count: morningSessions },
    { name: 'Afternoon', count: afternoonSessions },
    { name: 'Evening', count: eveningSessions },
    { name: 'Night', count: nightSessions }
  ];
  
  const mostProductiveTime = timeCategories.reduce((max, current) => 
    current.count > max.count ? current : max
  );
  
  // Generate insights
  const insights = generateInsights({
    totalStudyTime,
    sessionCount,
    subjects: Array.from(subjects),
    longestSession,
    averageSessionLength,
    mostProductiveTime: mostProductiveTime.name,
    dateString
  });
  
  return {
    date: dateString,
    dateObj: date,
    totalStudyTime: Math.round(totalStudyTime * 10) / 10,
    sessionCount,
    subjects: Array.from(subjects),
    longestSession: Math.round(longestSession * 10) / 10,
    averageSessionLength: Math.round(averageSessionLength * 10) / 10,
    timeBreakdown: {
      morning: morningSessions,
      afternoon: afternoonSessions,
      evening: eveningSessions,
      night: nightSessions
    },
    mostProductiveTime: mostProductiveTime.name,
    insights,
    sessions: sessions.map(session => ({
      id: session.id,
      subject: session.subject,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.startTime && session.endTime ? 
        Math.round(((session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime)).getTime() - 
        (session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime)).getTime()) / (1000 * 60 * 60) * 10) / 10 : 0,
      notes: session.notes
    }))
  };
};

/**
 * Generate insights based on daily study data
 * @param {Object} stats - Daily statistics
 * @returns {Array} Array of insight strings
 */
const generateInsights = (stats) => {
  const insights = [];
  
  // Study time insights
  if (stats.totalStudyTime === 0) {
    insights.push("No study sessions recorded today. Time to get started!");
  } else if (stats.totalStudyTime < 1) {
    insights.push("Every bit counts! Great work today!");
  } else if (stats.totalStudyTime < 3) {
    // No insight for this range
  } else if (stats.totalStudyTime < 6) {
    insights.push("Excellent work! Your dedication is paying off!");
  } else {
    insights.push("Amazing dedication! You're on fire today!");
  }
  
  // Session count insights
  if (stats.sessionCount > 1) {
    insights.push(`You completed ${stats.sessionCount} study sessions today.`);
  }
  
  // Subject diversity insights
  if (stats.subjects.length > 1) {
    insights.push(`You studied ${stats.subjects.length} different subjects: ${stats.subjects.join(', ')}.`);
  } else if (stats.subjects.length === 1) {
    insights.push(`You focused on ${stats.subjects[0]} today.`);
  }
  
  // Time of day insights
  if (stats.mostProductiveTime !== 'Morning' && stats.mostProductiveTime !== 'Afternoon') {
    insights.push(`You were most productive in the ${stats.mostProductiveTime.toLowerCase()}.`);
  }
  
  // Longest session insights
  if (stats.longestSession > 2) {
    insights.push(`Your longest session was ${stats.longestSession} hours - impressive focus!`);
  }
  
  return insights;
};

/**
 * Get study streak information
 * @param {string} userId - Optional user ID, defaults to current user
 * @returns {Object} Streak information
 */
export const getStudyStreak = async (userId = null) => {
  try {
    const user = userId || auth.currentUser?.uid;
    if (!user) {
      throw new Error("User must be authenticated to get study streak");
    }

    // Get study sessions from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Query without orderBy to avoid index requirement
    const q = query(
      collection(db, STUDY_SESSIONS_COLLECTION),
      where("userId", "==", user),
      where("startTime", ">=", thirtyDaysAgo)
    );

    const querySnapshot = await getDocs(q);
    const sessions = [];
    
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort in JavaScript instead of Firestore
    sessions.sort((a, b) => {
      const dateA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
      const dateB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
      return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
    });

    // Calculate streak
    const streak = calculateStreak(sessions);
    
    return streak;
  } catch (error) {
    console.error("Error getting study streak: ", error);
    throw error;
  }
};

/**
 * Calculate study streak from sessions
 * @param {Array} sessions - Array of study sessions
 * @returns {Object} Streak information
 */
const calculateStreak = (sessions) => {
  // Group sessions by date
  const sessionsByDate = {};
  sessions.forEach(session => {
    const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const dateKey = sessionDate.toDateString();
    
    if (!sessionsByDate[dateKey]) {
      sessionsByDate[dateKey] = [];
    }
    sessionsByDate[dateKey].push(session);
  });

  // Get sorted dates
  const dates = Object.keys(sessionsByDate).sort((a, b) => new Date(b) - new Date(a));
  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if user studied today or yesterday to start streak
  const todayKey = today.toDateString();
  const yesterdayKey = yesterday.toDateString();
  
  if (sessionsByDate[todayKey] || sessionsByDate[yesterdayKey]) {
    currentStreak = 1;
    tempStreak = 1;
    
    // Count consecutive days backwards
    for (let i = 1; i < dates.length; i++) {
      const currentDate = new Date(dates[i]);
      const previousDate = new Date(dates[i - 1]);
      const dayDiff = (previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dayDiff === 1) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 1;
      }
    }
    
    currentStreak = tempStreak;
  }
  
  return {
    currentStreak,
    longestStreak,
    totalStudyDays: dates.length,
    lastStudyDate: dates.length > 0 ? dates[0] : null
  };
};
