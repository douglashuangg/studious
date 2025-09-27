import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import { useAuth } from "../contexts/AuthContext";
import { searchUsers, batchCheckFollowStatus } from "../firebase/followService";
import { useFollowOperations } from "../hooks/useFollowOperations";
import { navigateToExternalProfile } from "../utils/navigationUtils";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { VirtualizedUserList } from "../components/VirtualizedUserList";

export default function Search() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Use the follow operations hook for race condition prevention
  const { toggleFollow, isLoading: isFollowLoading } = useFollowOperations(currentUser?.uid);

  // Search users using the follow service
  const searchUsersInFirebase = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setUsers([]);
      setHasSearched(false);
      return;
    }

    if (!currentUser) return;

    try {
      setLoading(true);
      setHasSearched(true);
      
      const searchResults = await searchUsers(searchTerm, currentUser.uid);
      
      // Batch check follow status for better performance
      const userIds = searchResults.map(user => user.id);
      const followStatusMap = await batchCheckFollowStatus(currentUser.uid, userIds);
      
      // Add follow status to users
      const usersWithFollowStatus = searchResults.map(user => ({
        ...user,
        isFollowing: followStatusMap[user.id] || false
      }));
      
      setUsers(usersWithFollowStatus);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert("Error", "Failed to search users. Please try again.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search input with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsersInFirebase(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleFollow = async (userId: string) => {
    if (!currentUser) return;
    
    const userToUpdate = users.find(user => user.id === userId);
    if (!userToUpdate) return;
    
    // Update UI immediately for optimistic update
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, isFollowing: !user.isFollowing }
        : user
    ));
    
    // Use the hook for race condition prevention
    await toggleFollow(
      userId,
      userToUpdate.isFollowing,
      () => {
        // Success callback - UI already updated
      },
      (error) => {
        // Error callback - revert UI state
        setUsers(users.map(user => 
          user.id === userId 
            ? { ...user, isFollowing: userToUpdate.isFollowing }
            : user
        ));
        Alert.alert("Error", error || "Failed to update follow status. Please try again.");
      }
    );
  };

  const handleUserPress = (userId: string) => {
    navigateToExternalProfile(userId, 'search');
  };

  const handleBack = () => {
    setSearchQuery("");
    setUsers([]);
    setHasSearched(false);
    router.back();
  };

  // Refresh follow status for all users when page comes into focus
  const refreshFollowStatus = async () => {
    if (!currentUser || users.length === 0) return;
    
    try {
      // Use batch checking for better performance
      const userIds = users.map(user => user.id);
      const followStatusMap = await batchCheckFollowStatus(currentUser.uid, userIds);
      
      const updatedUsers = users.map(user => ({
        ...user,
        isFollowing: followStatusMap[user.id] || false
      }));
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error refreshing follow status:', error);
    }
  };

  // Refresh follow status when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (users.length > 0) {
        refreshFollowStatus();
      }
    }, [users.length])
  );

  return (
    <ErrorBoundary>
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color="#2D5A27" />
        </TouchableOpacity>
        <Text style={styles.title}>Search People</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or username..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5A27" />
          <Text style={styles.loadingText}>Searching users...</Text>
        </View>
      ) : (
        <VirtualizedUserList
          users={users}
          onUserPress={handleUserPress}
          onFollowToggle={handleFollow}
          loading={loading}
          emptyMessage={hasSearched ? "No users found" : "Search for users"}
          emptySubmessage={hasSearched ? "Try searching with different keywords" : "Enter a name or email to search"}
        />
      )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  searchContainer: {
    padding: 16,
    backgroundColor: "#f8f9fa",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: "#666",
  },
  followButton: {
    backgroundColor: "#2D5A27",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#2D5A27",
  },
  followButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  followingButtonText: {
    color: "#2D5A27",
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
});

