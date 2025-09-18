import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const MOCK_FOLLOWERS = [
  { id: "1", name: "Sarah Johnson", username: "@sarahj", avatar: "https://via.placeholder.com/60x60/FF6B6B/FFFFFF?text=S" },
  { id: "2", name: "Mike Chen", username: "@mikechen", avatar: "https://via.placeholder.com/60x60/4ECDC4/FFFFFF?text=M" },
  { id: "3", name: "Emma Wilson", username: "@emmaw", avatar: "https://via.placeholder.com/60x60/45B7D1/FFFFFF?text=E" },
  { id: "4", name: "Alex Rodriguez", username: "@alexr", avatar: "https://via.placeholder.com/60x60/96CEB4/FFFFFF?text=A" },
];

export default function Followers() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/profile")}>
          <Ionicons name="chevron-back" size={24} color="#2D5A27" />
        </TouchableOpacity>
        <Text style={styles.title}>Followers</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={MOCK_FOLLOWERS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.itemText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.username}>{item.username}</Text>
            </View>
            <TouchableOpacity style={styles.followButton}>
              <Text style={styles.followButtonText}>Follow back</Text>
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
});


