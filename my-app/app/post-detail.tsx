import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStudySessions } from '../firebase/studySessionService';
import { getPostById } from '../firebase/postService';

type PostDetailRouteParams = {
  postId: string;
  postTitle?: string;
};

type PostDetailRouteProp = RouteProp<{ PostDetail: PostDetailRouteParams }, 'PostDetail'>;

interface StudySession {
  id: string;
  subject: string;
  startTime: any;
  endTime: any;
  duration: string;
  notes?: string;
  createdAt: any;
}

interface PostData {
  id: string;
  userId: string;
  date: string;
  dateTimestamp: any;
  totalStudyTime: number;
  sessionCount: number;
  subjects: string[];
  longestSession: number;
  insights: string[];
  userProfile: {
    id: string;
    displayName: string;
    username: string;
    profilePicture?: string;
  };
  createdAt: any;
  updatedAt: any;
}

export default function PostDetail() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<PostDetailRouteProp>();
  const { postId, postTitle } = route.params;

  const [postData, setPostData] = useState<PostData | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    loadPostData();
    loadSessions();
  }, [postId]);

  const loadPostData = async () => {
    try {
      setLoading(true);
      const post = await getPostById(postId);
      if (post) {
        setPostData(post);
      } else {
        Alert.alert('Error', 'Post not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading post:', error);
      Alert.alert('Error', 'Failed to load post details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const allSessions = await getStudySessions();
      
      // Filter sessions for the specific date
      const postDate = new Date(postId.split('-').slice(1).join('-'));
      const dayStart = new Date(postDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(postDate);
      dayEnd.setHours(23, 59, 59, 999);

      const daySessions = allSessions.filter(session => {
        const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
        return sessionDate >= dayStart && sessionDate <= dayEnd;
      });

      // Sort sessions by start time
      daySessions.sort((a, b) => {
        const dateA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
        const dateB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
        return dateA.getTime() - dateB.getTime();
      });

      setSessions(daySessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load study sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  const formatTime = (date: any) => {
    if (!date) return 'Unknown';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (session: StudySession) => {
    if (session.duration) {
      return session.duration;
    }
    
    if (session.startTime && session.endTime) {
      const start = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
      const end = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
      const diffMs = end.getTime() - start.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}:${minutes.toString().padStart(2, '0')}:00`;
    }
    
    return 'Unknown';
  };

  const getSubjectColor = (subject: string) => {
    const colors = [
      '#4A7C59', '#2D5A27', '#1B4332', '#40916C', '#52B788',
      '#74C69D', '#95D5B2', '#B7E4C7', '#D8F3DC', '#F1FAEE'
    ];
    const hash = subject.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A7C59" />
          <Text style={styles.loadingText}>Loading post details...</Text>
        </View>
      </View>
    );
  }

  if (!postData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post Not Found</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#E5E5EA" />
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {postTitle || `${postData.userProfile.displayName}'s Study Day`}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Post Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Study Summary</Text>
            <Text style={styles.summaryDate}>{postData.date}</Text>
          </View>
          
          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{postData.totalStudyTime}h</Text>
              <Text style={styles.statLabel}>Total Time</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{postData.sessionCount}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{postData.longestSession}h</Text>
              <Text style={styles.statLabel}>Longest</Text>
            </View>
          </View>

          {postData.subjects.length > 0 && (
            <View style={styles.subjectsContainer}>
              <Text style={styles.subjectsLabel}>Subjects:</Text>
              <View style={styles.subjectsList}>
                {postData.subjects.map((subject, index) => (
                  <View key={index} style={[styles.subjectTag, { backgroundColor: getSubjectColor(subject) }]}>
                    <Text style={styles.subjectText}>{subject}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {postData.insights.length > 0 && (
            <View style={styles.insightsContainer}>
              <Text style={styles.insightsLabel}>Insights:</Text>
              {postData.insights.map((insight, index) => (
                <Text key={index} style={styles.insightText}>• {insight}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Sessions List */}
        <View style={styles.sessionsCard}>
          <View style={styles.sessionsHeader}>
            <Text style={styles.sessionsTitle}>Study Sessions</Text>
            <Text style={styles.sessionsCount}>{sessions.length} sessions</Text>
          </View>

          {sessionsLoading ? (
            <View style={styles.sessionsLoading}>
              <ActivityIndicator size="small" color="#4A7C59" />
              <Text style={styles.sessionsLoadingText}>Loading sessions...</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.noSessionsContainer}>
              <Ionicons name="book-outline" size={32} color="#E5E5EA" />
              <Text style={styles.noSessionsText}>No study sessions found</Text>
            </View>
          ) : (
            <View style={styles.sessionsList}>
              {sessions.map((session, index) => (
                <View key={session.id} style={styles.sessionItem}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionSubject}>{session.subject}</Text>
                      <Text style={styles.sessionDuration}>{formatDuration(session)}</Text>
                    </View>
                    <View style={styles.sessionTime}>
                      <Text style={styles.sessionTimeText}>
                        {formatTime(session.startTime)} - {formatTime(session.endTime)}
                      </Text>
                    </View>
                  </View>
                  
                  {session.notes && (
                    <Text style={styles.sessionNotes}>{session.notes}</Text>
                  )}
                  
                  <View style={styles.sessionFooter}>
                    <Text style={styles.sessionNumber}>Session {index + 1}</Text>
                    <View style={[styles.sessionIndicator, { backgroundColor: getSubjectColor(session.subject) }]} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  summaryDate: {
    fontSize: 14,
    color: '#666',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A7C59',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  subjectsContainer: {
    marginBottom: 16,
  },
  subjectsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  subjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  insightsContainer: {
    marginTop: 8,
  },
  insightsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  sessionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sessionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  sessionsCount: {
    fontSize: 14,
    color: '#666',
  },
  sessionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  sessionsLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  noSessionsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSessionsText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  sessionsList: {
    gap: 12,
  },
  sessionItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4A7C59',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sessionDuration: {
    fontSize: 14,
    color: '#4A7C59',
    fontWeight: '500',
  },
  sessionTime: {
    alignItems: 'flex-end',
  },
  sessionTimeText: {
    fontSize: 12,
    color: '#666',
  },
  sessionNotes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionNumber: {
    fontSize: 12,
    color: '#999',
  },
  sessionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
