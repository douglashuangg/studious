import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import {
  toggleLike,
  getUserLikedPosts,
  getLikeCounts,
  subscribeToUserLikes,
  subscribeToLikeUpdates,
  getPostLikers,
  subscribeToPostLikers
} from '../firebase/likeService';

interface Liker {
  likeId: string;
  userId: string;
  likedAt: any;
  user: {
    id: string;
    displayName: string;
    username: string;
    profilePicture: string | null;
    email: string | null;
  };
}

interface UseLikesReturn {
  likedPosts: Set<string>;
  likeCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  toggleLikePost: (postId: string) => Promise<{ success: boolean; error?: string; liked?: boolean }>;
  isPostLiked: (postId: string) => boolean;
  getPostLikeCount: (postId: string) => number;
  refreshLikes: () => Promise<void>;
  clearError: () => void;
  getPostLikers: (postId: string) => Promise<Liker[]>;
  subscribeToPostLikers: (postId: string, callback: (likers: Liker[]) => void) => () => void;
}

/**
 * Custom hook for managing likes functionality
 * @param postIds - Array of post IDs to track likes for
 * @returns Likes state and functions
 */
export const useLikes = (postIds: string[] = []): UseLikesReturn => {
  const { user } = useAuth();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial likes data
  useEffect(() => {
    if (!user || postIds.length === 0) {
      setLoading(false);
      return;
    }

    const loadLikesData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get user's liked posts and like counts in parallel
        const [userLikedPosts, counts] = await Promise.all([
          getUserLikedPosts(user.uid),
          getLikeCounts(postIds)
        ]);

        setLikedPosts(new Set(userLikedPosts));
        setLikeCounts(counts);
      } catch (err: any) {
        console.error('❌ Error loading likes data:', err);
        setError(err.message || 'Failed to load likes data');
      } finally {
        setLoading(false);
      }
    };

    loadLikesData();
  }, [user, postIds.join(',')]);

  // Subscribe to real-time like updates
  useEffect(() => {
    if (!user || postIds.length === 0) return;

    const unsubscribeFunctions: (() => void)[] = [];

    // Subscribe to user's liked posts changes
    const unsubscribeUserLikes = subscribeToUserLikes(user.uid, (updatedLikedPosts: string[]) => {
      setLikedPosts(new Set(updatedLikedPosts));
    });
    unsubscribeFunctions.push(unsubscribeUserLikes);

    // Subscribe to like count updates for each post
    postIds.forEach(postId => {
      const unsubscribeLikeCount = subscribeToLikeUpdates(postId, (count: number) => {
        setLikeCounts(prev => ({
          ...prev,
          [postId]: count
        }));
      });
      unsubscribeFunctions.push(unsubscribeLikeCount);
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [user, postIds.join(',')]);

  /**
   * Toggle like status for a post
   * @param postId - The post ID to toggle like for
   * @returns Result of the toggle operation
   */
  const toggleLikePost = useCallback(async (postId: string) => {
    if (!user) {
      return {
        success: false,
        error: 'User must be authenticated to like posts'
      };
    }

    try {
      // Optimistic update
      const isCurrentlyLiked = likedPosts.has(postId);
      const currentCount = likeCounts[postId] || 0;
      
      // Update UI immediately
      setLikedPosts(prev => {
        const newLikedPosts = new Set(prev);
        if (isCurrentlyLiked) {
          newLikedPosts.delete(postId);
        } else {
          newLikedPosts.add(postId);
        }
        return newLikedPosts;
      });

      setLikeCounts(prev => ({
        ...prev,
        [postId]: isCurrentlyLiked ? currentCount - 1 : currentCount + 1
      }));

      // Add haptic feedback
      if (isCurrentlyLiked) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Perform the actual toggle in Firebase
      const result = await toggleLike(postId, user.uid);

      if (!result.success) {
        // Revert optimistic update on failure
        setLikedPosts(prev => {
          const newLikedPosts = new Set(prev);
          if (isCurrentlyLiked) {
            newLikedPosts.add(postId);
          } else {
            newLikedPosts.delete(postId);
          }
          return newLikedPosts;
        });

        setLikeCounts(prev => ({
          ...prev,
          [postId]: currentCount
        }));

        setError(result.error || 'Failed to toggle like');
      }

      return result;
    } catch (err: any) {
      console.error('❌ Error toggling like:', err);
      
      // Revert optimistic update
      const isCurrentlyLiked = likedPosts.has(postId);
      const currentCount = likeCounts[postId] || 0;
      
      setLikedPosts(prev => {
        const newLikedPosts = new Set(prev);
        if (isCurrentlyLiked) {
          newLikedPosts.add(postId);
        } else {
          newLikedPosts.delete(postId);
        }
        return newLikedPosts;
      });

      setLikeCounts(prev => ({
        ...prev,
        [postId]: currentCount
      }));

      setError(err.message || 'Failed to toggle like');
      
      return {
        success: false,
        error: err.message || 'Failed to toggle like'
      };
    }
  }, [user, likedPosts, likeCounts]);

  /**
   * Check if a post is liked by the current user
   * @param postId - The post ID to check
   * @returns Whether the post is liked
   */
  const isPostLiked = useCallback((postId: string): boolean => {
    return likedPosts.has(postId);
  }, [likedPosts]);

  /**
   * Get like count for a specific post
   * @param postId - The post ID to get count for
   * @returns Like count
   */
  const getPostLikeCount = useCallback((postId: string): number => {
    return likeCounts[postId] || 0;
  }, [likeCounts]);

  /**
   * Refresh likes data
   */
  const refreshLikes = useCallback(async (): Promise<void> => {
    if (!user || postIds.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const [userLikedPosts, counts] = await Promise.all([
        getUserLikedPosts(user.uid),
        getLikeCounts(postIds)
      ]);

      setLikedPosts(new Set(userLikedPosts));
      setLikeCounts(counts);
    } catch (err: any) {
      console.error('❌ Error refreshing likes:', err);
      setError(err.message || 'Failed to refresh likes');
    } finally {
      setLoading(false);
    }
  }, [user, postIds.join(',')]);

  /**
   * Get users who liked a specific post
   * @param postId - The post ID to get likers for
   * @returns Promise with array of likers
   */
  const getPostLikersWrapper = useCallback(async (postId: string): Promise<Liker[]> => {
    try {
      return await getPostLikers(postId);
    } catch (err: any) {
      console.error('❌ Error getting post likers:', err);
      setError(err.message || 'Failed to get likers');
      return [];
    }
  }, []);

  /**
   * Subscribe to real-time likers updates for a post
   * @param postId - The post ID to subscribe to
   * @param callback - Callback function for updates
   * @returns Unsubscribe function
   */
  const subscribeToPostLikersWrapper = useCallback((postId: string, callback: (likers: Liker[]) => void) => {
    return subscribeToPostLikers(postId, callback);
  }, []);

  return {
    // State
    likedPosts,
    likeCounts,
    loading,
    error,
    
    // Functions
    toggleLikePost,
    isPostLiked,
    getPostLikeCount,
    refreshLikes,
    getPostLikers: getPostLikersWrapper,
    subscribeToPostLikers: subscribeToPostLikersWrapper,
    
    // Utilities
    clearError: () => setError(null)
  };
};
