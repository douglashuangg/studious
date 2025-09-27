import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebaseInit';

/**
 * Standardized error handler for currently studying operations
 * @param {Error} error - The error object
 * @param {string} context - The operation context
 * @returns {Object} Standardized error response
 */
const handleError = (error, context) => {
  const errorMessage = error.message || 'Unknown error occurred';
  const errorCode = error.code || 'UNKNOWN_ERROR';
  
  console.error(`❌ Error in ${context}:`, {
    message: errorMessage,
    code: errorCode,
    context,
    timestamp: new Date().toISOString()
  });
  
  return {
    error: true,
    message: errorMessage,
    code: errorCode,
    context
  };
};

/**
 * Set a user as currently studying with transaction support
 * @param {string} userId - The user ID
 * @param {string} subject - The subject being studied
 * @param {number} startTime - Timestamp when study session started
 * @param {string} notes - Optional notes about the study session
 * @param {boolean} isPaused - Whether the session is paused
 * @param {number} pausedTime - Total paused time in seconds
 * @param {boolean} useTransaction - Whether to use transaction for atomic operations
 */
export const setCurrentlyStudying = async (userId, subject, startTime, notes = '', isPaused = false, pausedTime = 0, useTransaction = false) => {
  try {
    if (useTransaction) {
      return await runTransaction(db, async (transaction) => {
        const currentlyStudyingRef = doc(db, 'currentlyStudying', userId);
        
        // Check if user is already studying
        const existingDoc = await transaction.get(currentlyStudyingRef);
        if (existingDoc.exists()) {
          throw new Error('User is already studying');
        }
        
        // Set currently studying status
        transaction.set(currentlyStudyingRef, {
          userId,
          subject,
          startTime: new Date(startTime),
          notes,
          isActive: true,
          isPaused,
          pausedTime,
          lastUpdated: serverTimestamp()
        });
        
        // Update user's study stats atomically
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentSessions = userData.totalSessions || 0;
          transaction.update(userRef, {
            totalSessions: currentSessions + 1,
            lastStudyTime: serverTimestamp(),
            lastStudySubject: subject
          });
        }
        
        console.log('✅ User set as currently studying (transaction):', { userId, subject, isPaused });
        return true;
      });
    } else {
      // Original non-transaction approach
      const currentlyStudyingRef = doc(db, 'currentlyStudying', userId);
      
      await setDoc(currentlyStudyingRef, {
        userId,
        subject,
        startTime: new Date(startTime),
        notes,
        isActive: true,
        isPaused,
        pausedTime,
        lastUpdated: serverTimestamp()
      });
      
      console.log('✅ User set as currently studying:', { userId, subject, isPaused });
      return true;
    }
  } catch (error) {
    const errorResponse = handleError(error, 'setCurrentlyStudying');
    throw new Error(errorResponse.message);
  }
};

/**
 * Remove a user from currently studying status with transaction support
 * @param {string} userId - The user ID
 * @param {boolean} useTransaction - Whether to use transaction for atomic operations
 */
export const removeCurrentlyStudying = async (userId, useTransaction = false) => {
  try {
    if (useTransaction) {
      return await runTransaction(db, async (transaction) => {
        const currentlyStudyingRef = doc(db, 'currentlyStudying', userId);
        
        // Get current study session data before deletion
        const currentDoc = await transaction.get(currentlyStudyingRef);
        if (!currentDoc.exists()) {
          console.log('⚠️ User was not currently studying:', userId);
          return true; // Not an error, just nothing to remove
        }
        
        const studyData = currentDoc.data();
        
        // Delete currently studying status
        transaction.delete(currentlyStudyingRef);
        
        // Update user's study stats atomically
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentStreak = userData.studyStreak || 0;
          
          // Calculate study duration
          const startTime = studyData.startTime?.toDate ? studyData.startTime.toDate() : new Date(studyData.startTime);
          const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
          
          transaction.update(userRef, {
            lastStudyDuration: duration,
            lastStudyEndTime: serverTimestamp(),
            studyStreak: currentStreak + 1 // Increment streak on completion
          });
        }
        
        console.log('✅ User removed from currently studying (transaction):', userId);
        return true;
      });
    } else {
      // Original non-transaction approach
      const currentlyStudyingRef = doc(db, 'currentlyStudying', userId);
      await deleteDoc(currentlyStudyingRef);
      
      console.log('✅ User removed from currently studying:', userId);
      return true;
    }
  } catch (error) {
    const errorResponse = handleError(error, 'removeCurrentlyStudying');
    throw new Error(errorResponse.message);
  }
};

/**
 * Get currently studying status for a specific user
 * @param {string} userId - The user ID
 * @returns {Object|null} Currently studying data or null if not studying
 */
export const getCurrentlyStudyingStatus = async (userId) => {
  try {
    const currentlyStudyingRef = doc(db, 'currentlyStudying', userId);
    const docSnap = await getDoc(currentlyStudyingRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        startTime: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime)
      };
    }
    
    return null;
  } catch (error) {
    const errorResponse = handleError(error, 'getCurrentlyStudyingStatus');
    console.error('❌ Error getting currently studying status:', errorResponse);
    return null;
  }
};

/**
 * Get all users that the current user follows who are currently studying
 * @param {string} currentUserId - The current user's ID
 * @param {Array} followingUserIds - Array of user IDs that the current user follows
 * @returns {Array} Array of currently studying users with their details
 */
export const getCurrentlyStudyingFromFollowing = async (currentUserId, followingUserIds) => {
  try {
    if (!followingUserIds || followingUserIds.length === 0) {
      return [];
    }

    // Get currently studying status for all followed users
    const currentlyStudyingPromises = followingUserIds.map(async (userId) => {
      const status = await getCurrentlyStudyingStatus(userId);
      if (status && status.isActive) {
        // Get user details
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return {
            ...status,
            user: {
              id: userId,
              displayName: userData.displayName || 'Unknown User',
              username: userData.username || userData.email?.split('@')[0] || 'user',
              profilePicture: userData.profilePictureUrl || null,
              bio: userData.bio || ''
            }
          };
        }
      }
      return null;
    });

    const results = await Promise.all(currentlyStudyingPromises);
    const currentlyStudyingUsers = results.filter(result => result !== null);

    // Sort by start time (most recent first)
    currentlyStudyingUsers.sort((a, b) => {
      return b.startTime.getTime() - a.startTime.getTime();
    });

    return currentlyStudyingUsers;
  } catch (error) {
    const errorResponse = handleError(error, 'getCurrentlyStudyingFromFollowing');
    console.error('❌ Error getting currently studying from following:', errorResponse);
    return [];
  }
};

/**
 * Get real-time updates for currently studying users
 * @param {string} currentUserId - The current user's ID
 * @param {Array} followingUserIds - Array of user IDs that the current user follows
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCurrentlyStudying = (currentUserId, followingUserIds, callback) => {
  try {
    if (!followingUserIds || followingUserIds.length === 0) {
      callback([]);
      return () => {};
    }

    // Optimized query using 'in' operator for better performance
    const currentlyStudyingRef = collection(db, 'currentlyStudying');
    const q = query(
      currentlyStudyingRef,
      where('isActive', '==', true),
      where('userId', 'in', followingUserIds)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const currentlyStudyingUsers = [];
        
        // Batch fetch all user data to avoid N+1 queries
        const userIds = snapshot.docs.map(doc => doc.data().userId);
        if (userIds.length === 0) {
          callback([]);
          return;
        }

        // Batch fetch user details
        const userRefs = userIds.map(userId => doc(db, 'users', userId));
        const userSnaps = await Promise.all(userRefs.map(ref => getDoc(ref)));
        
        // Create user data map for O(1) lookup
        const userDataMap = new Map();
        userSnaps.forEach((userSnap, index) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            userDataMap.set(userIds[index], {
              displayName: userData.displayName || 'Unknown User',
              username: userData.username || userData.email?.split('@')[0] || 'user',
              profilePicture: userData.profilePictureUrl || null,
              bio: userData.bio || ''
            });
          }
        });

        // Process currently studying users
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const userData = userDataMap.get(data.userId);
          
          if (userData) {
            currentlyStudyingUsers.push({
              id: docSnap.id,
              ...data,
              startTime: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime),
              user: {
                id: data.userId,
                ...userData
              }
            });
          }
        }

        // Sort by start time (most recent first)
        currentlyStudyingUsers.sort((a, b) => {
          return b.startTime.getTime() - a.startTime.getTime();
        });

        callback(currentlyStudyingUsers);
      } catch (error) {
        const errorResponse = handleError(error, 'subscribeToCurrentlyStudying-dataProcessing');
        console.error('❌ Error processing currently studying data:', errorResponse);
        callback([]);
      }
    }, (error) => {
      const errorResponse = handleError(error, 'subscribeToCurrentlyStudying-snapshot');
      console.error('❌ Error in currently studying subscription:', errorResponse);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    const errorResponse = handleError(error, 'subscribeToCurrentlyStudying-setup');
    console.error('❌ Error setting up currently studying subscription:', errorResponse);
    callback([]);
    return () => {};
  }
};

/**
 * Calculate elapsed time for a currently studying session
 * @param {Date} startTime - When the study session started
 * @param {boolean} isPaused - Whether the session is currently paused
 * @param {number} pausedTime - Total paused time in seconds
 * @returns {Object} Object with formatted time information
 */
export const calculateElapsedTime = (startTime, isPaused = false, pausedTime = 0) => {
  const now = new Date();
  const totalElapsedMs = now.getTime() - startTime.getTime();
  const totalElapsedSeconds = Math.floor(totalElapsedMs / 1000);
  
  // Subtract paused time to get actual study time
  const elapsedSeconds = Math.max(0, totalElapsedSeconds - pausedTime);
  
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  
  let formattedTime = '';
  if (hours > 0) {
    formattedTime = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    formattedTime = `${minutes}m ${seconds}s`;
  } else {
    formattedTime = `${seconds}s`;
  }
  
  // Add break indicator if paused
  if (isPaused) {
    formattedTime += '\nbreak ☕';
  }
  
  return {
    elapsedSeconds,
    formattedTime,
    hours,
    minutes,
    seconds,
    isPaused
  };
};
