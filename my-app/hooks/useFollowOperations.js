import { useState, useCallback } from 'react';
import { followUser, unfollowUser } from '../firebase/followService';
import { Alert } from 'react-native';

/**
 * Custom hook for managing follow operations with race condition prevention
 * @param {string} currentUserId - Current user ID
 * @returns {object} Follow operation functions and loading states
 */
export const useFollowOperations = (currentUserId) => {
  const [operationStates, setOperationStates] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Follow a user with race condition prevention
   * @param {string} targetUserId - User to follow
   * @param {function} onSuccess - Success callback
   * @param {function} onError - Error callback
   */
  const follow = useCallback(async (targetUserId, onSuccess, onError) => {
    if (!currentUserId || !targetUserId) {
      onError?.('Invalid user IDs');
      return;
    }

    const operationKey = `follow_${targetUserId}`;
    
    // Prevent duplicate operations
    if (operationStates[operationKey] || isLoading) {
      return;
    }

    setOperationStates(prev => ({ ...prev, [operationKey]: true }));
    setIsLoading(true);

    try {
      await followUser(currentUserId, targetUserId);
      onSuccess?.();
    } catch (error) {
      console.error('Follow operation failed:', error);
      onError?.(error.message || 'Failed to follow user');
    } finally {
      setOperationStates(prev => {
        const newState = { ...prev };
        delete newState[operationKey];
        return newState;
      });
      setIsLoading(false);
    }
  }, [currentUserId, operationStates, isLoading]);

  /**
   * Unfollow a user with race condition prevention
   * @param {string} targetUserId - User to unfollow
   * @param {function} onSuccess - Success callback
   * @param {function} onError - Error callback
   */
  const unfollow = useCallback(async (targetUserId, onSuccess, onError) => {
    if (!currentUserId || !targetUserId) {
      onError?.('Invalid user IDs');
      return;
    }

    const operationKey = `unfollow_${targetUserId}`;
    
    // Prevent duplicate operations
    if (operationStates[operationKey] || isLoading) {
      return;
    }

    setOperationStates(prev => ({ ...prev, [operationKey]: true }));
    setIsLoading(true);

    try {
      await unfollowUser(currentUserId, targetUserId);
      onSuccess?.();
    } catch (error) {
      console.error('Unfollow operation failed:', error);
      onError?.(error.message || 'Failed to unfollow user');
    } finally {
      setOperationStates(prev => {
        const newState = { ...prev };
        delete newState[operationKey];
        return newState;
      });
      setIsLoading(false);
    }
  }, [currentUserId, operationStates, isLoading]);

  /**
   * Toggle follow status with race condition prevention
   * @param {string} targetUserId - User to toggle follow status
   * @param {boolean} isCurrentlyFollowing - Current follow status
   * @param {function} onSuccess - Success callback
   * @param {function} onError - Error callback
   */
  const toggleFollow = useCallback(async (targetUserId, isCurrentlyFollowing, onSuccess, onError) => {
    if (isCurrentlyFollowing) {
      await unfollow(targetUserId, onSuccess, onError);
    } else {
      await follow(targetUserId, onSuccess, onError);
    }
  }, [follow, unfollow]);

  return {
    follow,
    unfollow,
    toggleFollow,
    isLoading,
    operationStates
  };
};
