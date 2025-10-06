import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getFollowers, followUser, unfollowUser, isFollowing } from "../firebase/followService";
import React from 'react';

interface Follower {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  profilePicture: string | null;
  followerCount: number;
  followingCount: number;
  followedAt: any;
}

export default function Followers() {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId, returnTo, originalReturnTo } = (route.params as any) || {};
  const { user } = useAuth();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingStatus, setFollowingStatus] = useState<{[key: string]: boolean}>({});
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  const fetchFollowers = async () => {
    if (!user) return;
    
    // Determine which user's followers to show
    const targetUser = userId as string || user.uid;
    setTargetUserId(targetUser);
    
    try {
      setLoading(true);
      const followersData = await getFollowers(targetUser);
      setFollowers(followersData);
      
      // Check follow status for each follower
      const statusMap: { [key: string]: boolean } = {};
      for (const follower of followersData) {
        const isFollowingUser = await isFollowing(user.uid, follower.id);
        statusMap[follower.id as string] = isFollowingUser;
      }
      setFollowingStatus(statusMap);
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowers();
  }, [user, userId]);

  // Refresh followers when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchFollowers();
    }, [user, userId])
  );

  const handleFollowToggle = async (followerId: string) => {
    if (!user) return;
    
    const previousState = followingStatus[followerId];
    
    try {
      // Update UI immediately
      setFollowingStatus((prev: {[key: string]: boolean}) => ({
        ...prev,
        [followerId]: !previousState
      }));
      
      // Then handle Firebase operation
      if (previousState) {
        await unfollowUser(user.uid, followerId);
      } else {
        await followUser(user.uid, followerId);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      // Revert UI state on error
      setFollowingStatus((prev: {[key: string]: boolean}) => ({
        ...prev,
        [followerId]: previousState
      }));
    }
  };

  return (
    <View style={styles.container}>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5A27" />
          <Text style={styles.loadingText}>Loading followers...</Text>
        </View>
      ) : (
        <FlatList
          data={followers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.itemRow}
              onPress={() => navigation.navigate('ExternalUserProfile', { id: item.id, returnTo, originalReturnTo })}
            >
              {item.profilePicture ? (
                <Image 
                  source={{ uri: item.profilePicture }} 
                  style={styles.avatar} 
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.displayName.split(' ').map(name => name.charAt(0)).join('').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.itemText}>
                <Text style={styles.name}>{item.displayName}</Text>
              </View>
              {targetUserId === user?.uid && (
                <TouchableOpacity 
                  style={[
                    styles.followButton,
                    followingStatus[item.id] ? styles.followingButton : styles.followButton
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleFollowToggle(item.id);
                  }}
                >
                  <Text style={[
                    styles.followButtonText,
                    followingStatus[item.id] ? styles.followingButtonText : styles.followButtonText
                  ]}>
                    {followingStatus[item.id] ? 'Following' : 'Follow back'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No followers yet</Text>
              <Text style={styles.emptySubtext}>Start studying and sharing to get followers!</Text>
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
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    color: "#666",
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
  followButton: {
    backgroundColor: "#2D5A27",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  followButtonText: {
    color: "#fff",
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
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  followingButtonText: {
    color: '#666',
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
});


