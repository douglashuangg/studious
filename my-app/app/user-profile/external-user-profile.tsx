import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from '@react-navigation/native';
import { useState, useEffect } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseInit";
import { useAuth } from "../../contexts/AuthContext";
import { followUser, unfollowUser, isFollowing as checkIsFollowing, getFollowers, getFollowing } from "../../firebase/followService";
import { generateRecentDailySummaries } from "../../firebase/dailySummaryService.js";
import { useLikes } from "../../hooks/useLikes";
import { SafeProfileImage } from "../../components/SafeProfileImage";
import LikersModal from "../../components/LikersModal";
import React from 'react';

export default function ExternalUserProfile() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id, returnTo, originalReturnTo } = (route.params as any) || {};
  const { user: currentUser, isNewUser } = useAuth();
  
  // State management
  const [user, setUser] = useState<any>(null);
  const [studySessions, setStudySessions] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dailyPosts, setDailyPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [likersModalVisible, setLikersModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostTitle, setSelectedPostTitle] = useState<string | null>(null);
  const [stats, setStats] = useState({
    studyHours: 0,
    sessions: 0,
    streak: 0
  });

  // Load user data from Firebase
  useEffect(() => {
    const loadUserData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', id as string));
        if (!userDoc.exists()) {
          Alert.alert("User Not Found", "This user doesn't exist.");
          navigation.goBack();
          return;
        }
        
        const userData = userDoc.data();
        setUser({
          id: userDoc.id,
          ...userData,
          avatar: userData.avatar || `https://via.placeholder.com/120x120/2D5A27/FFFFFF?text=${userData.displayName?.charAt(0) || 'U'}`
        });

        // Get study sessions
        const sessionsQuery = query(
          collection(db, 'studySessions'),
          where('userId', '==', id)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const sessions = sessionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudySessions(sessions);

        // Calculate stats using the same method as profile.tsx
        let totalHours = 0;
        
        sessions.forEach((session: any) => {
          if (session.startTime && session.endTime) {
            const start = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const end = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
            const durationMs = end.getTime() - start.getTime();
            totalHours += durationMs / (1000 * 60 * 60); // Convert to hours
          } else if (session.duration) {
            totalHours += session.duration / 3600; // Convert seconds to hours
          }
        });
        
        const studyHours = Math.round(totalHours * 10) / 10;
        const sessionCount = sessions.length;
        
        // Calculate streak (simplified)
        const streak = calculateStreak(sessions);
        
        setStats({
          studyHours,
          sessions: sessionCount,
          streak
        });

        // Get followers and following data
        const [followersData, followingData] = await Promise.all([
          getFollowers(id as string),
          getFollowing(id as string)
        ]);
        setFollowers(followersData);
        setFollowing(followingData);
        
        // Check if current user is following this user
        if (currentUser && currentUser.uid !== id) {
          const followStatus = await checkIsFollowing(currentUser.uid, id as string);
          setIsFollowing(followStatus);
        } else {
          setIsFollowing(false);
        }

      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert("Error", "Failed to load user profile.");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [id, currentUser]);

  // Load user's daily posts - optimized for single user
  useEffect(() => {
    const loadDailyPosts = async () => {
      if (!id) return;
      
      try {
        setPostsLoading(true);
        // Use the optimized single-user function instead of social summaries
        const posts = await generateRecentDailySummaries(7, id as string);
        setDailyPosts(posts);
      } catch (error) {
        console.error('Error loading daily posts:', error);
      } finally {
        setPostsLoading(false);
      }
    };

    loadDailyPosts();
  }, [id]);

  // Get post IDs for likes functionality
  const postIds = dailyPosts.map(post => `${post.userId}-${post.date}`);
  
  // Initialize likes hook
  const {
    toggleLikePost,
    isPostLiked,
    getPostLikeCount,
    loading: likesLoading
  } = useLikes(postIds);

  // Calculate study streak
  const calculateStreak = (sessions: any[]) => {
    if (sessions.length === 0) return 0;
    
    const today = new Date();
    const sortedSessions = sessions
      .map(session => new Date(session.startTime?.toDate() || session.startTime))
      .sort((a, b) => b.getTime() - a.getTime());
    
    let streak = 0;
    let currentDate = new Date(today);
    
    for (const sessionDate of sortedSessions) {
      const sessionDay = new Date(sessionDate);
      sessionDay.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      if (sessionDay.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (sessionDay.getTime() < currentDate.getTime()) {
        break;
      }
    }
    
    return streak;
  };

  // Refresh followers count
  const refreshFollowersCount = async () => {
    try {
      const followersData = await getFollowers(id as string);
      setFollowers(followersData);
    } catch (error) {
      console.error('Error refreshing followers count:', error);
    }
  };

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!currentUser) {
      Alert.alert("Login Required", "You need to be logged in to follow users.");
      return;
    }
    
    if (currentUser.uid === id) {
      Alert.alert("Error", "You can't follow yourself.");
      return;
    }
    
    const previousState = isFollowing;
    
    try {
      // Update UI immediately
      setIsFollowing(!isFollowing);
      
      // Then handle Firebase operation
      if (isFollowing) {
        await unfollowUser(currentUser.uid, id as string);
      } else {
        await followUser(currentUser.uid, id as string);
      }
      
      // Refresh followers count after successful follow/unfollow
      await refreshFollowersCount();
    } catch (error) {
      console.error('Error following user:', error);
      // Revert UI state on error
      setIsFollowing(previousState);
      Alert.alert("Error", "Failed to follow user.");
    }
  };

  // Refresh follow status when page comes into focus
  const refreshFollowStatus = async () => {
    if (!currentUser || !id || currentUser.uid === id) return;
    
    try {
      const followStatus = await checkIsFollowing(currentUser.uid, id as string);
      setIsFollowing(followStatus);
    } catch (error) {
      console.error('Error refreshing follow status:', error);
    }
  };

  // Refresh follow status and followers count when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshFollowStatus();
      refreshFollowersCount();
    }, [currentUser, id])
  );

  // Format time ago
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Format time duration (same as profile.tsx)
  const formatTime = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  // Helper function to format time for display (same as home page)
  const formatTimeForDisplay = (hours: number) => {
    if (hours === 0) return "0h 0m";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    // Handle case where minutes might be 60 or more
    if (minutes >= 60) {
      const additionalHours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${wholeHours + additionalHours}h ${remainingMinutes}m`;
    }
    
    return `${wholeHours}h ${minutes}m`;
  };

  // Helper function to get relative time (same as home page)
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Like handlers (same as home page)
  const handleLike = async (postId: string) => {
    try {
      await toggleLikePost(postId);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShowLikers = (postId: string, postTitle?: string) => {
    setSelectedPostId(postId);
    setSelectedPostTitle(postTitle || null);
    setLikersModalVisible(true);
  };

  const handleCloseLikersModal = () => {
    setLikersModalVisible(false);
    setSelectedPostId(null);
    setSelectedPostTitle(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2D5A27" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Profile Picture and Info */}
      <View style={styles.profileSection}>
        <SafeProfileImage
          uri={user.profilePictureUrl}
          displayName={user.displayName}
          style={styles.profilePicture}
          fallbackStyle={styles.profilePicture}
          textStyle={styles.profilePictureText}
        />
        <Text style={styles.name}>{user.displayName || 'Anonymous User'}</Text>
        <Text style={styles.username}>@{user.username || user.email?.split('@')[0] || 'user'}</Text>
        <Text style={styles.bio}>{user.bio || 'No bio available'}</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.studyHours}</Text>
          <Text style={styles.statLabel}>Study Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.sessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.streak}</Text>
          <Text style={styles.statLabel}>Streak Days</Text>
        </View>
      </View>

      {/* Followers/Following */}
      <View style={styles.followContainer}>
        <TouchableOpacity 
          style={styles.followItem}
          onPress={() => navigation.navigate('Followers', { userId: id, returnTo: 'external-profile', originalReturnTo: returnTo })}
        >
          <Text style={styles.followNumber}>{followers.length}</Text>
          <Text style={styles.followLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.followItem}
          onPress={() => navigation.navigate('Following', { userId: id, returnTo: 'external-profile', originalReturnTo: returnTo })}
        >
          <Text style={styles.followNumber}>{following.length}</Text>
          <Text style={styles.followLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Follow Button - Only show if not current user */}
      {currentUser && currentUser.uid !== id && (
        <View style={styles.followButtonContainer}>
          <TouchableOpacity 
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={handleFollow}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        </View>
      )}


      {/* Daily Posts Section */}
      <View style={styles.dailyPostsContainer}>
        <Text style={styles.sectionTitle}>Daily Study Posts</Text>
        {postsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2D5A27" />
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : dailyPosts.length > 0 ? (
          dailyPosts.map((summary, index) => (
            <TouchableOpacity 
              key={`${summary.userId}-${summary.date}`} 
              style={styles.summaryCard}
              activeOpacity={1}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.summaryUserInfo}>
                  {user.profilePictureUrl ? (
                    <Image 
                      source={{ uri: user.profilePictureUrl }} 
                      style={styles.userAvatar} 
                    />
                  ) : (
                    <View style={[styles.userAvatar, styles.userAvatarInitials]}>
                      <Text style={styles.userAvatarText}>
                        {(() => {
                          const name = user.displayName || 'User';
                          const nameParts = name.split(' ');
                          if (nameParts.length >= 2) {
                            return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
                          }
                          return name.charAt(0).toUpperCase();
                        })()}
                      </Text>
                </View>
                  )}
                  <View style={styles.summaryInfo}>
                    <Text style={styles.summaryName}>
                      {user.displayName || 'Anonymous User'}
                    </Text>
                    <Text style={styles.summaryTime}>
                      {summary.date === new Date().toDateString() ? 'Today' : 
                       summary.date === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString() ? 'Yesterday' :
                       new Date(summary.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </Text>
                  </View>
                </View>
                {summary.totalStudyTime > 0 && (
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={16} color="#FF6B35" />
                    <Text style={styles.streakText}>{summary.sessionCount}</Text>
                  </View>
                )}
              </View>
              
              {summary.totalStudyTime > 0 ? (
                <>
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryTitle}>
                      Studied for <Text style={styles.highlightText}>{formatTimeForDisplay(summary.totalStudyTime)}</Text> across <Text style={styles.highlightText}>{summary.sessionCount} sessions</Text>
                    </Text>
                    
                    {summary.subjects.length > 0 && (
                      <View style={styles.subjectsContainer}>
                        <Text style={styles.subjectsLabel}>Subjects:</Text>
                        <View style={styles.subjectsList}>
                          {summary.subjects.map((subject: string, subjectIndex: number) => (
                            <View key={subjectIndex} style={styles.subjectTag}>
                              <Text style={styles.subjectTagText}>{subject}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {summary.longestSession > 0 && (
                      <View style={styles.statsRow}>
                        <Text style={styles.statLabel}>Longest session:</Text>
                        <Text style={styles.statValue}>{formatTimeForDisplay(summary.longestSession)}</Text>
                      </View>
                    )}


                    <View style={styles.statsRow}>
                      <Text style={styles.statLabel}>Most productive:</Text>
                      <Text style={styles.statValue}>{summary.mostProductiveTime}</Text>
                    </View>
                  </View>

                  {summary.insights && summary.insights.length > 0 && (
                    <View style={styles.insightsContainer}>
                      {summary.insights.map((insight: string, insightIndex: number) => (
                        <Text key={insightIndex} style={styles.insightText}>
                          💡 {insight}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleLike(`${summary.userId}-${summary.date}`)}
                      disabled={likesLoading}
                    >
                      <Ionicons 
                        name={isPostLiked(`${summary.userId}-${summary.date}`) ? "heart" : "heart-outline"} 
                        size={20} 
                        color={isPostLiked(`${summary.userId}-${summary.date}`) ? "#FF3B30" : "#666"} 
                      />
                      <Text style={[
                        styles.actionText,
                        isPostLiked(`${summary.userId}-${summary.date}`) && styles.likedText
                      ]}>
                        Like
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionButton}>
                      <Ionicons name="chatbubble-outline" size={20} color="#666" />
                      <Text style={styles.actionText}>Comment</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionButton}>
                      <Ionicons name="share-outline" size={20} color="#666" />
                      <Text style={styles.actionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Like Count */}
                  {getPostLikeCount(`${summary.userId}-${summary.date}`) > 0 && (
                    <TouchableOpacity 
                      style={styles.likeCountContainer}
                      onPress={() => handleShowLikers(
                        `${summary.userId}-${summary.date}`
                      )}
                    >
                      <Text style={styles.likeCountText}>
                        {getPostLikeCount(`${summary.userId}-${summary.date}`)} Likes
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.noStudyContainer}>
                  <Ionicons name="book-outline" size={32} color="#E5E5EA" />
                  <Text style={styles.noStudyText}>No study time recorded</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={48} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>No study data yet</Text>
            <Text style={styles.emptyMessage}>
              This user hasn't shared any study summaries yet!
            </Text>
          </View>
        )}
      </View>
      
      {/* Likers Modal */}
      <LikersModal
        visible={likersModalVisible}
        onClose={handleCloseLikersModal}
        postId={selectedPostId || ''}
        postTitle={selectedPostTitle || undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 0,
    backgroundColor: "#ffffff",
  },
  backButton: {
    padding: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  moreButton: {
    padding: 8,
  },
  profileSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#E5E5EA",
    marginBottom: 15,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePictureText: {
    fontSize: 40,
    color: "#666",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2D5A27",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 10,
  },
  followContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  followItem: {
    flex: 1,
    alignItems: "center",
  },
  followNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 5,
  },
  followLabel: {
    fontSize: 14,
    color: "#666",
  },
  actionContainer: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  followButton: {
    backgroundColor: "#2D5A27",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  followingButton: {
    backgroundColor: "#E5E5EA",
  },
  followButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  followingButtonText: {
    color: "#666",
  },
  activityContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 15,
  },
  activityItem: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
    justifyContent: "center",
  },
  activityText: {
    fontSize: 16,
    color: "#000",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 14,
    color: "#666",
  },
  followButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: "#2D5A27",
    fontWeight: "600",
  },
  noActivityContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noActivityText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  noActivitySubtext: {
    fontSize: 14,
    color: "#999",
  },
  dailyPostsContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  summaryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  summaryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  summaryTime: {
    fontSize: 12,
    color: "#999",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
    marginLeft: 4,
  },
  summaryContent: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
    marginBottom: 12,
  },
  highlightText: {
    fontWeight: "600",
    color: "#4A7C59",
  },
  subjectsContainer: {
    marginTop: 8,
  },
  subjectsLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginBottom: 8,
  },
  subjectsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  subjectTag: {
    backgroundColor: "#F0F8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0F0E0",
  },
  subjectTagText: {
    fontSize: 12,
    color: "#4A7C59",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A7C59",
  },
  insightsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  insightText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 6,
  },
  likedText: {
    color: "#FF3B30",
  },
  likeCountContainer: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  likeCountText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  noStudyContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noStudyText: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    color: "#666",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyMessage: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userAvatarInitials: {
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#666",
  },
});
