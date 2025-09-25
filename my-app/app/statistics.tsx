import { Text, View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { getStudySessions } from "../firebase/studySessionService";
import { navigateBack } from "../utils/navigationUtils";

export default function Statistics() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const [studySessions, setStudySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('day'); // 'day', 'week', 'month', 'all'

  useEffect(() => {
    const fetchStudySessions = async () => {
      try {
        const sessions = await getStudySessions();
        setStudySessions(sessions);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching study sessions:", error);
        setLoading(false);
      }
    };

    fetchStudySessions();
  }, []);

  // Filter sessions based on time period
  const getFilteredSessions = () => {
    const now = new Date();
    const filteredSessions = studySessions.filter(session => {
      const sessionDate = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
      
      switch (timeFilter) {
        case 'day':
          return sessionDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return sessionDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return sessionDate >= monthAgo;
        case 'all':
        default:
          return true;
      }
    });
    
    return filteredSessions;
  };

  // Calculate statistics from filtered data
  const getSubjectStats = () => {
    const filteredSessions = getFilteredSessions();
    const subjectMap: { [key: string]: any } = {};
    
    filteredSessions.forEach(session => {
      const subject = session.subject || 'Unknown';
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          name: subject,
          totalTime: 0,
          sessionCount: 0,
          color: session.color || '#2D5A27'
        };
      }
      
      // Calculate duration from startTime and endTime if available
      if (session.startTime && session.endTime) {
        const start = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
        const end = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
        const durationMs = end.getTime() - start.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        subjectMap[subject].totalTime += durationHours;
      } else if (session.duration) {
        // Fallback to duration field if available
        subjectMap[subject].totalTime += session.duration / 3600; // Convert seconds to hours
      }
      
      subjectMap[subject].sessionCount++;
    });
    
    return Object.values(subjectMap).sort((a: any, b: any) => b.totalTime - a.totalTime);
  };

  const subjectStats = getSubjectStats();
  const totalStudyTime = subjectStats.reduce((sum: number, subject: any) => sum + subject.totalTime, 0);
  const filteredSessions = getFilteredSessions();
  const uniqueDays = new Set(filteredSessions.map(session => {
    const date = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
    return date.toDateString();
  })).size;

  const formatTime = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              if (returnTo && typeof returnTo === 'string') {
                navigateBack(returnTo);
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Statistics</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (returnTo && typeof returnTo === 'string') {
              navigateBack(returnTo);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Time Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterTitle}>Time Period</Text>
        <View style={styles.filterButtons}>
          {[
            { key: 'day', label: 'Today' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'all', label: 'All Time' }
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                timeFilter === filter.key && styles.filterButtonActive
              ]}
              onPress={() => setTimeFilter(filter.key)}
            >
              <Text style={[
                styles.filterButtonText,
                timeFilter === filter.key && styles.filterButtonTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Overview Cards */}
      <View style={styles.overviewContainer}>
        <View style={styles.overviewCard}>
          <Ionicons name="time" size={32} color="#E8A87C" />
          <Text style={styles.overviewValue}>{formatTime(totalStudyTime)}</Text>
          <Text style={styles.overviewLabel}>Total Study Time</Text>
        </View>
        <View style={styles.overviewCard}>
          <Ionicons name="calendar" size={32} color="#E8A87C" />
          <Text style={styles.overviewValue}>{uniqueDays}</Text>
          <Text style={styles.overviewLabel}>Active Days</Text>
        </View>
      </View>


      {/* Subject Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subject Breakdown</Text>
        <View style={styles.subjectList}>
          {subjectStats.length > 0 ? (
            subjectStats.map((subject: any, index: number) => {
              const maxTime = Math.max(...subjectStats.map((s: any) => s.totalTime));
              const barWidth = maxTime > 0 ? (subject.totalTime / maxTime) * 100 : 0;
              
              return (
                <View key={index} style={styles.subjectItem}>
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <View style={styles.barContainer}>
                    <View style={styles.barBackground}>
                      <View 
                        style={[
                          styles.barFill, 
                          { 
                            width: `${barWidth}%`,
                            backgroundColor: subject.color 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.subjectTime}>{formatTime(subject.totalTime as number)}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.noDataText}>No study sessions found</Text>
          )}
        </View>
      </View>


    </ScrollView>
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
    paddingTop: 50,
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
  overviewContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 30,
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 160,
  },
  overviewValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    marginTop: 8,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
  section: {
    marginHorizontal: 20,
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 15,
  },
  subjectList: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectItem: {
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  barBackground: {
    flex: 1,
    height: 20,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    marginRight: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 10,
    minWidth: 4, // Minimum width for visibility
  },
  subjectTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    minWidth: 60,
    textAlign: "right",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  noDataText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    padding: 20,
  },
  filterContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 15,
  },
  filterButtons: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  filterButtonActive: {
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
    lineHeight: 16,
  },
  filterButtonTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
