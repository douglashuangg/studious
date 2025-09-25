import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFollowing } from '../firebase/followService';
import { 
  getCurrentlyStudyingFromFollowing, 
  subscribeToCurrentlyStudying,
  calculateElapsedTime 
} from '../firebase/currentlyStudyingService';

/**
 * Custom hook to get currently studying users from followers
 * @returns {Object} Object containing currently studying users and loading state
 */
export const useCurrentlyStudying = () => {
  const { user } = useAuth();
  const [currentlyStudyingUsers, setCurrentlyStudyingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setCurrentlyStudyingUsers([]);
      setLoading(false);
      return;
    }

    let unsubscribe = null;

    const loadCurrentlyStudying = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get list of users that current user is following
        const following = await getFollowing(user.uid);
        const followingUserIds = following.map(user => user.id);

        if (followingUserIds.length === 0) {
          setCurrentlyStudyingUsers([]);
          setLoading(false);
          return;
        }

        // Set up real-time subscription for currently studying users
        unsubscribe = subscribeToCurrentlyStudying(
          user.uid,
          followingUserIds,
          (studyingUsers) => {
            // Add elapsed time calculation to each user
            const usersWithElapsedTime = studyingUsers.map(studyingUser => {
              const elapsedTime = calculateElapsedTime(
                studyingUser.startTime, 
                studyingUser.isPaused || false, 
                studyingUser.pausedTime || 0
              );
              return {
                ...studyingUser,
                elapsedTime: elapsedTime.formattedTime,
                elapsedSeconds: elapsedTime.elapsedSeconds,
                isPaused: elapsedTime.isPaused
              };
            });

            setCurrentlyStudyingUsers(usersWithElapsedTime);
            setLoading(false);
          }
        );

      } catch (err) {
        console.error('❌ Error loading currently studying users:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadCurrentlyStudying();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Update elapsed times every minute for real-time display
  useEffect(() => {
    if (currentlyStudyingUsers.length === 0) return;

    const interval = setInterval(() => {
      setCurrentlyStudyingUsers(prevUsers => 
        prevUsers.map(user => {
          const elapsedTime = calculateElapsedTime(
            user.startTime, 
            user.isPaused || false, 
            user.pausedTime || 0
          );
          return {
            ...user,
            elapsedTime: elapsedTime.formattedTime,
            elapsedSeconds: elapsedTime.elapsedSeconds,
            isPaused: elapsedTime.isPaused
          };
        })
      );
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [currentlyStudyingUsers.length]); // Fixed: Use length instead of the array itself

  return {
    currentlyStudyingUsers,
    loading,
    error,
    refresh: async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        setError(null); // Clear previous errors
        const following = await getFollowing(user.uid);
        const followingUserIds = following.map(user => user.id);
        
        if (followingUserIds.length > 0) {
          const studyingUsers = await getCurrentlyStudyingFromFollowing(user.uid, followingUserIds);
          const usersWithElapsedTime = studyingUsers.map(studyingUser => {
            const elapsedTime = calculateElapsedTime(
              studyingUser.startTime,
              studyingUser.isPaused || false,
              studyingUser.pausedTime || 0
            );
            return {
              ...studyingUser,
              elapsedTime: elapsedTime.formattedTime,
              elapsedSeconds: elapsedTime.elapsedSeconds,
              isPaused: elapsedTime.isPaused
            };
          });
          setCurrentlyStudyingUsers(usersWithElapsedTime);
        } else {
          setCurrentlyStudyingUsers([]);
        }
      } catch (err) {
        console.error('❌ Error refreshing currently studying users:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };
};

/**
 * Hook to get currently studying users with a simpler interface
 * @returns {Array} Array of currently studying users
 */
export const useCurrentlyStudyingSimple = () => {
  const { currentlyStudyingUsers, loading } = useCurrentlyStudying();
  
  return {
    users: currentlyStudyingUsers,
    loading
  };
};
