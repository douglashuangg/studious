import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";

const { height: screenHeight } = Dimensions.get('window');

export default function Record() {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  
  // Calendar states
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRecordModal, setShowRecordModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setSeconds(seconds => seconds + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Calendar time update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a subject for your study session.");
      return;
    }
    
    if (!isRecording) {
      setSeconds(0);
    }
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    if (seconds >= 60) {
      Alert.alert(
        "Session Complete",
        `Study session completed!\nDuration: ${formatTime(seconds)}\nSubject: ${subject}`,
        [
          {
            text: "Save",
            onPress: () => {
              console.log("Session saved:", { subject, duration: seconds, notes });
              resetSession();
            }
          },
          {
            text: "Discard",
            onPress: resetSession,
            style: "destructive"
          }
        ]
      );
    } else {
      resetSession();
    }
  };

  const resetSession = () => {
    setIsRecording(false);
    setIsPaused(false);
    setSeconds(0);
    setSubject("");
    setNotes("");
  };

  // Calendar helper functions
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date(selectedDate);
        time.setHours(hour, minute, 0, 0);
        slots.push(time);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

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

  const isCurrentTime = (slot: Date) => {
    const slotHour = slot.getHours();
    const slotMinute = slot.getMinutes();
    const slotTimeInMinutes = slotHour * 60 + slotMinute;
    return Math.abs(slotTimeInMinutes - currentTimeInMinutes) <= 15;
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

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getStudySessions = () => {
    const sessionsByDate = {
      [new Date().toDateString()]: [
        { id: 1, subject: "Mathematics", startTime: 9, endTime: 10.5, color: "#FF6B6B" },
        { id: 2, subject: "Programming", startTime: 14, endTime: 16, color: "#4ECDC4" },
        { id: 3, subject: "Physics", startTime: 19, endTime: 20.5, color: "#45B7D1" },
      ],
      [new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()]: [
        { id: 4, subject: "Chemistry", startTime: 10, endTime: 11.5, color: "#96CEB4" },
        { id: 5, subject: "Biology", startTime: 15, endTime: 17, color: "#FFEAA7" },
      ],
    };
    
    return sessionsByDate[selectedDate.toDateString()] || [];
  };

  const studySessions = getStudySessions();

  const getSessionForTime = (hour: number, minute: number) => {
    const timeInHours = hour + minute / 60;
    return studySessions.find(session => 
      timeInHours >= session.startTime && timeInHours <= session.endTime
    );
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <View style={styles.container}>
      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color="#2D5A27" />
        </TouchableOpacity>
        
        <View style={styles.dateContainer}>
          <Text style={styles.calendarTitle}>Study Calendar</Text>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          {!isToday && (
            <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
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
          showsVerticalScrollIndicator={false}
        >
          {/* Time slots */}
          {timeSlots.map((slot, index) => {
            const hour = slot.getHours();
            const minute = slot.getMinutes();
            const session = getSessionForTime(hour, minute);
            const isCurrent = isCurrentTime(slot) && isToday;
            const isHalfHour = minute === 30;

            return (
              <View key={index} style={styles.timeSlot}>
                {/* Time label */}
                <View style={styles.timeLabel}>
                  <Text style={[styles.timeText, isCurrent && styles.currentTimeText]}>
                    {formatCalendarTime(slot)}
                  </Text>
                </View>

                {/* Time line */}
                <View style={styles.timeLineContainer}>
                  <View style={[
                    styles.timeLine,
                    isHalfHour && styles.halfHourLine,
                    isCurrent && styles.currentTimeLine
                  ]} />
                  
                  {/* Current time indicator */}
                  {isCurrent && (
                    <View style={styles.currentTimeIndicator}>
                      <View style={styles.currentTimeDot} />
                      <View style={styles.currentTimeLine} />
                    </View>
                  )}

                  {/* Study session block */}
                  {session && minute === 0 && (
                    <View style={[
                      styles.sessionBlock,
                      { 
                        backgroundColor: session.color,
                        height: (session.endTime - session.startTime) * 60,
                        top: 0
                      }
                    ]}>
                      <Text style={styles.sessionText}>{session.subject}</Text>
                      <Text style={styles.sessionTime}>
                        {Math.floor(session.startTime)}:00 - {Math.floor(session.endTime)}:30
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>
          {isToday ? "Today's Sessions" : `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Sessions`}
        </Text>
        {studySessions.length > 0 ? (
          studySessions.map((session) => (
            <View key={session.id} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: session.color }]} />
              <Text style={styles.legendText}>{session.subject}</Text>
              <Text style={styles.legendTime}>
                {Math.floor(session.startTime)}:00 - {Math.floor(session.endTime)}:30
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noSessionsText}>No study sessions for this day</Text>
        )}
      </View>

      {/* Floating Plus Button */}
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={() => setShowRecordModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

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
  todayButton: {
    backgroundColor: "#2D5A27",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  calendarContainer: {
    flex: 1,
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  timeSlot: {
    flexDirection: "row",
    height: 60,
    paddingHorizontal: 20,
  },
  timeLabel: {
    width: 80,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 10,
  },
  timeText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  currentTimeText: {
    color: "#2D5A27",
    fontWeight: "bold",
  },
  timeLineContainer: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
  },
  timeLine: {
    height: 1,
    backgroundColor: "#E5E5EA",
    width: "100%",
  },
  halfHourLine: {
    backgroundColor: "#D1D5DB",
  },
  currentTimeLine: {
    backgroundColor: "#2D5A27",
    height: 2,
  },
  currentTimeIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#2D5A27",
    flexDirection: "row",
    alignItems: "center",
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2D5A27",
    marginLeft: -4,
  },
  sessionBlock: {
    position: "absolute",
    left: 0,
    right: 0,
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
  legend: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 15,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
  // Floating button
  floatingButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2D5A27",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2D5A27",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    backgroundColor: "#34C759",
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
});