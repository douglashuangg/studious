import React, { useMemo } from 'react';
import { FlatList, View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface User {
  id: string;
  displayName: string;
  username: string;
  bio?: string;
  profilePicture?: string;
  isFollowing?: boolean;
}

interface VirtualizedUserListProps {
  users: User[];
  onUserPress: (userId: string) => void;
  onFollowToggle: (userId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  emptySubmessage?: string;
}

export const VirtualizedUserList: React.FC<VirtualizedUserListProps> = ({
  users,
  onUserPress,
  onFollowToggle,
  loading = false,
  emptyMessage = "No users found",
  emptySubmessage = "Try searching with different keywords"
}) => {
  // Memoize the render item to prevent unnecessary re-renders
  const renderUser = useMemo(() => {
    return ({ item }: { item: User }) => (
      <TouchableOpacity 
        style={styles.userItem}
        onPress={() => onUserPress(item.id)}
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
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.displayName}</Text>
          <Text style={styles.username}>@{item.username}</Text>
          {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
        </View>
        <TouchableOpacity
          style={[
            styles.followButton,
            item.isFollowing && styles.followingButton
          ]}
          onPress={(e) => {
            e.stopPropagation();
            onFollowToggle(item.id);
          }}
        >
          <Text style={[
            styles.followButtonText,
            item.isFollowing && styles.followingButtonText
          ]}>
            {item.isFollowing ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [onUserPress, onFollowToggle]);

  const renderEmpty = useMemo(() => {
    return () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={48} color="#ccc" />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
        <Text style={styles.emptySubtext}>{emptySubmessage}</Text>
      </View>
    );
  }, [emptyMessage, emptySubmessage]);

  const keyExtractor = useMemo(() => {
    return (item: User) => item.id;
  }, []);

  const getItemLayout = useMemo(() => {
    return (data: any, index: number) => ({
      length: 80, // Approximate height of each item
      offset: 80 * index,
      index,
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      renderItem={renderUser}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      ListEmptyComponent={renderEmpty}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={10}
      updateCellsBatchingPeriod={50}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666',
  },
  bio: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  followButton: {
    backgroundColor: '#2D5A27',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#2D5A27',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#2D5A27',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});
