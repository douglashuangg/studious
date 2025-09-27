import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPostLikers, subscribeToPostLikers } from '../firebase/likeService';
import { useAuth } from '../contexts/AuthContext';

interface Liker {
  likeId: string;
  userId: string;
  likedAt: any;
  user: {
    id: string;
    displayName: string;
    username: string;
    profilePicture: string | null;
    email: string | null;
  };
}

interface LikersModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  postTitle?: string;
}

export default function LikersModal({ visible, onClose, postId, postTitle }: LikersModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !postId) return;

    setLoading(true);
    setError(null);

    // Load initial likers
    const loadLikers = async () => {
      try {
        const likersData = await getPostLikers(postId);
        setLikers(likersData);
      } catch (err: any) {
        console.error('Error loading likers:', err);
        setError(err.message || 'Failed to load likers');
      } finally {
        setLoading(false);
      }
    };

    loadLikers();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToPostLikers(postId, (updatedLikers) => {
      setLikers(updatedLikers);
    });

    return () => {
      unsubscribe();
    };
  }, [visible, postId]);

  const handleClose = () => {
    setLikers([]);
    setError(null);
    onClose();
  };

  const formatLikedTime = (likedAt: any) => {
    try {
      const date = likedAt?.toDate ? likedAt.toDate() : new Date(likedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return 'recently';
    }
  };

  const getAvatarUrl = (user: Liker['user']) => {
    if (user.profilePicture) {
      return user.profilePicture;
    }
    return null; // Return null to show initials fallback
  };

  const getInitials = (user: Liker['user']) => {
    return user.displayName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderLiker = (liker: Liker, index: number) => {
    const isCurrentUser = user?.uid === liker.userId;
    
    return (
      <View key={liker.likeId} style={styles.likerItem}>
        <View style={styles.likerInfo}>
          {getAvatarUrl(liker.user) ? (
            <Image
              source={{ uri: getAvatarUrl(liker.user) }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{getInitials(liker.user)}</Text>
            </View>
          )}
          <View style={styles.likerDetails}>
            <Text style={[styles.displayName, isCurrentUser && styles.currentUserText]}>
              {liker.user.displayName}
              {isCurrentUser && ' (You)'}
            </Text>
          </View>
        </View>
        <View style={styles.likeIndicator}>
          <Ionicons name="heart" size={16} color="#FF3B30" />
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {likers.length} {likers.length === 1 ? 'Like' : 'Likes'}
            </Text>
            {postTitle && (
              <Text style={styles.postTitle}>{postTitle}</Text>
            )}
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2D5A27" />
              <Text style={styles.loadingText}>Loading likers...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#FF3B30" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLoading(true);
                  setError(null);
                  // Retry loading
                  getPostLikers(postId)
                    .then(setLikers)
                    .catch((err: any) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : likers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={64} color="#E5E5EA" />
              <Text style={styles.emptyText}>No likes yet</Text>
              <Text style={styles.emptySubtext}>Be the first to like this post!</Text>
            </View>
          ) : (
            <ScrollView style={styles.likersList} showsVerticalScrollIndicator={false}>
              {likers.map(renderLiker)}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  postTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#2D5A27',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  likersList: {
    flex: 1,
  },
  likerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  likerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#2D5A27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  likerDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  currentUserText: {
    color: '#2D5A27',
  },
  username: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  likedTime: {
    fontSize: 12,
    color: '#999',
  },
  likeIndicator: {
    padding: 8,
  },
});
