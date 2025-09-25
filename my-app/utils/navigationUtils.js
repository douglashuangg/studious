import { router } from 'expo-router';

/**
 * Navigation utility for context-aware back navigation
 * @param {string} returnTo - The context to return to
 * @param {string} userId - User ID for external profile navigation
 * @param {object} additionalParams - Additional parameters to pass
 */
export const navigateBack = (returnTo, userId = null, additionalParams = {}) => {
  const routes = {
    'external-profile': `/user-profile/external-user-profile?id=${userId}`,
    'search': '/search',
    'profile': '/profile',
    'followers': userId ? `/followers?userId=${userId}` : '/followers',
    'following': userId ? `/following?userId=${userId}` : '/following',
    'statistics': '/statistics'
  };

  const route = routes[returnTo];
  
  if (route) {
    const params = { ...additionalParams };
    if (userId) params.id = userId;
    
    // If we're navigating back to external-profile, preserve the originalReturnTo context
    if (returnTo === 'external-profile' && additionalParams.originalReturnTo) {
      params.originalReturnTo = additionalParams.originalReturnTo;
    }
    
    router.push({
      pathname: route.split('?')[0],
      params: params
    });
  } else {
    router.back();
  }
};

/**
 * Navigate to external user profile with return context
 * @param {string} userId - Target user ID
 * @param {string} returnTo - Context to return to
 * @param {string} originalReturnTo - Original return context for chained navigation
 */
export const navigateToExternalProfile = (userId, returnTo = null, originalReturnTo = null) => {
  const params = { id: userId };
  if (returnTo) params.returnTo = returnTo;
  if (originalReturnTo) params.originalReturnTo = originalReturnTo;
  
  router.push({
    pathname: '/user-profile/external-user-profile',
    params: params
  });
};

/**
 * Navigate to followers list with return context
 * @param {string} userId - Target user ID
 * @param {string} returnTo - Context to return to
 */
export const navigateToFollowers = (userId, returnTo = null) => {
  const params = { userId };
  if (returnTo) params.returnTo = returnTo;
  
  router.push({
    pathname: '/followers',
    params: params
  });
};

/**
 * Navigate to following list with return context
 * @param {string} userId - Target user ID
 * @param {string} returnTo - Context to return to
 */
export const navigateToFollowing = (userId, returnTo = null) => {
  const params = { userId };
  if (returnTo) params.returnTo = returnTo;
  
  router.push({
    pathname: '/following',
    params: params
  });
};

/**
 * Navigate to statistics page with return context
 * @param {string} returnTo - Context to return to
 */
export const navigateToStatistics = (returnTo = null) => {
  const params = {};
  if (returnTo) params.returnTo = returnTo;
  
  router.push({
    pathname: '/statistics',
    params: params
  });
};
