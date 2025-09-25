/**
 * Utility functions for formatting currently studying data
 */

/**
 * Format currently studying user data for home page display
 * @param {Array} currentlyStudyingUsers - Array of currently studying users
 * @returns {Array} Formatted array for home page display
 */
export const formatCurrentlyStudyingForHomePage = (currentlyStudyingUsers) => {
  return currentlyStudyingUsers.map(user => ({
    id: user.user.id,
    name: user.user.displayName || 'Unknown User',
    username: user.user.username || 'user',
    avatar: user.user.profilePicture || `https://via.placeholder.com/60x60/2D5A27/FFFFFF?text=${(user.user.displayName || 'U').charAt(0).toUpperCase()}`,
    subject: user.subject,
    duration: user.elapsedTime,
    isLive: true, // All currently studying users are "live"
    hasSeen: false, // Could be enhanced with user interaction tracking
    startTime: user.startTime,
    notes: user.notes || ''
  }));
};

/**
 * Get a default avatar URL for a user
 * @param {string} displayName - User's display name
 * @param {string} userId - User's ID
 * @returns {string} Avatar URL
 */
export const getDefaultAvatar = (displayName, userId) => {
  const initial = (displayName || 'U').charAt(0).toUpperCase();
  const colors = ['#2D5A27', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const colorIndex = userId ? userId.charCodeAt(0) % colors.length : 0;
  const color = colors[colorIndex];
  
  return `https://via.placeholder.com/60x60/${color.replace('#', '')}/FFFFFF?text=${initial}`;
};

/**
 * Format time duration for display
 * @param {number} elapsedSeconds - Elapsed time in seconds
 * @returns {string} Formatted time string
 */
export const formatDuration = (elapsedSeconds) => {
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Check if a user has been studying for a significant amount of time
 * @param {number} elapsedSeconds - Elapsed time in seconds
 * @returns {boolean} True if studying for more than 5 minutes
 */
export const isSignificantStudyTime = (elapsedSeconds) => {
  return elapsedSeconds > 300; // 5 minutes
};

/**
 * Get study intensity based on duration
 * @param {number} elapsedSeconds - Elapsed time in seconds
 * @returns {string} Intensity level
 */
export const getStudyIntensity = (elapsedSeconds) => {
  if (elapsedSeconds < 300) return 'just-started'; // Less than 5 minutes
  if (elapsedSeconds < 1800) return 'focused'; // Less than 30 minutes
  if (elapsedSeconds < 3600) return 'deep'; // Less than 1 hour
  return 'marathon'; // More than 1 hour
};
