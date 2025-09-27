import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getFollowing, unfollowUser } from "../firebase/followService";
import { navigateToExternalProfile, navigateBack } from "../utils/navigationUtils";
import PageHeader from "../components/PageHeader";

interface FollowingUser {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  profilePicture: string | null;
  followerCount: number;
  followingCount: number;
  followedAt: any;
}

export default function Following() {
  const router = useRouter();
  const { userId, returnTo, originalReturnTo } = useLocalSearchParams();
  const { user } = useAuth();
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!user) return;
      
      // Determine which user's following to show
      const targetUser = userId as string || user.uid;
      setTargetUserId(targetUser);
      
      try {
        setLoading(true);
        const followingData = await getFollowing(targetUser);
        setFollowing(followingData);
      } catch (error) {
        console.error('Error fetching following:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [user, userId]);

  const handleUnfollow = async (userId: string) => {
    if (!user) return;
    
    try {
      await unfollowUser(user.uid, userId);
      // Remove from local state
      setFollowing(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader 
        title="Following"
        left={
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              if (returnTo && typeof returnTo === 'string') {
                const additionalParams: { originalReturnTo?: string } = {};
                if (originalReturnTo) additionalParams.originalReturnTo = originalReturnTo as string;
                navigateBack(returnTo, userId as string, additionalParams);
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#2D5A27" />
          </TouchableOpacity>
        }
        right={<View style={{ width: 40 }} />}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5A27" />
          <Text style={styles.loadingText}>Loading following...</Text>
        </View>
      ) : (
        <FlatList
          data={following}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.itemRow}
              onPress={() => navigateToExternalProfile(item.id, returnTo as string, originalReturnTo as string)}
            >
              <Image 
                source={{ 
                  uri: item.profilePicture || `https://via.placeholder.com/60x60/2D5A27/FFFFFF?text=${item.displayName.charAt(0).toUpperCase()}` 
                }} 
                style={styles.avatar} 
              />
              <View style={styles.itemText}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.username}>@{item.username}</Text>
                {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
              </View>
              {targetUserId === user?.uid && (
                <TouchableOpacity 
                  style={styles.unfollowButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleUnfollow(item.id);
                  }}
                >
                  <Text style={styles.unfollowButtonText}>Unfollow</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Not following anyone yet</Text>
              <Text style={styles.emptySubtext}>Find users to follow and start building your network!</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  listContent: {
    padding: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  itemText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  username: {
    fontSize: 14,
    color: "#666",
  },
  unfollowButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FF3B30",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unfollowButtonText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "600",
  },
  separator: {
    height: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  bio: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  viewButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});


