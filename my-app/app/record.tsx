import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { saveStudySession } from "../firebase/studySessionService.js";
import { 
  startBackgroundTimer, 
  stopBackgroundTimer, 
  saveTimerState, 
  clearTimerState,
  restoreTimerState,
  calculateElapsedTime
} from "../backgroundTimerService.js";

export default function Record() {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setSeconds(seconds => seconds + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Background timer functionality
  useEffect(() => {
    const loadTimerFromStorage = async () => {
      const restoredState = await restoreTimerState();
      if (restoredState && restoredState.isRecording) {
        // Restore timer state
        setIsRecording(true);
        setIsPaused(restoredState.isPaused || false);
        setSubject(restoredState.subject || "");
        setNotes(restoredState.notes || "");
        setSessionStartTime(new Date(restoredState.startTime));
        
        // Use the calculated elapsed time
        setSeconds(restoredState.elapsedTime || 0);
        
        console.log("Timer state restored from background:", {
          isRecording: true,
          elapsed: restoredState.elapsedTime,
          subject: restoredState.subject
        });
      }
    };

    loadTimerFromStorage();
  }, []);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && isRecording) {
        // Save timer state when going to background
        saveTimerState({
          isRecording,
          isPaused,
          startTime: sessionStartTime?.getTime(),
          subject,
          notes,
          elapsedTime: seconds
        });
        console.log("Timer state saved for background");
      } else if (nextAppState === 'active' && isRecording) {
        // Restore timer when coming back to foreground
        const restoreTimer = async () => {
          const restoredState = await restoreTimerState();
          if (restoredState && restoredState.isRecording) {
            setSeconds(restoredState.elapsedTime);
            console.log("Timer restored from background:", restoredState.elapsedTime, "seconds");
          }
        };
        restoreTimer();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isRecording, isPaused, sessionStartTime, subject, notes, seconds]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a subject for your study session.");
      return;
    }
    
    if (!isRecording) {
      setSeconds(0);
      const startTime = new Date();
      setSessionStartTime(startTime);
      
      // Start background timer
      const backgroundTimerStarted = await startBackgroundTimer();
      
      // Save timer state
      await saveTimerState({
        isRecording: true,
        isPaused: false,
        startTime: startTime.getTime(),
        subject,
        notes,
        elapsedTime: 0,
        backgroundTimerEnabled: backgroundTimerStarted
      });
    }
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePause = async () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    // Save paused state
    if (sessionStartTime) {
      await saveTimerState({
        isRecording,
        isPaused: newPausedState,
        startTime: sessionStartTime.getTime(),
        subject,
        notes,
        elapsedTime: seconds
      });
    }
  };

  const handleStop = () => {
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
                  subject: subject,
                  startTime: sessionStartTime,
                  endTime: sessionEndTime,
                  duration: formatTime(seconds),
                  notes: notes,
                  isActive: false,
                  color: "#2D5A27"
                };
                
                await saveStudySession(sessionData);
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
    
    // Stop background timer and clear state
    await stopBackgroundTimer();
    await clearTimerState();
  };

  // Background timer functionality
  useEffect(() => {
    const loadTimerFromStorage = async () => {
      const restoredState = await restoreTimerState();
      if (restoredState && restoredState.isRecording) {
        // Restore timer state
        setIsRecording(true);
        setIsPaused(restoredState.isPaused || false);
        setSubject(restoredState.subject || "");
        setNotes(restoredState.notes || "");
        setSessionStartTime(new Date(restoredState.startTime));
        
        // Use the calculated elapsed time
        setSeconds(restoredState.elapsedTime || 0);
        
        console.log("Timer state restored from background:", {
          isRecording: true,
          elapsed: restoredState.elapsedTime,
          subject: restoredState.subject
        });
      }
    };

    loadTimerFromStorage();
  }, []);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && isRecording) {
        // Save timer state when going to background
        saveTimerState({
          isRecording,
          isPaused,
          startTime: sessionStartTime?.getTime(),
          subject,
          notes,
          elapsedTime: seconds
        });
        console.log("Timer state saved for background");
      } else if (nextAppState === 'active' && isRecording) {
        // Restore timer when coming back to foreground
        const restoreTimer = async () => {
          const restoredState = await restoreTimerState();
          if (restoredState && restoredState.isRecording) {
            setSeconds(restoredState.elapsedTime);
            console.log("Timer restored from background:", restoredState.elapsedTime, "seconds");
          }
        };
        restoreTimer();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isRecording, isPaused, sessionStartTime, subject, notes, seconds]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Study Timer</Text>
        <Text style={styles.subtitle}>Track your study sessions</Text>
      </View>

      {/* Main Timer Card */}
      <View style={styles.timerCard}>
        <View style={styles.timerDisplay}>
          <Text style={styles.timerText}>{formatTime(seconds)}</Text>
          {isRecording && (
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, isPaused && styles.pausedDot]} />
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

      {/* Record Button */}
      <View style={styles.recordButtonContainer}>
        <TouchableOpacity 
          style={[
            styles.recordButton,
            isRecording && styles.recordingButton
          ]}
          onPress={() => setShowRecordModal(true)}
        >
          <Ionicons 
            name={isRecording ? "stop" : "add"} 
            size={20} 
            color="white" 
          />
          <Text style={styles.recordButtonText}>
            {isRecording ? "Recording..." : "Start Session"}
          </Text>
        </TouchableOpacity>
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
  backgroundIndicator: {
    fontSize: 12,
    color: "#34C759",
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
  recordButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  recordButton: {
    backgroundColor: "#2D5A27",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2D5A27",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recordingButton: {
    backgroundColor: "#FF3B30",
    shadowColor: "#FF3B30",
  },
  recordButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
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
});