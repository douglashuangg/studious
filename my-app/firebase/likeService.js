import { 
  collection, 
  doc, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebaseInit';

/**
 * Like a post (daily summary) - Simplified version without complex indexes
 * @param {string} postId - The post ID (format: userId-date)
 * @param {string} userId - The user liking the post
 * @returns {Promise<Object>} Success/error response
 */
export const likePost = async (postId, userId) => {
  try {
    // Get all likes for this post and check if user already liked
    const likesQuery = query(
      collection(db, 'likes'),
      where('postId', '==', postId)
    );
    
    const existingLikes = await getDocs(likesQuery);
    
    // Check if user already liked this post
    const userAlreadyLiked = existingLikes.docs.some(doc => doc.data().userId === userId);
    
    if (userAlreadyLiked) {
      return {
        success: false,
        error: 'Post already liked',
        alreadyLiked: true
      };
    }

    // Add the like
    const likeData = {
      postId,
      userId,
      createdAt: serverTimestamp(),
      likedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'likes'), likeData);
    
    console.log('✅ Post liked successfully:', docRef.id);
    
    return {
      success: true,
      likeId: docRef.id,
      message: 'Post liked successfully'
    };
  } catch (error) {
    console.error('❌ Error liking post:', error);
    return {
      success: false,
      error: error.message || 'Failed to like post'
    };
  }
};

/**
 * Unlike a post - Simplified version
 * @param {string} postId - The post ID
 * @param {string} userId - The user unliking the post
 * @returns {Promise<Object>} Success/error response
 */
export const unlikePost = async (postId, userId) => {
  try {
    // Find the like document
    const likesQuery = query(
      collection(db, 'likes'),
      where('postId', '==', postId)
    );
    
    const likeSnapshot = await getDocs(likesQuery);
    
    // Find the specific like by this user
    const userLikeDoc = likeSnapshot.docs.find(doc => doc.data().userId === userId);
    
    if (!userLikeDoc) {
      return {
        success: false,
        error: 'Post not liked',
        notLiked: true
      };
    }

    // Delete the like document
    await deleteDoc(doc(db, 'likes', userLikeDoc.id));
    
    console.log('✅ Post unliked successfully');
    
    return {
      success: true,
      message: 'Post unliked successfully'
    };
  } catch (error) {
    console.error('❌ Error unliking post:', error);
    return {
      success: false,
      error: error.message || 'Failed to unlike post'
    };
  }
};

/**
 * Toggle like status for a post - Simplified version
 * @param {string} postId - The post ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Success/error response with new like status
 */
export const toggleLike = async (postId, userId) => {
  try {
    // Get all likes for this post
    const likesQuery = query(
      collection(db, 'likes'),
      where('postId', '==', postId)
    );
    
    const likeSnapshot = await getDocs(likesQuery);
    
    // Check if user already liked this post
    const userLikeDoc = likeSnapshot.docs.find(doc => doc.data().userId === userId);
    
    if (userLikeDoc) {
      // Unlike the post
      await deleteDoc(doc(db, 'likes', userLikeDoc.id));
      
      return {
        success: true,
        liked: false,
        message: 'Post unliked successfully'
      };
    } else {
      // Like the post
      const likeData = {
        postId,
        userId,
        createdAt: serverTimestamp(),
        likedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'likes'), likeData);
      
      return {
        success: true,
        liked: true,
        likeId: docRef.id,
        message: 'Post liked successfully'
      };
    }
  } catch (error) {
    console.error('❌ Error toggling like:', error);
    return {
      success: false,
      error: error.message || 'Failed to toggle like'
    };
  }
};

/**
 * Get like count for a specific post - Simplified version
 * @param {string} postId - The post ID
 * @returns {Promise<number>} Like count
 */
export const getLikeCount = async (postId) => {
  try {
    const likeQuery = query(
      collection(db, 'likes'),
      where('postId', '==', postId)
    );
    
    const likeSnapshot = await getDocs(likeQuery);
    return likeSnapshot.size;
  } catch (error) {
    console.error('❌ Error getting like count:', error);
    return 0;
  }
};

/**
 * Get all posts liked by a specific user - Simplified version
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of liked post IDs
 */
export const getUserLikedPosts = async (userId) => {
  try {
    const likedQuery = query(
      collection(db, 'likes'),
      where('userId', '==', userId)
    );
    
    const likedSnapshot = await getDocs(likedQuery);
    
    const likedPosts = [];
    likedSnapshot.forEach((doc) => {
      likedPosts.push(doc.data().postId);
    });
    
    return likedPosts;
  } catch (error) {
    console.error('❌ Error getting user liked posts:', error);
    return [];
  }
};

/**
 * Get like counts for multiple posts - Simplified version
 * @param {Array<string>} postIds - Array of post IDs
 * @returns {Promise<Object>} Object with postId as key and count as value
 */
export const getLikeCounts = async (postIds) => {
  try {
    const likeCounts = {};
    
    // Get like counts for all posts in parallel
    const promises = postIds.map(async (postId) => {
      const count = await getLikeCount(postId);
      likeCounts[postId] = count;
    });
    
    await Promise.all(promises);
    return likeCounts;
  } catch (error) {
    console.error('❌ Error getting like counts:', error);
    return {};
  }
};

/**
 * Subscribe to real-time like updates for a post - Simplified version
 * @param {string} postId - The post ID
 * @param {Function} callback - Callback function for updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToLikeUpdates = (postId, callback) => {
  const likeQuery = query(
    collection(db, 'likes'),
    where('postId', '==', postId)
  );
  
  return onSnapshot(likeQuery, (snapshot) => {
    const likeCount = snapshot.size;
    callback(likeCount);
  }, (error) => {
    console.error('❌ Error in like subscription:', error);
    callback(0);
  });
};

/**
 * Subscribe to user's liked posts - Simplified version
 * @param {string} userId - The user ID
 * @param {Function} callback - Callback function for updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserLikes = (userId, callback) => {
  const likedQuery = query(
    collection(db, 'likes'),
    where('userId', '==', userId)
  );
  
  return onSnapshot(likedQuery, (snapshot) => {
    const likedPosts = [];
    snapshot.forEach((doc) => {
      likedPosts.push(doc.data().postId);
    });
    callback(likedPosts);
  }, (error) => {
    console.error('❌ Error in user likes subscription:', error);
    callback([]);
  });
};

/**
 * Get users who liked a specific post
 * @param {string} postId - The post ID
 * @returns {Promise<Array>} Array of user objects who liked the post
 */
export const getPostLikers = async (postId) => {
  try {
    const likesQuery = query(
      collection(db, 'likes'),
      where('postId', '==', postId)
    );
    
    const likesSnapshot = await getDocs(likesQuery);
    
    const likerIds = [];
    const likerData = [];
    
    likesSnapshot.forEach((doc) => {
      const likeData = doc.data();
      likerIds.push(likeData.userId);
      likerData.push({
        likeId: doc.id,
        userId: likeData.userId,
        likedAt: likeData.likedAt || likeData.createdAt
      });
    });
    
    if (likerIds.length === 0) {
      return [];
    }
    
    // Get user profiles for all likers
    const userPromises = likerIds.map(async (userId) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return {
            id: userId,
            displayName: userData.displayName || 'Unknown User',
            username: userData.username || userData.email?.split('@')[0] || 'user',
            profilePicture: userData.profilePictureUrl || null,
            email: userData.email || null
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        return null;
      }
    });
    
    const userProfiles = await Promise.all(userPromises);
    
    // Combine liker data with user profiles
    const likersWithProfiles = likerData.map((liker, index) => ({
      ...liker,
      user: userProfiles[index]
    })).filter(liker => liker.user !== null);
    
    // Sort by most recent like first
    likersWithProfiles.sort((a, b) => {
      const dateA = a.likedAt?.toDate ? a.likedAt.toDate() : new Date(a.likedAt);
      const dateB = b.likedAt?.toDate ? b.likedAt.toDate() : new Date(b.likedAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    return likersWithProfiles;
  } catch (error) {
    console.error('❌ Error getting post likers:', error);
    return [];
  }
};

/**
 * Subscribe to real-time likers updates for a post
 * @param {string} postId - The post ID
 * @param {Function} callback - Callback function for updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToPostLikers = (postId, callback) => {
  const likesQuery = query(
    collection(db, 'likes'),
    where('postId', '==', postId)
  );
  
  return onSnapshot(likesQuery, async (snapshot) => {
    try {
      const likerIds = [];
      const likerData = [];
      
      snapshot.forEach((doc) => {
        const likeData = doc.data();
        likerIds.push(likeData.userId);
        likerData.push({
          likeId: doc.id,
          userId: likeData.userId,
          likedAt: likeData.likedAt || likeData.createdAt
        });
      });
      
      if (likerIds.length === 0) {
        callback([]);
        return;
      }
      
      // Get user profiles for all likers
      const userPromises = likerIds.map(async (userId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              id: userId,
              displayName: userData.displayName || 'Unknown User',
              username: userData.username || userData.email?.split('@')[0] || 'user',
              profilePicture: userData.profilePictureUrl || null,
              email: userData.email || null
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
          return null;
        }
      });
      
      const userProfiles = await Promise.all(userPromises);
      
      // Combine liker data with user profiles
      const likersWithProfiles = likerData.map((liker, index) => ({
        ...liker,
        user: userProfiles[index]
      })).filter(liker => liker.user !== null);
      
      // Sort by most recent like first
      likersWithProfiles.sort((a, b) => {
        const dateA = a.likedAt?.toDate ? a.likedAt.toDate() : new Date(a.likedAt);
        const dateB = b.likedAt?.toDate ? b.likedAt.toDate() : new Date(b.likedAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      callback(likersWithProfiles);
    } catch (error) {
      console.error('❌ Error in likers subscription:', error);
      callback([]);
    }
  }, (error) => {
    console.error('❌ Error in likers subscription:', error);
    callback([]);
  });
};
