import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, Dimensions, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageHeader from "../components/PageHeader";
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import { saveStudySession } from "../firebase/studySessionService.js";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function Calendar() {
  const insets = useSafeAreaInsets();
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  
  // Calendar states
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRecordModal, setShowRecordModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Timeline configuration
  const [pixelsPerMinute, setPixelsPerMinute] = useState(2); // Default: 2px per minute
  const [timelineHeight, setTimelineHeight] = useState(0);
  
  // Timeline constants
  const DAY_START_HOUR = 0; // 12:00 AM (midnight)
  const DAY_END_HOUR = 24; // 12:00 AM (midnight) - next day
  const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60; // 24 hours = 1440 minutes
  const TIMELINE_PADDING = 15; // Padding to ensure 12:00 AM marker is visible

  // Calculate pixels per minute based on screen size
  useEffect(() => {
    // Use a fixed pixels per minute to ensure scrollable content
    const fixedPixelsPerMinute = 2; // 2px per minute = 2880px for 24 hours
    setPixelsPerMinute(fixedPixelsPerMinute);
    // Add minimal padding to ensure the 12:00 AM marker is visible above navbar
    setTimelineHeight(TOTAL_MINUTES * fixedPixelsPerMinute + TIMELINE_PADDING);
  }, []);

  // Calendar time update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to current time
  useEffect(() => {
    if (scrollViewRef.current && pixelsPerMinute > 0) {
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      
      // Calculate minutes from day start
      const minutesFromDayStart = (currentHour - DAY_START_HOUR) * 60 + currentMinute;
      
      // Calculate scroll position
      const scrollPosition = minutesFromDayStart * pixelsPerMinute;
      
      console.log(`Auto-scroll: Current time ${currentHour}:${currentMinute.toString().padStart(2, '0')}, Minutes from start: ${minutesFromDayStart}, Scroll position: ${scrollPosition}px`);
      
      // Scroll to current time with some offset to center it
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, scrollPosition - 200), // Offset to show some context above
          animated: true
        });
      }, 100); // Small delay to ensure layout is complete
    }
  }, [pixelsPerMinute]); // Trigger when pixelsPerMinute changes

  // Timeline helper functions
  const getDayStart = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    return dayStart;
  };

  const getMinutesFromDayStart = (date: Date) => {
    const dayStart = getDayStart(selectedDate);
    return (date.getTime() - dayStart.getTime()) / (1000 * 60);
  };

  const getSessionPosition = (session: any) => {
    // Use the actual startTime and endTime fields from the session
    const sessionStart = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const sessionEnd = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
    const dayStart = getDayStart(selectedDate);
    
    // Calculate start and end positions
    const startMinutesFromMidnight = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60);
    const endMinutesFromMidnight = (sessionEnd.getTime() - dayStart.getTime()) / (1000 * 60);
    
    const top = startMinutesFromMidnight * pixelsPerMinute;
    const height = (endMinutesFromMidnight - startMinutesFromMidnight) * pixelsPerMinute;
    
    console.log(`Session "${session.subject}":`);
    console.log(`  Start: ${sessionStart.toLocaleTimeString()} (${startMinutesFromMidnight.toFixed(1)}min from midnight)`);
    console.log(`  End: ${sessionEnd.toLocaleTimeString()} (${endMinutesFromMidnight.toFixed(1)}min from midnight)`);
    console.log(`  Duration: ${(endMinutesFromMidnight - startMinutesFromMidnight).toFixed(1)} minutes`);
    console.log(`  Top: ${top.toFixed(1)}px, Height: ${height.toFixed(1)}px`);
    
    return { top, height };
  };

  const getCurrentTimePosition = () => {
    const minutesFromDayStart = getMinutesFromDayStart(currentTime);
    return minutesFromDayStart * pixelsPerMinute;
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSessionTime = (timeInHours: number) => {
    // Handle invalid or undefined time values
    if (!timeInHours || isNaN(timeInHours)) {
      return "Invalid time";
    }
    
    const hours = Math.floor(timeInHours);
    const minutes = Math.round((timeInHours - hours) * 60);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatFirebaseTime = (firebaseTimestamp: any) => {
    if (!firebaseTimestamp) return "Unknown time";
    
    const date = firebaseTimestamp?.toDate ? firebaseTimestamp.toDate() : new Date(firebaseTimestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatFirebaseEndTime = (firebaseTimestamp: any, duration: number) => {
    if (!firebaseTimestamp || !duration) return "Unknown end";
    
    const startDate = firebaseTimestamp?.toDate ? firebaseTimestamp.toDate() : new Date(firebaseTimestamp);
    const endDate = new Date(startDate.getTime() + (duration * 1000)); // duration in seconds
    
    return endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleStart = async () => {
    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a subject for your study session.");
      return;
    }
    
    if (!isRecording) {
      setSeconds(0);
      const startTime = new Date();
      setSessionStartTime(startTime); // Record the start time
    }
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePause = async () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
  };

  const handleStop = () => {
    // Always show confirmation when stopping recording
      Alert.alert(
      "Stop Recording",
      `Do you want to save this study session?\n\nDuration: ${formatTime(seconds)}\nSubject: ${subject || "No subject"}`,
      [
        {
          text: "Save Session",
          onPress: async () => {
            if (seconds >= 60) {
              try {
                const sessionEndTime = new Date();
                const sessionData = {
                  userId: "current-user", // You can replace this with actual user ID
                  userName: "Current User", // You can replace this with actual user name
                  subject: subject,
                  startTime: sessionStartTime,
                  endTime: sessionEndTime,
                  duration: formatTime(seconds),
                  notes: notes,
                  isActive: false, // Session is completed
                  color: "#2D5A27" // Default color
                };
                
                await saveStudySession(sessionData);
                // Session saved
                Alert.alert("Success", "Study session saved successfully!");
              } catch (error) {
                console.error("Error saving session:", error);
                Alert.alert("Error", "Failed to save study session. Please try again.");
              }
            } else {
              Alert.alert("Session Too Short", "Study session must be at least 1 minute to save.");
            }
              resetSession();
            }
          },
          {
            text: "Discard",
          onPress: () => {
            Alert.alert("Discarded", "Study session discarded.");
            resetSession();
          },
            style: "destructive"
        },
        {
          text: "Continue Recording",
          onPress: () => {
            // Do nothing - just close the dialog and continue recording
          }
        }
      ]
    );
  };

  const resetSession = async () => {
    setIsRecording(false);
    setIsPaused(false);
    setSeconds(0);
    setSubject("");
    setNotes("");
    setSessionStartTime(null);
  };

  // Generate hour markers for the timeline
  const generateHourMarkers = () => {
    const markers = [];
    for (let hour = 0; hour <= 24; hour++) {
      const hourDate = new Date(selectedDate);
      if (hour === 24) {
        // For 24:00 (midnight of next day), show as 12:00 AM
        hourDate.setDate(hourDate.getDate() + 1);
        hourDate.setHours(0, 0, 0, 0);
      } else {
        hourDate.setHours(hour, 0, 0, 0);
      }
      const minutesFromDayStart = getMinutesFromDayStart(hourDate);
      
      markers.push({
        hour,
        top: minutesFromDayStart * pixelsPerMinute,
        displayTime: hourDate
      });
    }
    return markers;
  };

  const hourMarkers = generateHourMarkers();

  const formatCalendarTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isCurrentTimeVisible = () => {
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInHours = currentHour + currentMinute / 60;
    return currentTimeInHours >= DAY_START_HOUR && currentTimeInHours < DAY_END_HOUR;
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const getStudySessions = async () => {
    try {
      // Import the Firebase service function - this already filters by authenticated user
      const { getStudySessions: loadUserSessions } = await import("../firebase/studySessionService.js");
      const userSessions = await loadUserSessions();
      
      // Filter sessions by selected date
      const selectedDateString = selectedDate.toDateString();
      const sessionsForDate = userSessions.filter(session => {
        // Convert Firebase timestamp to date string for comparison
        const sessionDate = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
        return sessionDate.toDateString() === selectedDateString;
      });
      
      // Process sessions
      console.log("=== FIREBASE DATA DEBUG ===");
      console.log("User sessions from Firebase:", userSessions);
      console.log("Sessions for date:", sessionsForDate);
      console.log("Number of sessions found:", sessionsForDate.length);
      
      if (sessionsForDate.length > 0) {
        console.log("=== FIRST SESSION FULL OBJECT ===");
        console.log("Complete session object:", JSON.stringify(sessionsForDate[0], null, 2));
        console.log("Session keys:", Object.keys(sessionsForDate[0]));
        console.log("Session startTime type:", typeof sessionsForDate[0].startTime);
        console.log("Session endTime type:", typeof sessionsForDate[0].endTime);
        console.log("Session createdAt type:", typeof sessionsForDate[0].createdAt);
        console.log("Session updatedAt type:", typeof sessionsForDate[0].updatedAt);
      }
      
      console.log("=== END FIREBASE DEBUG ===");
      return sessionsForDate;
    } catch (error) {
      console.error("Error loading user sessions from Firebase:", error);
      return [];
    }
  };

  const [studySessions, setStudySessions] = useState<any[]>([]);

  // Load sessions from Firebase when component mounts or date changes
  useEffect(() => {
    const loadSessions = async () => {
      const sessions = await getStudySessions();
      setStudySessions(sessions);
    };
    loadSessions();
  }, [selectedDate]); // Reload when selectedDate changes

  // Auto-refresh when tab is focused
  useFocusEffect(
    React.useCallback(() => {
      const refreshSessions = async () => {
        try {
          const sessions = await getStudySessions();
          setStudySessions(sessions);
        } catch (error) {
          console.error("Error refreshing study sessions:", error);
        }
      };

      refreshSessions();
    }, [])
  );


  return (
    <View style={styles.container}>
      <PageHeader 
        title="Study Calendar"
        left={<TouchableOpacity onPress={() => {}} style={{ padding: 8 }}><Ionicons name="chevron-back" size={24} color="#000" /></TouchableOpacity>}
        right={<View style={{ width: 24 }} />}
      />

      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color="#2D5A27" />
        </TouchableOpacity>
        
        <View style={styles.dateContainer}>
          {/* <Text style={styles.calendarTitle}>Study Calendar</Text> */}
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
        </View>
        
        <TouchableOpacity onPress={goToNextDay} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color="#2D5A27" />
        </TouchableOpacity>
      </View>

      {/* Calendar Container */}
      <View style={styles.calendarContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={{ height: timelineHeight }}
          showsVerticalScrollIndicator={true}
          contentInsetAdjustmentBehavior="never"
          scrollEventThrottle={16}
          bounces={true}
        >
          {/* Timeline Container */}
          <View style={styles.timelineContainer}>
            {/* Hour Markers */}
            {hourMarkers.map((marker, index) => (
              <View key={index} style={[styles.hourMarker, { top: marker.top }]}>
                <View style={styles.hourLabel}>
                  <Text style={styles.hourText}>
                    {formatCalendarTime(marker.displayTime)}
                  </Text>
                </View>
                <View style={styles.hourLine} />
              </View>
            ))}

            {/* Study Session Blocks */}
            {studySessions.map((session) => {
              const position = getSessionPosition(session);
              const sessionStart = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
              const sessionEnd = session.endTime?.toDate ? session.endTime.toDate() : new Date(session.endTime);
              
              return (
                <View
                  key={session.id}
                  style={{
                    position: 'absolute',
                    left: 80,
                    right: 20,
                    top: position.top,
                    height: Math.max(position.height, 4), // Minimum 4px height for visibility
                    backgroundColor: session.color || "#4A7C59",
                    borderRadius: 4,
                    padding: 4,
                    zIndex: 10,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>
                    {session.subject}
                  </Text>
                  <Text style={{ color: "white", fontSize: 10, opacity: 0.9 }}>
                    {sessionStart.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })} - {sessionEnd.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </Text>
                </View>
              );
            })}

            {/* Current Time Indicator */}
            {selectedDate.toDateString() === new Date().toDateString() && isCurrentTimeVisible() && (
              <>
                {/* Current time line */}
                <View style={[
                  styles.currentTimeLine,
                  {
                    position: 'absolute',
                    left: 80,
                    right: 20,
                    top: getCurrentTimePosition(),
                    height: 2,
                    backgroundColor: "#007AFF",
                    zIndex: 20,
                  }
                ]} />
                
                {/* Current time dot */}
                <View style={[
                  styles.currentTimeDot,
                  {
                    position: 'absolute',
                    left: 76,
                    top: getCurrentTimePosition() - 4,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#007AFF",
                    zIndex: 20,
                  }
                ]} />
                
                {/* Current time label */}
                <Text style={[
                  styles.currentTimeLabel,
                  {
                    position: 'absolute',
                    right: 20,
                    top: getCurrentTimePosition() - 8,
                    backgroundColor: "#007AFF",
                    color: "white",
                    fontSize: 12,
                    fontWeight: "bold",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    zIndex: 20,
                  }
                ]}>
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </View>


      {/* Record Modal */}
      <Modal
        visible={showRecordModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowRecordModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Study Session</Text>
            <View style={styles.placeholder} />
        </View>

          {/* Recording Interface */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Main Timer Card */}
            <View style={styles.timerCard}>
              <View style={styles.timerDisplay}>
                <Text style={styles.timerText}>{formatTime(seconds)}</Text>
                {isRecording && (
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, isPaused && styles.pausedDot]} />
                    <Text style={styles.statusText}>
                      {isPaused ? "Paused" : "Recording"}
                    </Text>
                    {!isPaused && (
                      <Text style={styles.backgroundIndicator}>
                        📱 Timer running
                      </Text>
                    )}
                    {!isPaused && (
                      <Text style={styles.backgroundNote}>
                        🔋 Works when screen is off
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Subject Input */}
              <View style={styles.subjectSection}>
                <Text style={styles.sectionLabel}>Subject</Text>
                <TextInput
                  style={[styles.subjectInput, !isRecording && styles.subjectInputActive]}
                  placeholder="What are you studying?"
                  value={subject}
                  onChangeText={setSubject}
                  editable={!isRecording}
                  placeholderTextColor="#8E8E93"
                />
              </View>

              {/* Control Buttons */}
              <View style={styles.controlsContainer}>
                {!isRecording ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, !subject.trim() && styles.disabledButton]}
                    onPress={handleStart}
                    disabled={!subject.trim()}
                  >
                    <Ionicons name="play" size={28} color="white" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.recordingControls}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={handlePause}
                    >
                      <Ionicons name={isPaused ? "play" : "pause"} size={24} color="#2D5A27" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.stopButton}
                      onPress={handleStop}
                    >
                      <Ionicons name="stop" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Quick Subject Pills */}
            <View style={styles.pillsContainer}>
              {["Math", "Code", "Read", "Science", "History"].map((subj) => (
              <TouchableOpacity
                key={subj}
                  style={[styles.pill, subject === subj && styles.selectedPill]}
                onPress={() => setSubject(subj)}
                disabled={isRecording}
              >
                  <Text style={[styles.pillText, subject === subj && styles.selectedPillText]}>
                  {subj}
                </Text>
              </TouchableOpacity>
            ))}
      </View>

            {/* Notes Section */}
            <View style={styles.notesCard}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add your thoughts..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor="#8E8E93"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  // Calendar styles
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  dateContainer: {
    flex: 1,
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },
  calendarContainer: {
    flex: 1,
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 0,
    marginTop: 0,
    flexGrow: 1,
  },
  // Timeline styles
  timelineContainer: {
    position: 'relative',
    height: '100%',
  },
  hourMarker: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 20, // Fixed height for each hour marker
  },
  hourLabel: {
    width: 80,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  hourText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E5EA",
    marginLeft: 10,
  },
  sessionBlock: {
    position: 'absolute',
    padding: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  sessionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  sessionTime: {
    color: "white",
    fontSize: 10,
    opacity: 0.9,
  },
  currentTimeLine: {
    backgroundColor: "#007AFF",
    height: 2,
  },
  currentTimeDot: {
    backgroundColor: "#007AFF",
  },
  currentTimeLabel: {
    backgroundColor: "#007AFF",
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  legend: {
    padding: 8,
  },
  legendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
  },
  legendContent: {
    flex: 1,
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  legendText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  legendTime: {
    fontSize: 14,
    color: "#666",
  },
  noSessionsText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 17,
    color: "#8E8E93",
    fontWeight: "400",
  },
  timerCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timerDisplay: {
    alignItems: "center",
    marginBottom: 32,
  },
  timerText: {
    fontSize: 64,
    fontWeight: "300",
    color: "#000",
    fontFamily: "SF Pro Display",
    letterSpacing: -2,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4A7C59",
    marginRight: 8,
  },
  pausedDot: {
    backgroundColor: "#FF9500",
  },
  statusText: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "500",
  },
  backgroundIndicator: {
    fontSize: 12,
    color: "#4A7C59",
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  backgroundNote: {
    fontSize: 11,
    color: "#FF9500",
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  subjectSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  subjectInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: "#000",
    borderWidth: 0,
  },
  subjectInputActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2D5A27",
  },
  controlsContainer: {
    alignItems: "center",
  },
  primaryButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2D5A27",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2D5A27",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    backgroundColor: "#8E8E93",
    shadowOpacity: 0.1,
  },
  recordingControls: {
    flexDirection: "row",
    gap: 20,
  },
  secondaryButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  stopButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  selectedPill: {
    backgroundColor: "#2D5A27",
    borderColor: "#2D5A27",
  },
  pillText: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "500",
  },
  selectedPillText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  notesCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notesInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    color: "#000",
    textAlignVertical: "top",
    minHeight: 80,
  },
  recentCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recentList: {
    gap: 16,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recentContent: {
    flex: 1,
  },
  recentSubject: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  recentDuration: {
    fontSize: 15,
    color: "#8E8E93",
  },
  debugScrollView: {
    maxHeight: 200, // Limit height to 200px
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 8,
  },
  startTimeLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#FF3B30", // Red line
    zIndex: 10,
  },
  betaContainer: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 10,
  },
  betaText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
});
