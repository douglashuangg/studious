import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, AppState, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageHeader from "../components/PageHeader";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveStudySession } from "../firebase/studySessionService.js";
import { 
  startBackgroundTimer, 
  stopBackgroundTimer, 
  saveTimerState, 
  clearTimerState,
  restoreTimerState,
  calculateElapsedTime
} from "../backgroundTimerService.js";
import { useAuth } from "../contexts/AuthContext";
import { 
  setCurrentlyStudying, 
  removeCurrentlyStudying 
} from "../firebase/currentlyStudyingService.js";

export default function Record() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  // Removed complex animations to prevent crashes

  // Load custom subjects from storage and Firebase sessions
  useEffect(() => {
    const loadCustomSubjects = async () => {
      if (!user) {
        setCustomSubjects([]);
        return;
      }

      try {
        // Load from AsyncStorage with user-specific key
        const userKey = `customSubjects_${user.uid}`;
        const saved = await AsyncStorage.getItem(userKey);
        if (saved) {
          setCustomSubjects(JSON.parse(saved));
        }

        // Also load unique subjects from Firebase sessions for this user
        const { getStudySessions } = await import("../firebase/studySessionService.js");
        const sessions = await getStudySessions();
        const uniqueSubjects = [...new Set(sessions.map(session => session.subject).filter(Boolean))];
        
        // Merge with existing custom subjects and remove duplicates
        const allCustomSubjects = [...new Set([...JSON.parse(saved || '[]'), ...uniqueSubjects])];
        setCustomSubjects(allCustomSubjects);
        saveCustomSubjects(allCustomSubjects);
      } catch (error) {
        console.error('Error loading custom subjects:', error);
      }
    };
    loadCustomSubjects();
  }, [user]);

  // Save custom subjects to storage
  const saveCustomSubjects = async (subjects: string[]) => {
    if (!user) return;
    
    try {
      const userKey = `customSubjects_${user.uid}`;
      await AsyncStorage.setItem(userKey, JSON.stringify(subjects));
    } catch (error) {
      console.error('Error saving custom subjects:', error);
    }
  };

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
      } else if (nextAppState === 'active' && isRecording) {
        // Restore timer when coming back to foreground
        const restoreTimer = async () => {
          const restoredState = await restoreTimerState();
          if (restoredState && restoredState.isRecording) {
            setSeconds(restoredState.elapsedTime);
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

  const openInputModal = () => {
    setShowInputModal(true);
  };

  const closeInputModal = () => {
    setShowInputModal(false);
  };

  const handleStart = async () => {
    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a subject for your study session.");
      return;
    }
    
    // Save custom subject to quick select only after starting focus session
    if (subject.trim() && !customSubjects.includes(subject.trim())) {
      const newSubjects = [...customSubjects, subject.trim()];
      setCustomSubjects(newSubjects);
      saveCustomSubjects(newSubjects);
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

      // Set user as currently studying
      if (user) {
        try {
          await setCurrentlyStudying(user.uid, subject, startTime.getTime(), notes);
        } catch (error) {
          console.error('❌ Error setting currently studying status:', error);
        }
      }
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

    // Update currently studying status with pause state
    if (user) {
      try {
        await setCurrentlyStudying(user.uid, subject, sessionStartTime.getTime(), notes, newPausedState, 0);
      } catch (error) {
        console.error('❌ Error updating currently studying status:', error);
      }
    }

  };

  const handleStop = () => {
    // Quick fix for web - just stop the timer directly
    if (Platform.OS === 'web') {
      resetSession();
      return;
    }
    
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
    // Remove user from currently studying status
    if (user) {
      try {
        await removeCurrentlyStudying(user.uid);
      } catch (error) {
        console.error('❌ Error removing currently studying status:', error);
      }
    }

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

  // Background timer functionality - only run once on mount
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
        
        // Restore currently studying status
        if (user && restoredState.subject) {
          try {
            await setCurrentlyStudying(user.uid, restoredState.subject, restoredState.startTime, restoredState.notes || '', restoredState.isPaused || false, 0);
          } catch (error) {
            console.error('❌ Error restoring currently studying status:', error);
          }
        }
        
      }
    };

    loadTimerFromStorage();
  }, []); // Only run once on mount, not when user changes

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
      } else if (nextAppState === 'active' && isRecording) {
        // Restore timer when coming back to foreground
        const restoreTimer = async () => {
          const restoredState = await restoreTimerState();
          if (restoredState && restoredState.isRecording) {
            setSeconds(restoredState.elapsedTime);
          }
        };
        restoreTimer();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isRecording, isPaused, sessionStartTime, subject, notes, seconds]);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader 
          title="Focus Timer"
          left={<TouchableOpacity onPress={() => {}} style={{ padding: 8 }}><Ionicons name="chevron-back" size={24} color="#000" /></TouchableOpacity>}
          right={<View style={{ width: 24 }} />}
        />

        {/* Modern Header with Gradient */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.subtitle}>Deep work sessions</Text>
          </View>
          <View style={styles.headerDecoration} />
        </View>

        {/* Main Timer Section */}
        <View style={styles.timerSection}>
          {/* Timer Display with Modern Design */}
          <View style={styles.timerContainer}>
            <View style={[styles.timerCircle, isRecording && styles.timerCircleActive]}>
              <Text style={styles.timerText}>{formatTime(seconds)}</Text>
              {isRecording && (
                <View style={styles.timerStatus}>
                  <View style={[styles.statusIndicator, isPaused && styles.statusPaused]} />
                  <Text style={styles.statusText}>
                    {isPaused ? "Paused" : "Recording"}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Subject Input with Modern Design */}
          <View style={styles.inputSection}>
            <TouchableOpacity 
              style={styles.inputContainer}
              onPress={() => !isRecording && openInputModal()}
              disabled={isRecording}
            >
              <Ionicons name="book-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
              <Text style={[styles.subjectInput, !subject && styles.placeholderText]}>
                {subject || "What are you studying?"}
              </Text>
              {!isRecording && (
                <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
              )}
            </TouchableOpacity>
          </View>

          {/* Control Buttons with Modern Design */}
          <View style={styles.controlsSection}>
            {!isRecording ? (
              <TouchableOpacity
                style={[styles.startButton, !subject.trim() && styles.startButtonDisabled]}
                onPress={handleStart}
                disabled={!subject.trim()}
              >
                <View style={styles.startButtonContent}>
                  <Ionicons name="play" size={32} color="white" />
                  <Text style={styles.startButtonText}>Start Focus</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.recordingControls}>
                <TouchableOpacity
                  style={styles.controlButton}
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


        {/* Quick Subject Tags */}
        <View style={styles.tagsSection}>
          <Text style={styles.tagsTitle}>Quick Select</Text>
          <View style={styles.tagsContainer}>
            {customSubjects.length > 0 ? (
              customSubjects.map((subj) => (
                <TouchableOpacity
                  key={subj}
                  style={[styles.tag, subject === subj && styles.tagSelected]}
                  onPress={() => setSubject(subj)}
                  disabled={isRecording}
                >
                  <Text style={[styles.tagText, subject === subj && styles.tagTextSelected]}>
                    {subj}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>Start studying to add subjects to your quick select!</Text>
            )}
          </View>
        </View>

        {/* Notes Section with Modern Design */}
        <View style={styles.notesSection}>
          <View style={styles.notesHeader}>
            <Ionicons name="create-outline" size={20} color="#2D5A27" />
            <Text style={styles.notesTitle}>Session Notes</Text>
          </View>
          <View style={styles.notesContainer}>
            <TextInput
              style={styles.notesInput}
              placeholder="Add your thoughts, insights, or key points..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor="#8E8E93"
            />
          </View>
        </View>
      </ScrollView>

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

            {/* Quick Subject Pills - User's Custom Subjects Only */}
            {customSubjects.length > 0 && (
              <View style={styles.pillsContainer}>
                {customSubjects.map((subj) => (
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
            )}

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

      {/* Input Modal */}
      <Modal
        visible={showInputModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <KeyboardAvoidingView 
          style={styles.inputModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Input Modal Header */}
          <View style={styles.inputModalHeader}>
            <TouchableOpacity 
              onPress={closeInputModal}
              style={styles.inputCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.inputModalTitle}>What are you studying?</Text>
            <View style={styles.inputModalSpacer} />
          </View>

          {/* Input Content */}
          <View style={styles.inputModalContent}>
            <View style={styles.inputModalInputContainer}>
              <Ionicons name="book-outline" size={24} color="#2D5A27" style={styles.inputModalIcon} />
              <TextInput
                style={styles.inputModalTextInput}
                placeholder="Enter your study subject..."
                value={subject}
                onChangeText={setSubject}
                placeholderTextColor="#8E8E93"
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={closeInputModal}
              />
              {subject.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSubject("")}
                  style={styles.inputClearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Subject Tags */}
            {customSubjects.length > 0 && (
              <View style={styles.inputModalTagsSection}>
                <Text style={styles.inputModalTagsTitle}>Quick Select</Text>
                <View style={styles.inputModalTagsContainer}>
                  {customSubjects.map((subj) => (
                    <TouchableOpacity
                      key={`custom-${subj}`}
                      style={[styles.inputModalTag, styles.inputModalTagCustom, subject === subj && styles.inputModalTagSelected]}
                      onPress={() => setSubject(subj)}
                    >
                      <Text style={[styles.inputModalTagText, subject === subj && styles.inputModalTagTextSelected]}>
                        {subj}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  
  // Modern Header with Gradient
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    position: "relative",
    overflow: "hidden",
  },
  headerContent: {
    zIndex: 2,
  },
  headerDecoration: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#2D5A27",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Timer Section
  timerSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  timerCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  timerCircleActive: {
    borderColor: "#2D5A27",
    shadowColor: "#2D5A27",
    shadowOpacity: 0.2,
  },
  timerText: {
    fontSize: 72,
    fontWeight: "300",
    color: "#1A1A1A",
    fontFamily: "SF Pro Display",
    letterSpacing: -3,
    textAlign: "center",
  },
  timerStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  statusPaused: {
    backgroundColor: "#F59E0B",
  },
  statusText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Input Section
  inputSection: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  inputIcon: {
    marginRight: 12,
  },
  subjectInput: {
    flex: 1,
    fontSize: 16,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  subjectInputActive: {
    borderColor: "#2D5A27",
  },
  placeholderText: {
    color: "#8E8E93",
    fontWeight: "400",
  },

  // Controls Section
  controlsSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  startButton: {
    backgroundColor: "#2D5A27",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 48,
    shadowColor: "#2D5A27",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  startButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0.1,
  },
  startButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 12,
  },
  recordingControls: {
    flexDirection: "row",
    gap: 24,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stopButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // Tags Section
  tagsSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  tagsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tag: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tagSelected: {
    backgroundColor: "#2D5A27",
    borderColor: "#2D5A27",
  },
  tagText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  tagTextSelected: {
    color: "#FFFFFF",
  },

  // Notes Section
  notesSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 8,
  },
  notesContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  notesInput: {
    fontSize: 16,
    color: "#1A1A1A",
    textAlignVertical: "top",
    minHeight: 100,
    lineHeight: 24,
  },

  // Legacy styles for modal compatibility
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
  subjectSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
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

  // Input Modal Styles
  inputModalContainer: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    width: '100%',
    height: '100%',
  },
  inputModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  inputCloseButton: {
    padding: 8,
  },
  inputModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 20,
  },
  inputModalSpacer: {
    width: 40,
  },
  inputModalContent: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  inputModalInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  inputModalIcon: {
    marginRight: 16,
  },
  inputModalTextInput: {
    flex: 1,
    fontSize: 18,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  inputClearButton: {
    padding: 4,
    marginLeft: 8,
  },
  inputModalTagsSection: {
    marginBottom: 24,
  },
  inputModalTagsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  inputModalTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  inputModalTag: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputModalTagSelected: {
    backgroundColor: "#2D5A27",
    borderColor: "#2D5A27",
  },
  inputModalTagCustom: {
    backgroundColor: "#F0F9FF",
    borderColor: "#0EA5E9",
  },
  inputModalTagText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  inputModalTagTextSelected: {
    color: "#FFFFFF",
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