import { Text, View, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // No notifications for now
  const notifications: any[] = [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "study_session":
        return "checkmark-circle";
      case "friend_activity":
        return "people";
      case "achievement":
        return "trophy";
      case "reminder":
        return "time";
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "study_session":
        return "#4A7C59";
      case "friend_activity":
        return "#007AFF";
      case "achievement":
        return "#FFD93D";
      case "reminder":
        return "#FF9500";
      default:
        return "#666";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Empty State (if no notifications) */}
      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={64} color="#E5E5EA" />
          <Text style={styles.emptyTitle}>It's quiet here</Text>
          <Text style={styles.emptyMessage}>
            New notifications will appear here when you have them.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
          {notifications.map((notification) => (
            <TouchableOpacity 
              key={notification.id} 
              style={[
                styles.notificationItem,
                !notification.isRead && styles.unreadNotification
              ]}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationLeft}>
                  <View style={[
                    styles.notificationIcon,
                    { backgroundColor: getNotificationColor(notification.type) }
                  ]}>
                    <Ionicons 
                      name={getNotificationIcon(notification.type)} 
                      size={20} 
                      color="#FFFFFF" 
                    />
                  </View>
                  <View style={styles.notificationText}>
                    <Text style={[
                      styles.notificationTitle,
                      !notification.isRead && styles.unreadText
                    ]}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {notification.time}
                    </Text>
                  </View>
                </View>
                {!notification.isRead && (
                  <View style={styles.unreadDot} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
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
  placeholder: {
    width: 40,
  },
  notificationsList: {
    flex: 1,
  },
  notificationItem: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  unreadNotification: {
    backgroundColor: "#F8F9FF",
  },
  notificationContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  notificationLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: "700",
  },
  notificationMessage: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#999",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4A7C59",
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
});
