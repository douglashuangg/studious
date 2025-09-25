import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseInit";
import { useAuth } from "../../contexts/AuthContext";
import { followUser, unfollowUser, isFollowing as checkIsFollowing, getFollowers, getFollowing } from "../../firebase/followService";
import { navigateBack } from "../../utils/navigationUtils";
import React from 'react';

export default function ExternalUserProfile() {
  const { id, returnTo, originalReturnTo } = useLocalSearchParams();
  const router = useRouter();
  const { user: currentUser, isNewUser } = useAuth();
  
  // State management
  const [user, setUser] = useState<any>(null);
  const [studySessions, setStudySessions] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
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
          router.back();
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (returnTo && typeof returnTo === 'string') {
              navigateBack(returnTo, id as string);
            } else if (originalReturnTo && typeof originalReturnTo === 'string') {
              navigateBack(originalReturnTo, id as string);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Profile Picture and Info */}
      <View style={styles.profileSection}>
        <Image source={{ uri: user.avatar }} style={styles.profilePicture} />
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
          onPress={() => router.push({
            pathname: '/followers',
            params: { userId: id, returnTo: 'external-profile', originalReturnTo: returnTo }
          })}
        >
          <Text style={styles.followNumber}>{followers.length}</Text>
          <Text style={styles.followLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.followItem}
          onPress={() => router.push({
            pathname: '/following',
            params: { userId: id, returnTo: 'external-profile', originalReturnTo: returnTo }
          })}
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

      {/* Recent Activity */}
      <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {studySessions.length > 0 ? (
          studySessions.slice(0, 5).map((session, index) => {
            const sessionDate = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
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
            
            return (
              <View key={session.id || index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="book" size={20} color="#2D5A27" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>
                    Studied {session.subject || 'Unknown Subject'} for {formatTime(sessionDuration)}
                  </Text>
                  <Text style={styles.activityTime}>{timeAgo}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.noActivityContainer}>
            <Text style={styles.noActivityText}>No study sessions yet</Text>
            <Text style={styles.noActivitySubtext}>This user hasn't started studying</Text>
          </View>
        )}
      </View>
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
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#2D5A27",
    marginBottom: 15,
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
});
