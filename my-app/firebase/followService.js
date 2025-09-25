import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  addDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db } from './firebaseInit';
import { followCache } from '../utils/followCache';

// Follow a user
export const followUser = async (currentUserId, targetUserId) => {
  // Input validation
  if (!currentUserId || !targetUserId) {
    throw new Error('Invalid user IDs provided');
  }
  
  if (currentUserId === targetUserId) {
    throw new Error('Cannot follow yourself');
  }

  try {
    const followRef = doc(db, 'follows', `${currentUserId}_${targetUserId}`);
    
    // Check if already following
    const followDoc = await getDoc(followRef);
    if (followDoc.exists()) {
      throw new Error('Already following this user');
    }

    // Create follow relationship
    await setDoc(followRef, {
      followerId: currentUserId,
      followingId: targetUserId,
      createdAt: new Date(),
    });

    // Update follower count for target user
    const targetUserRef = doc(db, 'users', targetUserId);
    await updateDoc(targetUserRef, {
      followerCount: increment(1)
    });

    // Update following count for current user
    const currentUserRef = doc(db, 'users', currentUserId);
    await updateDoc(currentUserRef, {
      followingCount: increment(1)
    });

    // Update cache
    const cacheKey = `${currentUserId}_${targetUserId}`;
    followCache.set(cacheKey, true);
    followCache.invalidateUser(currentUserId);
    followCache.invalidateUser(targetUserId);

    return true;
  } catch (error) {
    console.error('❌ Error following user:', error);
    throw error;
  }
};

// Unfollow a user
export const unfollowUser = async (currentUserId, targetUserId) => {
  // Input validation
  if (!currentUserId || !targetUserId) {
    throw new Error('Invalid user IDs provided');
  }
  
  if (currentUserId === targetUserId) {
    throw new Error('Cannot unfollow yourself');
  }

  try {
    const followRef = doc(db, 'follows', `${currentUserId}_${targetUserId}`);
    
    // Check if following
    const followDoc = await getDoc(followRef);
    if (!followDoc.exists()) {
      throw new Error('Not following this user');
    }

    // Delete follow relationship
    await deleteDoc(followRef);

    // Update follower count for target user
    const targetUserRef = doc(db, 'users', targetUserId);
    await updateDoc(targetUserRef, {
      followerCount: increment(-1)
    });

    // Update following count for current user
    const currentUserRef = doc(db, 'users', currentUserId);
    await updateDoc(currentUserRef, {
      followingCount: increment(-1)
    });

    // Update cache
    const cacheKey = `${currentUserId}_${targetUserId}`;
    followCache.set(cacheKey, false);
    followCache.invalidateUser(currentUserId);
    followCache.invalidateUser(targetUserId);

    return true;
  } catch (error) {
    console.error('❌ Error unfollowing user:', error);
    throw error;
  }
};

// Check if current user is following target user
export const isFollowing = async (currentUserId, targetUserId) => {
  try {
    // Check cache first
    const cacheKey = `${currentUserId}_${targetUserId}`;
    const cachedValue = followCache.get(cacheKey);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // If not in cache, check Firebase
    const followRef = doc(db, 'follows', `${currentUserId}_${targetUserId}`);
    const followDoc = await getDoc(followRef);
    const isFollowing = followDoc.exists();
    
    // Cache the result
    followCache.set(cacheKey, isFollowing);
    
    return isFollowing;
  } catch (error) {
    console.error('❌ Error checking follow status:', error);
    return false;
  }
};

// Get followers of a user
export const getFollowers = async (userId, limitCount = 50) => {
  try {
    // Remove orderBy to avoid index requirement
    const followsQuery = query(
      collection(db, 'follows'),
      where('followingId', '==', userId),
      limit(limitCount)
    );

    const followsSnapshot = await getDocs(followsQuery);
    const followers = [];

    for (const followDoc of followsSnapshot.docs) {
      const followData = followDoc.data();
      const userRef = doc(db, 'users', followData.followerId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        followers.push({
          id: followData.followerId,
          displayName: userData.displayName || 'Unknown User',
          username: userData.username || userData.email?.split('@')[0] || 'user',
          bio: userData.bio || '',
          profilePicture: userData.profilePicture || null,
          followerCount: userData.followerCount || 0,
          followingCount: userData.followingCount || 0,
          followedAt: followData.createdAt
        });
      }
    }

    // Sort by followedAt date in JavaScript (newest first)
    followers.sort((a, b) => {
      const dateA = a.followedAt?.toDate ? a.followedAt.toDate() : new Date(a.followedAt);
      const dateB = b.followedAt?.toDate ? b.followedAt.toDate() : new Date(b.followedAt);
      return dateB.getTime() - dateA.getTime();
    });

    return followers;
  } catch (error) {
    console.error('❌ Error getting followers:', error);
    return [];
  }
};

// Get users that a user is following
export const getFollowing = async (userId, limitCount = 50) => {
  try {
    // Remove orderBy to avoid index requirement
    const followsQuery = query(
      collection(db, 'follows'),
      where('followerId', '==', userId),
      limit(limitCount)
    );

    const followsSnapshot = await getDocs(followsQuery);
    const following = [];

    for (const followDoc of followsSnapshot.docs) {
      const followData = followDoc.data();
      const userRef = doc(db, 'users', followData.followingId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        following.push({
          id: followData.followingId,
          displayName: userData.displayName || 'Unknown User',
          username: userData.username || userData.email?.split('@')[0] || 'user',
          bio: userData.bio || '',
          profilePicture: userData.profilePicture || null,
          followerCount: userData.followerCount || 0,
          followingCount: userData.followingCount || 0,
          followedAt: followData.createdAt
        });
      }
    }

    // Sort by followedAt date in JavaScript (newest first)
    following.sort((a, b) => {
      const dateA = a.followedAt?.toDate ? a.followedAt.toDate() : new Date(a.followedAt);
      const dateB = b.followedAt?.toDate ? b.followedAt.toDate() : new Date(b.followedAt);
      return dateB.getTime() - dateA.getTime();
    });

    return following;
  } catch (error) {
    console.error('❌ Error getting following:', error);
    return [];
  }
};

// Get follower and following counts for a user
export const getFollowCounts = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        followerCount: userData.followerCount || 0,
        followingCount: userData.followingCount || 0
      };
    }
    
    return { followerCount: 0, followingCount: 0 };
  } catch (error) {
    console.error('❌ Error getting follow counts:', error);
    return { followerCount: 0, followingCount: 0 };
  }
};

// Batch check follow status for multiple users
export const batchCheckFollowStatus = async (currentUserId, targetUserIds) => {
  try {
    if (!currentUserId || !targetUserIds || targetUserIds.length === 0) {
      return {};
    }

    // Create batch of follow status checks
    const followChecks = targetUserIds.map(async (targetUserId) => {
      const followRef = doc(db, 'follows', `${currentUserId}_${targetUserId}`);
      const followDoc = await getDoc(followRef);
      return {
        userId: targetUserId,
        isFollowing: followDoc.exists()
      };
    });

    // Execute all checks in parallel
    const results = await Promise.all(followChecks);
    
    // Convert to object for easy lookup
    const followStatusMap = {};
    results.forEach(result => {
      followStatusMap[result.userId] = result.isFollowing;
    });

    return followStatusMap;
  } catch (error) {
    console.error('❌ Error batch checking follow status:', error);
    return {};
  }
};

// Search users by username or display name
export const searchUsers = async (searchTerm, currentUserId, limitCount = 20) => {
  try {
    // Note: This is a basic implementation. For better search, consider using Algolia or similar
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const users = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const userId = doc.id;
      
      // Skip current user
      if (userId === currentUserId) return;
      
      const displayName = userData.displayName || '';
      const username = userData.username || userData.email?.split('@')[0] || '';
      
      if (displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          username.toLowerCase().includes(searchTerm.toLowerCase())) {
        users.push({
          id: userId,
          displayName: displayName,
          username: username,
          bio: userData.bio || '',
          profilePicture: userData.profilePicture || null,
          followerCount: userData.followerCount || 0,
          followingCount: userData.followingCount || 0
        });
      }
    });

    return users.slice(0, limitCount);
  } catch (error) {
    console.error('❌ Error searching users:', error);
    return [];
  }
};
