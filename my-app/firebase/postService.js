import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db, auth } from './firebaseInit.js';
import { getFollowing } from './followService.js';

// Collection name for posts
const POSTS_COLLECTION = "posts";

/**
 * Create a daily study post for a user
 * @param {string} userId - User ID
 * @param {Date} date - Date of the study day
 * @param {Object} studyData - Study session data
 * @returns {Promise<string>} Post ID
 */
export const createDailyPost = async (userId, date, studyData) => {
  try {
    // Get user profile data
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : null;
    
    if (!userData) {
      throw new Error('User not found');
    }

    // Create post data
    const postData = {
      userId,
      date: date.toDateString(),
      dateTimestamp: date,
      totalStudyTime: studyData.totalStudyTime,
      sessionCount: studyData.sessionCount,
      subjects: studyData.subjects,
      longestSession: studyData.longestSession,
      insights: studyData.insights,
      userProfile: {
        id: userId,
        displayName: userData.displayName || 'Unknown User',
        username: userData.username || userData.email?.split('@')[0] || 'user',
        profilePicture: userData.profilePictureUrl || null
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create post ID in format: userId-date
    const postId = `${userId}-${date.toDateString()}`;
    const postRef = doc(db, POSTS_COLLECTION, postId);
    
    // Check if post already exists
    const existingPost = await getDoc(postRef);
    if (existingPost.exists()) {
      console.log('📝 Post already exists, skipping:', postId);
      return postId;
    }
    
    // Create new post
    await setDoc(postRef, postData);
    
    console.log('✅ Daily post created:', postId);
    return postId;
  } catch (error) {
    console.error('❌ Error creating daily post:', error);
    throw error;
  }
};

/**
 * Get posts for a specific user
 * @param {string} userId - User ID
 * @param {number} limitCount - Number of posts to fetch
 * @returns {Promise<Array>} Array of posts
 */
export const getUserPosts = async (userId, limitCount = 10) => {
  try {
    const postsQuery = query(
      collection(db, POSTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('dateTimestamp', 'desc'),
      limit(limitCount)
    );

    const postsSnapshot = await getDocs(postsQuery);
    const posts = [];
    
    postsSnapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Fetch current user profile to get updated profile picture
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : null;
    
    // Update profile pictures in all posts with current data
    if (userData) {
      posts.forEach(post => {
        if (post.userProfile) {
          post.userProfile.profilePicture = userData.profilePictureUrl || null;
          post.userProfile.displayName = userData.displayName || post.userProfile.displayName;
          post.userProfile.username = userData.username || post.userProfile.username;
        }
      });
    }

    return posts;
  } catch (error) {
    console.error('❌ Error getting user posts:', error);
    return [];
  }
};

/**
 * Get social feed posts (own + following users)
 * @param {string} userId - Current user ID
 * @param {number} limitCount - Number of posts to fetch
 * @returns {Promise<Array>} Array of posts
 */
export const getSocialFeedPosts = async (userId, limitCount = 10) => {
  try {
    // Get list of users that the current user is following
    const followingUsers = await getFollowing(userId, 100);
    const userIdsToFetch = [userId, ...followingUsers.map(u => u.id)];
    
    // Get posts for all users
    const allPosts = [];
    
    for (const targetUserId of userIdsToFetch) {
      try {
        const userPosts = await getUserPosts(targetUserId, 5); // Get last 5 posts per user
        allPosts.push(...userPosts);
      } catch (error) {
        console.error(`Error fetching posts for user ${targetUserId}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    // Sort all posts by date (newest first)
    allPosts.sort((a, b) => {
      const dateA = a.dateTimestamp?.toDate ? a.dateTimestamp.toDate() : new Date(a.dateTimestamp);
      const dateB = b.dateTimestamp?.toDate ? b.dateTimestamp.toDate() : new Date(b.dateTimestamp);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Return limited results
    return allPosts.slice(0, limitCount);
  } catch (error) {
    console.error('❌ Error getting social feed posts:', error);
    return [];
  }
};

/**
 * Get a specific post by ID
 * @param {string} postId - Post ID
 * @returns {Promise<Object|null>} Post data or null
 */
export const getPostById = async (postId) => {
  try {
    const postDoc = await getDoc(doc(db, POSTS_COLLECTION, postId));
    
    if (postDoc.exists()) {
      return {
        id: postDoc.id,
        ...postDoc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting post by ID:', error);
    return null;
  }
};

/**
 * Update a post (for when study data changes)
 * @param {string} postId - Post ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<boolean>} Success status
 */
export const updatePost = async (postId, updateData) => {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await setDoc(postRef, {
      ...updateData,
      updatedAt: new Date()
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error('❌ Error updating post:', error);
    return false;
  }
};

/**
 * Generate posts for existing study sessions (migration function)
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of created post IDs
 */
export const generatePostsFromExistingSessions = async (userId, days = 7) => {
  try {
    const { generateDailySummary } = await import('./dailySummaryService.js');
    const createdPosts = [];
    
    for (let i = 1; i <= days; i++) { // Start from 1 to skip today
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      try {
        // Generate summary for this date
        const summary = await generateDailySummary(date, userId);
        
        // Only create post if there was study time
        if (summary.totalStudyTime > 0) {
          const postId = await createDailyPost(userId, date, summary);
          createdPosts.push(postId);
          console.log(`✅ Created post for ${date.toDateString()}: ${postId}`);
        }
      } catch (error) {
        console.error(`Error creating post for ${date.toDateString()}:`, error);
        // Continue with other dates
      }
    }
    
    console.log(`✅ Generated ${createdPosts.length} posts for user ${userId}`);
    return createdPosts;
  } catch (error) {
    console.error('❌ Error generating posts from existing sessions:', error);
    throw error;
  }
};

/**
 * Generate posts for ALL users who have study sessions (bulk migration)
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Summary of migration results
 */
export const generatePostsForAllUsers = async (days = 7) => {
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const { db } = await import('./firebaseInit.js');
    const { generateDailySummary } = await import('./dailySummaryService.js');
    
    console.log('🚀 Starting bulk migration for all users...');
    
    // Get all unique user IDs from study sessions
    const sessionsQuery = query(collection(db, 'studySessions'));
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    const userIds = new Set();
    sessionsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });
    
    console.log(`📊 Found ${userIds.size} users with study sessions`);
    
    const results = {
      totalUsers: userIds.size,
      usersProcessed: 0,
      totalPostsCreated: 0,
      errors: []
    };
    
    // Process each user
    for (const userId of userIds) {
      try {
        console.log(`👤 Processing user: ${userId}`);
        const userPosts = await generatePostsFromExistingSessions(userId, days);
        results.usersProcessed++;
        results.totalPostsCreated += userPosts.length;
        console.log(`✅ User ${userId}: Created ${userPosts.length} posts`);
      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
        results.errors.push({ userId, error: error.message });
      }
    }
    
    console.log('🎉 Bulk migration completed!');
    console.log(`📈 Results:`, results);
    
    return results;
  } catch (error) {
    console.error('❌ Error in bulk migration:', error);
    throw error;
  }
};
