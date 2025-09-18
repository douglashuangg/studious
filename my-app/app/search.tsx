import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

const MOCK_USERS = [
  { id: "1", name: "Alice Johnson", username: "@alicej", avatar: "https://via.placeholder.com/60x60/FF6B6B/FFFFFF?text=A", isFollowing: false },
  { id: "2", name: "Bob Smith", username: "@bobsmith", avatar: "https://via.placeholder.com/60x60/4ECDC4/FFFFFF?text=B", isFollowing: false },
  { id: "3", name: "Carol Davis", username: "@carold", avatar: "https://via.placeholder.com/60x60/45B7D1/FFFFFF?text=C", isFollowing: true },
  { id: "4", name: "David Wilson", username: "@davidw", avatar: "https://via.placeholder.com/60x60/96CEB4/FFFFFF?text=D", isFollowing: false },
  { id: "5", name: "Emma Brown", username: "@emmab", avatar: "https://via.placeholder.com/60x60/FFEAA7/FFFFFF?text=E", isFollowing: false },
  { id: "6", name: "Frank Miller", username: "@frankm", avatar: "https://via.placeholder.com/60x60/DDA0DD/FFFFFF?text=F", isFollowing: true },
];

export default function Search() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState(MOCK_USERS);

  const handleFollow = (userId: string) => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, isFollowing: !user.isFollowing }
        : user
    ));
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userUsername}>{item.username}</Text>
            </View>
            <TouchableOpacity
              style={[styles.followButton, item.isFollowing && styles.followingButton]}
              onPress={() => handleFollow(item.id)}
            >
              <Text style={[styles.followButtonText, item.isFollowing && styles.followingButtonText]}>
                {item.isFollowing ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No users found</Text>
            <Text style={styles.emptySubtext}>Try searching with different keywords</Text>
          </View>
        }
      />
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
});

