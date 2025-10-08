import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit,
  where,
  onSnapshot
} from "firebase/firestore";
import { db, auth } from "./firebaseInit.js";
import { createDailyPost } from "./postService.js";
import { generateDailySummary } from "./dailySummaryService.js";

// Collection name for study sessions
const STUDY_SESSIONS_COLLECTION = "studySessions";

// Save a new study session and automatically create/update daily post
export const saveStudySession = async (sessionData) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to save study sessions");
    }

    const docRef = await addDoc(collection(db, STUDY_SESSIONS_COLLECTION), {
      ...sessionData,
      userId: user.uid, // Link to authenticated user
      // Use the provided createdAt and updatedAt timestamps
      // Only set current time if not provided
      createdAt: sessionData.createdAt || new Date(),
      updatedAt: sessionData.updatedAt || new Date(),
    });
    console.log("Study session saved with ID: ", docRef.id);
    
    // Automatically create/update daily post for today (with session data for optimization)
    try {
      await createOrUpdateDailyPost(user.uid, new Date(), sessionData);
      console.log("✅ Daily post created/updated for session completion");
    } catch (postError) {
      console.error("⚠️ Error creating/updating daily post:", postError);
      // Don't fail the session save if post creation fails
    }
    
    return docRef.id;
  } catch (error) {
    console.error("Error saving study session: ", error);
    throw error;
  }
};

// Get all study sessions for the current user
export const getStudySessions = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to get study sessions");
    }

    // Get all sessions for the user (without orderBy to avoid composite index)
    const q = query(
      collection(db, STUDY_SESSIONS_COLLECTION),
      where("userId", "==", user.uid)
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
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime(); // Descending order
    });
    
    return sessions;
  } catch (error) {
    console.error("Error getting study sessions: ", error);
    throw error;
  }
};

// Get study sessions for a specific user
export const getUserStudySessions = async (userId) => {
  try {
    // Get all sessions for the user (without orderBy to avoid composite index)
    const q = query(
      collection(db, STUDY_SESSIONS_COLLECTION),
      where("userId", "==", userId)
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
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime(); // Descending order
    });
    
    return sessions;
  } catch (error) {
    console.error("Error getting user study sessions: ", error);
    throw error;
  }
};

// Update a study session
export const updateStudySession = async (sessionId, updateData) => {
  try {
    const sessionRef = doc(db, STUDY_SESSIONS_COLLECTION, sessionId);
    await updateDoc(sessionRef, {
      ...updateData,
      updatedAt: new Date(),
    });
    console.log("Study session updated: ", sessionId);
  } catch (error) {
    console.error("Error updating study session: ", error);
    throw error;
  }
};

// Delete a study session
export const deleteStudySession = async (sessionId) => {
  try {
    await deleteDoc(doc(db, STUDY_SESSIONS_COLLECTION, sessionId));
    console.log("Study session deleted: ", sessionId);
  } catch (error) {
    console.error("Error deleting study session: ", error);
    throw error;
  }
};

// Listen to real-time updates for study sessions
export const subscribeToStudySessions = (callback) => {
  const q = query(
    collection(db, STUDY_SESSIONS_COLLECTION),
    limit(50)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort in JavaScript instead of Firestore
    sessions.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime(); // Descending order
    });
    
    callback(sessions);
  });
};

// Get currently active study sessions (for the "Currently Studying" section)
export const getActiveStudySessions = async () => {
  try {
    // Simplified query - just get all sessions for now
    // We'll add filtering and ordering after creating the index
    const querySnapshot = await getDocs(collection(db, STUDY_SESSIONS_COLLECTION));
    const sessions = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter active sessions in JavaScript for now
      if (data.isActive === true) {
        sessions.push({
          id: doc.id,
          ...data
        });
      }
    });
    // Sort by startTime in JavaScript
    sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    return sessions;
  } catch (error) {
    console.error("Error getting active study sessions: ", error);
    throw error;
  }
};

/**
 * Create or update a daily post for the current day (optimized version)
 * @param {string} userId - User ID
 * @param {Date} date - Date to create/update post for
 * @param {Object} newSessionData - Data from the new session (optional, for optimization)
 * @returns {Promise<string|null>} Post ID if created/updated, null if no study time
 */
export const createOrUpdateDailyPost = async (userId, date, newSessionData = null) => {
  try {
    const postId = `${userId}-${date.toDateString()}`;
    const { getDoc, doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebaseInit.js');
    const postRef = doc(db, 'posts', postId);
    
    // Check if post already exists
    const existingPost = await getDoc(postRef);
    
    if (existingPost.exists()) {
      // OPTIMIZATION: If we have new session data, update incrementally
      if (newSessionData) {
        const currentData = existingPost.data();
        const updatedData = await updatePostIncrementally(currentData, newSessionData);
        
        await setDoc(postRef, {
          ...updatedData,
          updatedAt: new Date()
        }, { merge: true });
        
        console.log('📝 Daily post updated incrementally:', postId);
        return postId;
      }
    }
    
    // Fallback: Generate full daily summary (slower but accurate)
    const summary = await generateDailySummary(date, userId);
    
    if (summary.totalStudyTime > 0) {
      if (existingPost.exists()) {
        // Update existing post with new data
        const { updatePost } = await import('./postService.js');
        await updatePost(postId, {
          totalStudyTime: summary.totalStudyTime,
          sessionCount: summary.sessionCount,
          subjects: summary.subjects,
          longestSession: summary.longestSession,
          insights: summary.insights,
          updatedAt: new Date()
        });
        console.log('📝 Daily post updated:', postId);
      } else {
        // Create new post
        const postId = await createDailyPost(userId, date, summary);
        console.log('✅ Daily post created:', postId);
      }
      
      return postId;
    }
    
    console.log('No study time for date, skipping post creation/update');
    return null;
  } catch (error) {
    console.error('❌ Error creating/updating daily post:', error);
    throw error;
  }
};

/**
 * Update post data incrementally with new session (much faster)
 * @param {Object} currentPostData - Current post data
 * @param {Object} newSessionData - New session data
 * @returns {Object} Updated post data
 */
const updatePostIncrementally = async (currentPostData, newSessionData) => {
  // Calculate new session duration
  const sessionDuration = newSessionData.duration ? 
    parseDurationToHours(newSessionData.duration) : 
    calculateSessionDuration(newSessionData);
  
  // Update totals
  const newTotalStudyTime = (currentPostData.totalStudyTime || 0) + sessionDuration;
  const newSessionCount = (currentPostData.sessionCount || 0) + 1;
  
  // Update subjects
  const currentSubjects = currentPostData.subjects || [];
  const newSubjects = newSessionData.subject ? 
    [...new Set([...currentSubjects, newSessionData.subject])] : 
    currentSubjects;
  
  // Update longest session
  const newLongestSession = Math.max(
    currentPostData.longestSession || 0, 
    sessionDuration
  );
  
  // Generate simple insights (avoiding heavy computation)
  const insights = generateSimpleInsights(newTotalStudyTime, newSessionCount, newSubjects);
  
  return {
    totalStudyTime: Math.round(newTotalStudyTime * 10) / 10,
    sessionCount: newSessionCount,
    subjects: newSubjects,
    longestSession: Math.round(newLongestSession * 10) / 10,
    insights
  };
};

/**
 * Parse duration string to hours (e.g., "2:30:00" -> 2.5)
 */
const parseDurationToHours = (durationString) => {
  const parts = durationString.split(':').map(Number);
  return parts[0] + (parts[1] / 60) + (parts[2] / 3600);
};

/**
 * Calculate session duration from start/end times
 */
const calculateSessionDuration = (sessionData) => {
  if (sessionData.startTime && sessionData.endTime) {
    const start = sessionData.startTime?.toDate ? sessionData.startTime.toDate() : new Date(sessionData.startTime);
    const end = sessionData.endTime?.toDate ? sessionData.endTime.toDate() : new Date(sessionData.endTime);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }
  return 0;
};

/**
 * Generate simple insights without heavy computation
 */
const generateSimpleInsights = (totalStudyTime, sessionCount, subjects) => {
  const insights = [];
  
  if (totalStudyTime > 0) {
    insights.push(`Studied for ${Math.round(totalStudyTime * 10) / 10} hours today`);
  }
  
  if (sessionCount > 1) {
    insights.push(`Completed ${sessionCount} study sessions`);
  }
  
  if (subjects.length > 1) {
    insights.push(`Studied ${subjects.length} subjects: ${subjects.join(', ')}`);
  }
  
  return insights;
};

/**
 * Generate a daily post when study sessions end (call this at the end of each day)
 * @param {string} userId - User ID
 * @param {Date} date - Date to generate post for (defaults to yesterday)
 * @returns {Promise<string|null>} Post ID if created, null if no study time
 */
export const generateDailyPost = async (userId, date = null) => {
  try {
    // Default to yesterday if no date provided
    if (!date) {
      date = new Date();
      date.setDate(date.getDate() - 1);
    }
    
    // Generate the daily summary
    const summary = await generateDailySummary(date, userId);
    
    // Only create post if there was actual study time
    if (summary.totalStudyTime > 0) {
      const postId = await createDailyPost(userId, date, summary);
      console.log('✅ Daily post generated:', postId);
      return postId;
    }
    
    console.log('No study time for date, skipping post generation');
    return null;
  } catch (error) {
    console.error('❌ Error generating daily post:', error);
    throw error;
  }
};
