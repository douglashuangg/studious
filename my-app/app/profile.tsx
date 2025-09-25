import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { getStudySessions } from "../firebase/studySessionService";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import { getFollowCounts } from "../firebase/followService";
import { useFocusEffect } from '@react-navigation/native';
import { navigateToStatistics, navigateToFollowers, navigateToFollowing } from "../utils/navigationUtils";
import React from 'react';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [studySessions, setStudySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStudyHours, setTotalStudyHours] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [followCounts, setFollowCounts] = useState({ followerCount: 0, followingCount: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch study sessions
        const sessions = await getStudySessions();
        setStudySessions(sessions);
        calculateStats(sessions);
        
        // Fetch user profile data
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data();
            console.log('📱 Loaded user profile data:', profileData);
            setUserProfile(profileData);
          } else {
            console.log('📱 No user profile document found, user needs to create profile');
          }
          
          // Fetch follow counts
          const counts = await getFollowCounts(user.uid);
          setFollowCounts(counts);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
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
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const profileData = userDoc.data();
              console.log('🔄 Reloaded user profile data:', profileData);
              setUserProfile(profileData);
            }
            
            // Also refresh follow counts
            const counts = await getFollowCounts(user.uid);
            setFollowCounts(counts);
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

  const formatTime = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with Profile Picture and Followers/Following */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profilePictureContainer}>
            <Image
              source={{ uri: "https://via.placeholder.com/120x120/007AFF/FFFFFF?text=U" }}
              style={styles.profilePicture}
            />
            <TouchableOpacity style={styles.editButton}>
              <Ionicons name="camera" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.followContainer}>
            <TouchableOpacity style={styles.followItem} onPress={() => user?.uid && navigateToFollowers(user.uid, 'profile')}>
              <Text style={styles.followNumber}>{followCounts.followerCount}</Text>
              <Text style={styles.followLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.followItem} onPress={() => user?.uid && navigateToFollowing(user.uid, 'profile')}>
              <Text style={styles.followNumber}>{followCounts.followingCount}</Text>
              <Text style={styles.followLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.name}>
          {userProfile?.displayName || user?.displayName || 'User'}
        </Text>
        <Text style={styles.username}>
          @{userProfile?.username || user?.email?.split('@')[0] || 'user'}
        </Text>
        {userProfile?.bio && (
          <Text style={styles.bio}>
            {userProfile.bio}
          </Text>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {loading ? "..." : totalStudyHours.toFixed(1)}
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

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.editProfileButton}
          onPress={() => router.push("/edit-profile")}
        >
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={24} color="#2D5A27" />
        </TouchableOpacity>
      </View>

      {/* Statistics Button */}
      <TouchableOpacity 
        style={styles.statisticsButton}
        onPress={() => navigateToStatistics('profile')}
      >
        <View style={styles.statisticsContent}>
          <View style={styles.statisticsLeft}>
            <Ionicons name="analytics" size={24} color="#2D5A27" />
            <View style={styles.statisticsText}>
              <Text style={styles.statisticsTitle}>Statistics</Text>
              <Text style={styles.statisticsSubtitle}>View detailed study analytics</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </View>
      </TouchableOpacity>

      {/* Recent Activity */}
      <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {loading ? (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="calendar" size={20} color="#2D5A27" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>Loading recent activity...</Text>
            </View>
          </View>
        ) : studySessions.length > 0 ? (
          studySessions.slice(0, 3).map((session, index) => {
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
              <View key={session.id} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="book" size={20} color="#2D5A27" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>
                    Studied {session.subject} for {formatTime(sessionDuration)}
                  </Text>
                  <Text style={styles.activityTime}>{timeAgo}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="calendar" size={20} color="#2D5A27" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>No study sessions yet</Text>
              <Text style={styles.activityTime}>Start studying to see your activity here!</Text>
            </View>
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
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  profilePictureContainer: {
    position: "relative",
    marginBottom: 15,
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#2D5A27",
  },
  editButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2D5A27",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
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
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  followContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginLeft: 20,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    marginTop: 20,
    gap: 12,
  },
  editProfileButton: {
    flex: 1,
    backgroundColor: "#2D5A27",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  editProfileText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  settingsButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2D5A27",
    justifyContent: "center",
    alignItems: "center",
  },
  statisticsButton: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 20,
    borderRadius: 12,
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
});