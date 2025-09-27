import { Text, View, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import { useAuth } from "../contexts/AuthContext";
import { useCurrentlyStudying } from "../hooks/useCurrentlyStudying";
import { formatCurrentlyStudyingForHomePage } from "../utils/currentlyStudyingUtils";
import { generateSocialDailySummaries } from "../firebase/dailySummaryService.js";

export default function Index() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  
  // Get currently studying users from followers
  const { currentlyStudyingUsers, loading: currentlyStudyingLoading, refresh: refreshCurrentlyStudying } = useCurrentlyStudying() as {
    currentlyStudyingUsers: any[];
    loading: boolean;
    error: any;
    refresh: () => Promise<void>;
  };
  
  // State for real Firebase data
  const [todayHours, setTodayHours] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for daily summaries
  const [dailySummaries, setDailySummaries] = useState<any[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(true);
  
  // State for likes
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Load user's study data from Firebase
  useEffect(() => {
    const loadUserStats = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get all study sessions for the user
        const sessionsQuery = query(
          collection(db, 'studySessions'),
          where('userId', '==', user.uid)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const sessions = sessionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as any)).sort((a: any, b: any) => {
          const dateA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
          const dateB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
          return dateB.getTime() - dateA.getTime(); // Sort by newest first
        });

        // Calculate today's hours
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let todayTotalHours = 0;
        let totalStudyHours = 0;

        sessions.forEach((session: any) => {
          let sessionDuration = 0;
          if (session.startTime && session.endTime) {
            const start = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const end = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
            const durationMs = end.getTime() - start.getTime();
            sessionDuration = durationMs / (1000 * 60 * 60); // Convert to hours
          } else if (session.duration) {
            sessionDuration = session.duration / 3600; // Convert seconds to hours
          }

          totalStudyHours += sessionDuration;

          // Check if session was today
          const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
          if (sessionDate >= today && sessionDate < tomorrow) {
            todayTotalHours += sessionDuration;
          }
        });

        // Calculate streak
        const streak = calculateStreak(sessions);

        setTodayHours(Math.round(todayTotalHours * 10) / 10);
        setTotalHours(Math.round(totalStudyHours * 10) / 10);
        setStreak(streak);

      } catch (error) {
        console.error('Error loading user stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadDailySummaries = async () => {
      if (!user) {
        setSummariesLoading(false);
        return;
      }

      try {
        setSummariesLoading(true);
        const summaries = await generateSocialDailySummaries(7, user.uid);
        setDailySummaries(summaries);
      } catch (error) {
        console.error('Error loading social daily summaries:', error);
      } finally {
        setSummariesLoading(false);
      }
    };

    loadUserStats();
    loadDailySummaries();
  }, [user]);

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

  // Format time duration
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
    
    return `${wholeHours}h ${minutes}m`;
  };
  
  // Format currently studying users for display
  const studyingStories = currentlyStudyingLoading 
    ? [] // Show loading state
    : currentlyStudyingUsers.length > 0 
      ? formatCurrentlyStudyingForHomePage(currentlyStudyingUsers)
      : [
          // Show "zzz" when nobody is studying
          {
            id: 'zzz',
            name: "zzz",
            avatar: "https://via.placeholder.com/60x60/E5E5EA/999999?text=zzz",
            subject: "Nobody studying",
            duration: "😴",
            isLive: false,
            hasSeen: true,
          }
        ];
  
  // Helper function to format time for display
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

  // Helper function to get relative time
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

  const handleComment = (activityId: string) => {
    // Handle comment functionality
    console.log("Comment on activity:", activityId);
  };

  const handleLike = (postId: string) => {
    setLikedPosts(prev => {
      const newLikedPosts = new Set(prev);
      if (newLikedPosts.has(postId)) {
        newLikedPosts.delete(postId);
      } else {
        newLikedPosts.add(postId);
      }
      return newLikedPosts;
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Refresh currently studying data
      await refreshCurrentlyStudying();
      
      // Refresh user stats
      const loadUserStats = async () => {
        if (!user) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          
          // Get all study sessions for the user
          const sessionsQuery = query(
            collection(db, 'studySessions'),
            where('userId', '==', user.uid)
          );
          const sessionsSnapshot = await getDocs(sessionsQuery);
          const sessions = sessionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as any)).sort((a: any, b: any) => {
            const dateA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
            const dateB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            return dateB.getTime() - dateA.getTime(); // Sort by newest first
          });

          // Calculate today's hours
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          let todayTotalHours = 0;
          let totalStudyHours = 0;

          sessions.forEach((session: any) => {
            let sessionDuration = 0;
            if (session.startTime && session.endTime) {
              const start = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
              const end = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
              const durationMs = end.getTime() - start.getTime();
              sessionDuration = durationMs / (1000 * 60 * 60); // Convert to hours
            } else if (session.duration) {
              sessionDuration = session.duration / 3600; // Convert seconds to hours
            }

            totalStudyHours += sessionDuration;

            // Check if session was today
            const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            if (sessionDate >= today && sessionDate < tomorrow) {
              todayTotalHours += sessionDuration;
            }
          });

          // Calculate streak
          const streak = calculateStreak(sessions);

          setTodayHours(Math.round(todayTotalHours * 10) / 10);
          setTotalHours(Math.round(totalStudyHours * 10) / 10);
          setStreak(streak);

        } catch (error) {
          console.error('Error loading user stats:', error);
        } finally {
          setLoading(false);
        }
      };

      // Refresh daily summaries
      const loadDailySummaries = async () => {
        if (!user) {
          setSummariesLoading(false);
          return;
        }

        try {
          setSummariesLoading(true);
          const summaries = await generateSocialDailySummaries(7, user.uid);
          setDailySummaries(summaries);
        } catch (error) {
          console.error('Error loading social daily summaries:', error);
        } finally {
          setSummariesLoading(false);
        }
      };

      await Promise.all([loadUserStats(), loadDailySummaries()]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#4A7C59"
          colors={["#4A7C59", "#007AFF"]}
          title="Pull to refresh"
          titleColor="#666"
          progressBackgroundColor="#ffffff"
        />
      }
    >
      {/* Alpha Badge */}
      <View style={[styles.betaContainer, { marginTop: insets.top }]}>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>ALPHA v0.1.0</Text>
        </View>
      </View>

      {/* Top Header with Notifications */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <Text style={styles.appTitle}>Studious</Text>
        </View>
        <View style={styles.topHeaderRight}>
          <TouchableOpacity 
            style={styles.topNotificationButton}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="#4A7C59" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stories Section */}
      <View style={styles.storiesContainer}>
        <Text style={styles.storiesTitle}>Currently Studying</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScrollContent}
        >
          {currentlyStudyingLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4A7C59" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : studyingStories.length > 0 ? (
            studyingStories.map((story) => (
              <TouchableOpacity 
                key={story.id} 
                style={styles.storyItem}
                onPress={() => {
                  if (story.id !== 'zzz') {
                    router.push(`/user-profile/external-user-profile?id=${story.id}`);
                  }
                }}
                disabled={story.id === 'zzz'}
              >
                <View style={[
                  styles.storyRing,
                  !story.hasSeen && styles.storyRingUnseen,
                  story.id === 'zzz' && styles.zzzRing
                ]}>
                  <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                  {story.isLive && (
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                    </View>
                  )}
                </View>
                <Text style={[styles.storyName, story.id === 'zzz' && styles.zzzText]} numberOfLines={1}>
                  {story.name}
                </Text>
                <Text style={[styles.storySubject, story.id === 'zzz' && styles.zzzText]} numberOfLines={1}>
                  {story.subject}
                </Text>
                <Text style={[styles.storyDuration, story.id === 'zzz' && styles.zzzText]}>
                  {story.duration}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No one is currently studying</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {loading ? "..." : formatTime(todayHours)}
          </Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {loading ? "..." : streak}
          </Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {loading ? "..." : formatTime(totalHours)}
          </Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
      </View>

      {/* Daily Summary Feed Header */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Daily Study Summaries</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.searchButton} onPress={() => router.push("/search")}>
            <Ionicons name="search" size={20} color="#4A7C59" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#4A7C59" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily Summary Feed */}
      <View style={styles.feedContainer}>
        {summariesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A7C59" />
            <Text style={styles.loadingText}>Loading your study summaries...</Text>
          </View>
        ) : dailySummaries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={48} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>No study data yet</Text>
            <Text style={styles.emptyMessage}>
              Start studying to see your daily summaries here!
            </Text>
          </View>
        ) : (
          dailySummaries.map((summary, index) => (
            <TouchableOpacity 
              key={`${summary.userId}-${summary.date}`} 
              style={styles.summaryCard}
              activeOpacity={1}
              onPress={() => {
                if (!summary.userProfile?.isOwn) {
                  router.push(`/user-profile/external-user-profile?id=${summary.userId}`);
                }
              }}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.summaryUserInfo}>
                  <Image 
                    source={{ 
                      uri: summary.userProfile?.profilePicture || 
                      `https://via.placeholder.com/40x40/4A7C59/FFFFFF?text=${summary.userProfile?.displayName?.charAt(0) || 'U'}` 
                    }} 
                    style={styles.userAvatar} 
                  />
                  <View style={styles.summaryInfo}>
                    <Text style={styles.summaryName}>
                      {summary.userProfile?.isOwn ? 'You' : summary.userProfile?.displayName}
                    </Text>
                    <Text style={styles.summaryUsername}>
                      @{summary.userProfile?.username}
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
                    >
                      <Ionicons 
                        name={likedPosts.has(`${summary.userId}-${summary.date}`) ? "heart" : "heart-outline"} 
                        size={20} 
                        color={likedPosts.has(`${summary.userId}-${summary.date}`) ? "#FF3B30" : "#666"} 
                      />
                      <Text style={[
                        styles.actionText,
                        likedPosts.has(`${summary.userId}-${summary.date}`) && styles.likedText
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
                </>
              ) : (
                <View style={styles.noStudyContainer}>
                  <Ionicons name="book-outline" size={32} color="#E5E5EA" />
                  <Text style={styles.noStudyText}>No study time recorded</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
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
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 5,
  },
  storiesContainer: {
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 0,
  },
  storiesTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  storiesScrollContent: {
    paddingRight: 20,
  },
  storyItem: {
    alignItems: "center",
    marginRight: 16,
    width: 70,
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: "#E5E5EA",
    marginBottom: 6,
    position: "relative",
  },
  storyRingUnseen: {
    backgroundColor: "#4A7C59",
  },
  storyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  liveIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  storyName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
    marginBottom: 2,
  },
  storySubject: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
    marginBottom: 2,
  },
  storyDuration: {
    fontSize: 9,
    color: "#4A7C59",
    fontWeight: "500",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
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
    fontSize: 20,
    fontWeight: "bold",
    color: "#4A7C59",
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
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 15,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  searchButton: {
    padding: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  settingsButton: {
    padding: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  feedContainer: {
    paddingHorizontal: 20,
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
  summaryUsername: {
    fontSize: 14,
    color: "#666",
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
  summaryActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  activityUsername: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: "#999",
  },
  activityContent: {
    marginBottom: 12,
  },
  activityText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
  subjectText: {
    fontWeight: "600",
    color: "#2D5A27",
  },
  activityActions: {
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
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  zzzRing: {
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  zzzText: {
    color: "#999",
    fontStyle: "italic",
  },
  noDataContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  noDataText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  betaContainer: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 10,
  },
  betaBadge: {
    // No additional styling needed - container handles it
  },
  betaText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  topHeaderLeft: {
    flex: 1,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  topHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  topNotificationButton: {
    padding: 8,
  },
  // Additional styles for real daily summaries
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginTop: 12,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 4,
  },
  statValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
  },
  insightsContainer: {
    backgroundColor: "#F0F8F0",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  insightText: {
    fontSize: 14,
    color: "#4A7C59",
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
  // Social feed styles
  summaryUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  // Action buttons container
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    marginTop: 12,
  },
});