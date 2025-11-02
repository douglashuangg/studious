import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import { useState, useEffect } from "react";
import { getStudySessions } from "../firebase/studySessionService";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import { getFollowCounts, getFollowers, getFollowing } from "../firebase/followService";
import { generateSocialDailySummaries } from "../firebase/dailySummaryService";
import { SafeProfileImage } from "../components/SafeProfileImage";
import { useFocusEffect } from '@react-navigation/native';
import { useLikes } from "../hooks/useLikes";
import LikersModal from "../components/LikersModal";
import { APP_CONFIG } from "../config/appConfig";
import React from 'react';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [studySessions, setStudySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStudyHours, setTotalStudyHours] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [followCounts, setFollowCounts] = useState({ followerCount: 0, followingCount: 0 });
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  
  // State for likers modal
  const [likersModalVisible, setLikersModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostTitle, setSelectedPostTitle] = useState<string | null>(null);
  
  // Get post IDs for likes tracking
  const postIds = userPosts.map(post => `${post.userId}-${post.date}`);
  
  // Likes functionality
  const { 
    toggleLikePost, 
    isPostLiked, 
    getPostLikeCount, 
    refreshLikes,
    loading: likesLoading,
    error: likesError 
  } = useLikes(postIds);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setPostsLoading(true);
        
        // Fetch study sessions
        const sessions = await getStudySessions();
        setStudySessions(sessions);
        calculateStats(sessions);
        
        // Fetch user posts
        if (user) {
          const posts = await fetchUserPosts();
          setUserPosts(posts);
        }
        
        // Fetch user profile data
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data();
            setUserProfile(profileData);
          } else {
          }
          
          // Fetch follow counts
          const counts = await getFollowCounts(user.uid);
          setFollowCounts(counts);
          
          // Fetch followers and following lists
          const [followersData, followingData] = await Promise.all([
            getFollowers(user.uid, 50),
            getFollowing(user.uid, 50)
          ]);
          setFollowers(followersData);
          setFollowing(followingData);
        }
        
        setLoading(false);
        setPostsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
        setPostsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Reload profile data when tab comes into focus (e.g., returning from edit profile)
  useFocusEffect(
    React.useCallback(() => {
      const reloadProfileData = async () => {
        if (user) {
          try {
            // Refresh user profile data
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const profileData = userDoc.data();
              setUserProfile(profileData);
            }
            
            // Refresh follow counts
            const counts = await getFollowCounts(user.uid);
            setFollowCounts(counts);
            
            // Refresh followers and following lists
            const [followersData, followingData] = await Promise.all([
              getFollowers(user.uid, 50),
              getFollowing(user.uid, 50)
            ]);
            setFollowers(followersData);
            setFollowing(followingData);
          } catch (error) {
            console.error('Error reloading profile data:', error);
          }
        }
      };
      reloadProfileData();
    }, [user])
  );


  const calculateStats = (sessions: any[]) => {
    let totalHours = 0;
    let sessionCount = sessions.length;
    
    // Calculate total study hours
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
    
    // Calculate streak days
    const uniqueDays = new Set(sessions.map(session => {
      const date = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
      return date.toDateString();
    }));
    
    setTotalStudyHours(Math.round(totalHours * 10) / 10); // Round to 1 decimal
    setTotalSessions(sessionCount);
    setStreakDays(uniqueDays.size);
  };

  const fetchUserPosts = async () => {
    try {
      if (!user) return [];
      
      // Get social daily summaries (includes own posts)
      const summaries = await generateSocialDailySummaries(30, user.uid, 10);
      
      // Filter to only include own posts
      const ownPosts = summaries.filter(summary => summary.userId === user.uid);
      
      return ownPosts;
    } catch (error) {
      console.error("Error fetching user posts:", error);
      return [];
    }
  };

  const handleShowLikers = (postId: string) => {
    setSelectedPostId(postId);
    setSelectedPostTitle(`Daily Summary - ${new Date().toLocaleDateString()}`);
    setLikersModalVisible(true);
  };

  const handleCloseLikersModal = () => {
    setLikersModalVisible(false);
    setSelectedPostId(null);
    setSelectedPostTitle(null);
  };

  const formatTime = (hours: number) => {
    if (hours === 0) return "0h 0m";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    // Handle case where minutes might be 60 or more
    if (minutes >= 60) {
      const additionalHours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${wholeHours + additionalHours}h ${remainingMinutes}m`;
    }
    
    // If 0 hours, just show minutes
    if (wholeHours === 0) {
      return `${minutes}m`;
    }
    
    return `${wholeHours}h ${minutes}m`;
  };

  const formatTimeForDisplay = (hours: number) => {
    if (hours === 0) return "0h 0m";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    
    return `${wholeHours}h ${minutes}m`;
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const formatTimeRange = (startTime: any, endTime: any) => {
    if (!startTime || !endTime) return "Time not available";
    
    const start = startTime?.toDate ? startTime.toDate() : new Date(startTime);
    const end = endTime?.toDate ? endTime.toDate() : new Date(endTime);
    
    const startTimeStr = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const endTimeStr = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return `${startTimeStr} - ${endTimeStr}`;
  };

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const groupSessionsByDay = (sessions: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    
    sessions.forEach(session => {
      // Use start time for grouping by day, fallback to createdAt if start time not available
      const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : 
                         session.createdAt?.toDate ? session.createdAt.toDate() : 
                         new Date(session.createdAt);
      const dateKey = sessionDate.toDateString();
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(session);
    });
    
    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
    
    return sortedDates.map(dateKey => ({
      date: new Date(dateKey),
      sessions: grouped[dateKey]
    }));
  };


  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  };
  return (
    <View style={styles.container}>
      {/* Alpha Header */}
      {APP_CONFIG.showAlphaBadge && (
        <View style={[styles.betaContainer, { marginTop: insets.top }]}>
            <Text style={styles.betaText}>ALPHA v0.1.0</Text>
        </View>
      )}

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>

      {/* Header with Profile Picture and Followers/Following */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profilePictureContainer}>
            <SafeProfileImage
              uri={userProfile?.profilePictureUrl}
              displayName={userProfile?.displayName}
              style={styles.profilePicture}
              fallbackStyle={styles.profilePicture}
              textStyle={styles.profilePictureText}
            />
          </View>
          
          <View style={styles.followContainer}>
            <TouchableOpacity style={styles.followItem} onPress={() => user?.uid && navigation.navigate('Followers')}>
              <Text style={styles.followNumber}>{followCounts.followerCount}</Text>
              <Text style={styles.followLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.followItem} onPress={() => user?.uid && navigation.navigate('Following')}>
              <Text style={styles.followNumber}>{followCounts.followingCount}</Text>
              <Text style={styles.followLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.name}>
          {userProfile?.displayName || user?.displayName || 'User'}
        </Text>
        {userProfile?.bio && (
          <Text style={styles.bio}>
            {userProfile.bio}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {loading ? "..." : formatTime(totalStudyHours)}
          </Text>
          <Text style={styles.statLabel}>Study Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {loading ? "..." : totalSessions}
          </Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {loading ? "..." : streakDays}
          </Text>
          <Text style={styles.statLabel}>Streak Days</Text>
        </View>
      </View>

      {/* Statistics Button */}
      <TouchableOpacity 
        style={styles.statisticsButton}
        onPress={() => navigation.navigate('Statistics')}
      >
        <View style={styles.statisticsContent}>
          <View style={styles.statisticsLeft}>
            <Ionicons name="analytics" size={24} color="#FF3B30" />
            <View style={styles.statisticsText}>
              <Text style={styles.statisticsTitle}>Statistics</Text>
              <Text style={styles.statisticsSubtitle}>View detailed study analytics</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </View>
      </TouchableOpacity>

      {/* All Activity */}
      <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>All Activity</Text>
        {loading ? (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="calendar" size={20} color="#34C759" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>Loading activity...</Text>
            </View>
          </View>
        ) : studySessions.length > 0 ? (
          groupSessionsByDay(studySessions).map((dayGroup, dayIndex) => (
            <View key={dayGroup.date.toDateString()}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{formatDateHeader(dayGroup.date)}</Text>
              </View>
              {dayGroup.sessions.map((session, sessionIndex) => {
                // Use start time for "time ago" calculation, fallback to createdAt if start time not available
                const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : 
                                  session.createdAt?.toDate ? session.createdAt.toDate() : 
                                  new Date(session.createdAt);
                const timeAgo = getTimeAgo(sessionDate);
                
                let sessionDuration = 0;
                if (session.startTime && session.endTime) {
                  const start = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
                  const end = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
                  const durationMs = end.getTime() - start.getTime();
                  sessionDuration = durationMs / (1000 * 60 * 60); // Convert to hours
                } else if (session.duration) {
                  sessionDuration = session.duration / 3600; // Convert seconds to hours
                }
                
                const timeRange = formatTimeRange(session.startTime, session.endTime);
                
                return (
                  <View key={session.id} style={styles.activityItem}>
                    <View style={styles.activityIcon}>
                      <Ionicons name="book" size={20} color="#2563EB" />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityText}>
                        Studied {session.subject} for {formatTime(sessionDuration)}
                      </Text>
                      <Text style={styles.activityTimeRange}>{timeRange}</Text>
                      <Text style={styles.activityTime}>{timeAgo}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="calendar" size={20} color="#34C759" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>No study sessions yet</Text>
              <Text style={styles.activityTime}>Start studying to see your activity here!</Text>
            </View>
          </View>
        )}
      </View>

      {/* My Posts */}
      <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>My Posts</Text>
        {postsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A7C59" />
            <Text style={styles.loadingText}>Loading your posts...</Text>
          </View>
        ) : userPosts.length > 0 ? (
          userPosts.map((summary, index) => (
            <View 
              key={`${summary.userId}-${summary.date}`} 
              style={styles.summaryCard}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.summaryUserInfo}>
                  {summary.userProfile?.profilePicture ? (
                    <Image 
                      source={{ uri: summary.userProfile.profilePicture }} 
                      style={styles.userAvatar} 
                    />
                  ) : (
                    <View style={[styles.userAvatar, styles.userAvatarInitials]}>
                      <Text style={styles.userAvatarText}>
                        {(() => {
                          const name = summary.userProfile?.displayName || 'User';
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
                      You
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
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => {
                    // Navigate to post detail screen
                    navigation.navigate('PostDetail', { 
                      postId: `${summary.userId}-${summary.date}`,
                      postTitle: "Your Study Day"
                    });
                  }}
                >
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
                      onPress={() => toggleLikePost(`${summary.userId}-${summary.date}`)}
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
                      onPress={() => handleShowLikers(`${summary.userId}-${summary.date}`)}
                    >
                      <Text style={styles.likeCountText}>
                        {getPostLikeCount(`${summary.userId}-${summary.date}`)} Likes
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.noStudyContainer}>
                  <Ionicons name="book-outline" size={32} color="#E5E5EA" />
                  <Text style={styles.noStudyText}>No study time recorded</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="document-text" size={20} color="#34C759" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>No posts yet</Text>
              <Text style={styles.activityTime}>Complete study sessions to see your posts here!</Text>
            </View>
          </View>
        )}
      </View>
      
      </ScrollView>
      
      {/* Likers Modal */}
      <LikersModal
        visible={likersModalVisible}
        onClose={handleCloseLikersModal}
        postId={selectedPostId || ''}
        postTitle={selectedPostTitle || undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "#f8f9fa",
  },
  profilePictureContainer: {
    position: "relative",
    marginBottom: 15,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    marginBottom: 0,
    fontFamily: "System",
  },
  username: {
    fontSize: 14,
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
    backgroundColor: "#f8f9fa",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 5,
    borderRadius: 16,
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
    color: "#000000",
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
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  followContainer: {
    flexDirection: "row",
    marginLeft: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flex: 1,
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
  actionsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 0,
    gap: 12,
  },
  editProfileButton: {
    alignSelf: "center",
    backgroundColor: "#F0F0F0",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D0D0D0",
  },
  editProfileText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },
  settingsButton: {
    backgroundColor: "#f8f9fa",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  statisticsButton: {
    backgroundColor: "#f8f9fa",
    marginHorizontal: 20,
    marginTop: 5,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statisticsContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statisticsLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statisticsText: {
    marginLeft: 12,
    flex: 1,
  },
  statisticsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 2,
  },
  statisticsSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  activityContainer: {
    marginHorizontal: 20,
    marginTop: 10,
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
    backgroundColor: "#fafbfc",
    padding: 15,
    borderRadius: 12,
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
  activityTimeRange: {
    fontSize: 13,
    color: "#888",
    marginBottom: 2,
  },
  dayHeader: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 15,
    marginBottom: 8,
    borderRadius: 8,
  },
  dayHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  betaContainer: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  betaText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  // Home page post styles (copied from index.tsx)
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
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666666",
    textAlign: "center",
    lineHeight: 40,
  },
  userAvatarInitials: {
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
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
    color: "#333",
    fontWeight: "600",
  },
  insightsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  insightText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 4,
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
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    marginTop: 12,
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
    fontWeight: "500",
  },
  likedText: {
    color: "#FF3B30",
    fontWeight: "600",
  },
  likeCountContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "flex-start",
  },
  likeCountText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
});