import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
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
    
    // If 0 hours, just show minutes
    if (wholeHours === 0) {
      return `${minutes}m`;
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Alpha Header */}
      <View style={[styles.betaContainer, { marginTop: insets.top }]}>
        <Text style={styles.betaText}>ALPHA v0.1.0</Text>
      </View>

      {/* Header with Profile Picture and Followers/Following */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profilePictureContainer}>
            <Image
              source={{ 
                uri: userProfile?.profilePictureUrl || "https://via.placeholder.com/120x120/007AFF/FFFFFF?text=U" 
              }}
              style={styles.profilePicture}
            />
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
          onPress={() => router.push("/edit-profile")}
        >
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
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

      {/* Statistics Button */}
      <TouchableOpacity 
        style={styles.statisticsButton}
        onPress={() => navigateToStatistics('profile')}
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
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
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
    marginBottom: 20,
  },
  followContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    marginLeft: 20,
    borderRadius: 16,
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
    marginTop: 10,
    gap: 12,
  },
  editProfileButton: {
    alignSelf: "center",
    backgroundColor: "#000000",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  editProfileText: {
    color: "#ffffff",
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
    marginTop: 10,
  },
  betaText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
});