import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import { useAuth } from "../contexts/AuthContext";

export default function Search() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search users in Firebase
  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setUsers([]);
      setHasSearched(false);
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);
      
      const usersRef = collection(db, 'users');
      
      // Search by displayName (case insensitive)
      const nameQuery = query(usersRef,
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        orderBy('displayName'),
        limit(20)
      );

      const nameSnapshot = await getDocs(nameQuery);
      const nameResults = nameSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        avatar: doc.data().avatar || `https://via.placeholder.com/60x60/2D5A27/FFFFFF?text=${doc.data().displayName?.charAt(0) || 'U'}`,
        isFollowing: false // Will be updated based on follow status
      }));

      // Search by email (for username-like searches)
      const emailQuery = query(usersRef,
        where('email', '>=', searchTerm),
        where('email', '<=', searchTerm + '\uf8ff'),
        orderBy('email'),
        limit(20)
      );

      const emailSnapshot = await getDocs(emailQuery);
      const emailResults = emailSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        avatar: doc.data().avatar || `https://via.placeholder.com/60x60/2D5A27/FFFFFF?text=${doc.data().displayName?.charAt(0) || 'U'}`,
        isFollowing: false
      }));

      // Combine and deduplicate results
      const allResults = [...nameResults, ...emailResults];
      const uniqueResults = allResults.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      );

      // Filter out current user
      const filteredResults = uniqueResults.filter(user => user.id !== currentUser?.uid);
      
      setUsers(filteredResults);
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
      searchUsers(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleFollow = (userId: string) => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, isFollowing: !user.isFollowing }
        : user
    ));
  };

  const handleUserPress = (userId: string) => {
    router.push(`/user-profile/external-user-profile?id=${userId}`);
  };

  const handleBack = () => {
    setSearchQuery("");
    setUsers([]);
    setHasSearched(false);
    router.back();
  };

  return (
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
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.userItem} 
              onPress={() => handleUserPress(item.id)}
            >
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.displayName || 'Anonymous User'}</Text>
                <Text style={styles.userUsername}>@{item.username || item.email?.split('@')[0] || 'user'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.followButton, item.isFollowing && styles.followingButton]}
                onPress={() => handleFollow(item.id)}
              >
                <Text style={[styles.followButtonText, item.isFollowing && styles.followingButtonText]}>
                  {item.isFollowing ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {hasSearched ? "No users found" : "Search for users"}
              </Text>
              <Text style={styles.emptySubtext}>
                {hasSearched ? "Try searching with different keywords" : "Enter a name or email to search"}
              </Text>
            </View>
          }
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

