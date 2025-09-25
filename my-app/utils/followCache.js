/**
 * Simple in-memory cache for follow status
 * In production, consider using AsyncStorage or a more robust caching solution
 */
class FollowCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes TTL
  }

  /**
   * Get cached follow status
   * @param {string} key - Cache key (userId_followingUserId)
   * @returns {boolean|null} - Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set cached follow status
   * @param {string} key - Cache key
   * @param {boolean} value - Follow status
   */
  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache for a specific user
   * @param {string} userId - User ID to invalidate
   */
  invalidateUser(userId) {
    const keysToDelete = [];
    for (const [key] of this.cache) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size (for debugging)
   */
  size() {
    return this.cache.size;
  }
}

// Export singleton instance
export const followCache = new FollowCache();
