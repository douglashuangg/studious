import { Text, View, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const router = useRouter();
  const { user } = useAuth();
  
  // State for real Firebase data
  const [todayHours, setTodayHours] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

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
        })).sort((a, b) => {
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

    loadUserStats();
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
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };
  
  // Mock data for currently studying stories
  const studyingStories = [
    {
      id: 1,
      name: "Sarah",
      avatar: "https://via.placeholder.com/60x60/FF6B6B/FFFFFF?text=S",
      subject: "Math",
      duration: "2h 15m",
      isLive: true,
      hasSeen: false,
    },
    {
      id: 2,
      name: "Mike",
      avatar: "https://via.placeholder.com/60x60/4ECDC4/FFFFFF?text=M",
      subject: "Code",
      duration: "1h 30m",
      isLive: true,
      hasSeen: true,
    },
    {
      id: 3,
      name: "Emma",
      avatar: "https://via.placeholder.com/60x60/45B7D1/FFFFFF?text=E",
      subject: "Physics",
      duration: "45m",
      isLive: true,
      hasSeen: false,
    },
    {
      id: 4,
      name: "Alex",
      avatar: "https://via.placeholder.com/60x60/96CEB4/FFFFFF?text=A",
      subject: "Chemistry",
      duration: "3h 20m",
      isLive: true,
      hasSeen: true,
    },
    {
      id: 5,
      name: "Lisa",
      avatar: "https://via.placeholder.com/60x60/FFEAA7/FFFFFF?text=L",
      subject: "Biology",
      duration: "1h 5m",
      isLive: true,
      hasSeen: false,
    },
    {
      id: 6,
      name: "Tom",
      avatar: "https://via.placeholder.com/60x60/DDA0DD/FFFFFF?text=T",
      subject: "History",
      duration: "2h 45m",
      isLive: true,
      hasSeen: true,
    },
  ];
  
  // Mock data for daily study summaries
  const dailySummaries = [
    {
      id: 1,
      name: "Sarah Johnson",
      username: "@sarahj",
      avatar: "https://via.placeholder.com/50x50/FF6B6B/FFFFFF?text=S",
      totalTime: "4h 30m",
      sessionCount: 3,
      subjects: ["Mathematics", "Physics", "Chemistry"],
      time: "Yesterday",
      likes: 12,
      isLiked: false,
      streak: 7,
    },
    {
      id: 2,
      name: "Mike Chen",
      username: "@mikechen",
      avatar: "https://via.placeholder.com/50x50/4ECDC4/FFFFFF?text=M",
      totalTime: "6h 15m",
      sessionCount: 4,
      subjects: ["Programming", "Data Science", "Algorithms"],
      time: "Yesterday",
      likes: 8,
      isLiked: true,
      streak: 12,
    },
    {
      id: 3,
      name: "Emma Wilson",
      username: "@emmaw",
      avatar: "https://via.placeholder.com/50x50/45B7D1/FFFFFF?text=E",
      totalTime: "3h 45m",
      sessionCount: 2,
      subjects: ["Physics", "Calculus"],
      time: "Yesterday",
      likes: 15,
      isLiked: false,
      streak: 5,
    },
    {
      id: 4,
      name: "Alex Rodriguez",
      username: "@alexr",
      avatar: "https://via.placeholder.com/50x50/96CEB4/FFFFFF?text=A",
      totalTime: "5h 20m",
      sessionCount: 3,
      subjects: ["Chemistry", "Organic Chemistry", "Lab Work"],
      time: "2 days ago",
      likes: 6,
      isLiked: false,
      streak: 3,
    },
    {
      id: 5,
      name: "Lisa Park",
      username: "@lisap",
      avatar: "https://via.placeholder.com/50x50/FFEAA7/FFFFFF?text=L",
      totalTime: "7h 10m",
      sessionCount: 5,
      subjects: ["Biology", "Anatomy", "Genetics", "Ecology", "Research"],
      time: "2 days ago",
      likes: 23,
      isLiked: true,
      streak: 15,
    },
  ];

  const handleLike = (activityId) => {
    // Handle like functionality
    console.log("Liked activity:", activityId);
  };

  const handleComment = (activityId) => {
    // Handle comment functionality
    console.log("Comment on activity:", activityId);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Stories Section */}
      <View style={styles.storiesContainer}>
        <Text style={styles.storiesTitle}>Currently Studying</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScrollContent}
        >
          {studyingStories.map((story) => (
            <TouchableOpacity 
              key={story.id} 
              style={styles.storyItem}
              onPress={() => router.push(`/user-profile/external-user-profile?id=${story.id}`)}
            >
              <View style={[
                styles.storyRing,
                !story.hasSeen && styles.storyRingUnseen
              ]}>
                <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                {story.isLive && (
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                  </View>
                )}
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {story.name}
              </Text>
              <Text style={styles.storySubject} numberOfLines={1}>
                {story.subject}
              </Text>
              <Text style={styles.storyDuration}>
                {story.duration}
              </Text>
            </TouchableOpacity>
          ))}
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
            {loading ? "..." : totalHours.toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
      </View>

      {/* Daily Summary Feed Header */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Daily Study Summaries</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.searchButton} onPress={() => router.push("/search")}>
            <Ionicons name="search" size={20} color="#2D5A27" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#2D5A27" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily Summary Feed */}
      <View style={styles.feedContainer}>
        {dailySummaries.map((summary) => (
          <View key={summary.id} style={styles.summaryCard}>
            <TouchableOpacity 
              style={styles.summaryHeader}
              onPress={() => router.push(`/user-profile/external-user-profile?id=${summary.id}`)}
            >
              <Image source={{ uri: summary.avatar }} style={styles.avatar} />
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryName}>{summary.name}</Text>
                <Text style={styles.summaryUsername}>{summary.username}</Text>
                <Text style={styles.summaryTime}>{summary.time}</Text>
              </View>
              <View style={styles.streakBadge}>
                <Ionicons name="flame" size={16} color="#FF6B35" />
                <Text style={styles.streakText}>{summary.streak}</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>
                Studied for <Text style={styles.highlightText}>{summary.totalTime}</Text> across <Text style={styles.highlightText}>{summary.sessionCount} sessions</Text>
              </Text>
              
              <View style={styles.subjectsContainer}>
                <Text style={styles.subjectsLabel}>Subjects:</Text>
                <View style={styles.subjectsList}>
                  {summary.subjects.map((subject, index) => (
                    <View key={index} style={styles.subjectTag}>
                      <Text style={styles.subjectTagText}>{subject}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.summaryActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleLike(summary.id)}
              >
                <Ionicons 
                  name={summary.isLiked ? "heart" : "heart-outline"} 
                  size={20} 
                  color={summary.isLiked ? "#FF3B30" : "#666"} 
                />
                <Text style={[styles.actionText, summary.isLiked && styles.likedText]}>
                  {summary.likes}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleComment(summary.id)}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#666" />
                <Text style={styles.actionText}>Comment</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="share-outline" size={20} color="#666" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
    marginTop: 10,
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
    backgroundColor: "#2D5A27",
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
    color: "#2D5A27",
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
    color: "#2D5A27",
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
    color: "#2D5A27",
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
});