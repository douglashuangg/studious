import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

export default function UserProfile() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  // Mock user data based on ID
  const getUserData = (userId: string) => {
    const users = {
      "1": {
        id: 1,
        name: "Sarah Johnson",
        username: "@sarahj",
        avatar: "https://via.placeholder.com/120x120/FF6B6B/FFFFFF?text=S",
        bio: "Mathematics & Physics Student | Study Enthusiast",
        studyHours: 156,
        sessions: 89,
        streak: 7,
        followers: 12,
        following: 8,
        recentActivity: [
          { text: "Studied for 4h 30m across 3 sessions", time: "Yesterday" },
          { text: "Studied for 6h 15m across 4 sessions", time: "2 days ago" },
          { text: "Studied for 3h 45m across 2 sessions", time: "3 days ago" }
        ]
      },
      "2": {
        id: 2,
        name: "Mike Chen",
        username: "@mikechen",
        avatar: "https://via.placeholder.com/120x120/4ECDC4/FFFFFF?text=M",
        bio: "Computer Science Student | Programming Lover",
        studyHours: 203,
        sessions: 124,
        streak: 12,
        followers: 18,
        following: 15,
        recentActivity: [
          { text: "Studied for 6h 15m across 4 sessions", time: "Yesterday" },
          { text: "Studied for 5h 20m across 3 sessions", time: "2 days ago" },
          { text: "Studied for 4h 10m across 2 sessions", time: "3 days ago" }
        ]
      },
      "3": {
        id: 3,
        name: "Emma Wilson",
        username: "@emmaw",
        avatar: "https://via.placeholder.com/120x120/45B7D1/FFFFFF?text=E",
        bio: "Physics & Calculus Student | Science Enthusiast",
        studyHours: 134,
        sessions: 76,
        streak: 5,
        followers: 9,
        following: 12,
        recentActivity: [
          { text: "Studied for 3h 45m across 2 sessions", time: "Yesterday" },
          { text: "Studied for 4h 20m across 3 sessions", time: "2 days ago" },
          { text: "Studied for 2h 30m across 1 session", time: "3 days ago" }
        ]
      }
    };
    
    return users[userId as keyof typeof users] || users["1"];
  };

  const user = getUserData(id as string);
  const [isFollowing, setIsFollowing] = useState(false);

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Profile Picture and Info */}
      <View style={styles.profileSection}>
        <Image source={{ uri: user.avatar }} style={styles.profilePicture} />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.bio}>{user.bio}</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.studyHours}</Text>
          <Text style={styles.statLabel}>Study Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.sessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.streak}</Text>
          <Text style={styles.statLabel}>Streak Days</Text>
        </View>
      </View>

      {/* Followers/Following */}
      <View style={styles.followContainer}>
        <View style={styles.followItem}>
          <Text style={styles.followNumber}>{user.followers}</Text>
          <Text style={styles.followLabel}>Followers</Text>
        </View>
        <View style={styles.followItem}>
          <Text style={styles.followNumber}>{user.following}</Text>
          <Text style={styles.followLabel}>Following</Text>
        </View>
      </View>

      {/* Follow Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={handleFollow}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {user.recentActivity.map((activity, index) => (
          <View key={index} style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="calendar" size={20} color="#2D5A27" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>{activity.text}</Text>
              <Text style={styles.activityTime}>{activity.time}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 8,
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
    paddingVertical: 30,
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
});
