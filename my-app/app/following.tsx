import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const MOCK_FOLLOWING = [
  { id: "1", name: "Alice Kim", username: "@alicek", avatar: "https://via.placeholder.com/60x60/FFD166/FFFFFF?text=A" },
  { id: "2", name: "Brian Lee", username: "@brianl", avatar: "https://via.placeholder.com/60x60/06D6A0/FFFFFF?text=B" },
  { id: "3", name: "Carla Diaz", username: "@carlad", avatar: "https://via.placeholder.com/60x60/118AB2/FFFFFF?text=C" },
  { id: "4", name: "Daniel Wu", username: "@danielw", avatar: "https://via.placeholder.com/60x60/EF476F/FFFFFF?text=D" },
];

export default function Following() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/profile")}>
          <Ionicons name="chevron-back" size={24} color="#2D5A27" />
        </TouchableOpacity>
        <Text style={styles.title}>Following</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={MOCK_FOLLOWING}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.itemText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.username}>{item.username}</Text>
            </View>
            <TouchableOpacity style={styles.unfollowButton}>
              <Text style={styles.unfollowButtonText}>Unfollow</Text>
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
});


