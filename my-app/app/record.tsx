import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";
import { saveStudySession } from "../firebase/studySessionService.js";

const { height: screenHeight } = Dimensions.get('window');

export default function Record() {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [timeSlotHeight, setTimeSlotHeight] = useState(60); // Default height
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState(null);
  
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

  // Auto-scroll to current time only when component first mounts
  useEffect(() => {
    if (scrollViewRef.current && timeSlotHeight > 0) {
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      
      // Calculate which time slot the current time falls into
      // Each hour has 2 slots: :00-:30 and :30-:60
      const slotIndex = currentHour * 2 + (currentMinute >= 30 ? 1 : 0);
      
      // Calculate scroll position (each time slot is timeSlotHeight pixels)
      const scrollPosition = slotIndex * timeSlotHeight;
      
      console.log(`Auto-scroll: Current time ${currentHour}:${currentMinute.toString().padStart(2, '0')}, Slot index: ${slotIndex}, Scroll position: ${scrollPosition}px`);
      
      // Scroll to current time with some offset to center it
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, scrollPosition - 200), // Offset to show some context above
          animated: true
        });
      }, 100); // Small delay to ensure layout is complete
    }
  }, [timeSlotHeight]); // Only trigger when timeSlotHeight changes (initial load)


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

  const calculateSessionHeight = (session: any) => {
    // Calculate actual duration from Firebase timestamps
    const sessionStart = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
    const sessionEnd = session.updatedAt?.toDate ? session.updatedAt.toDate() : new Date(session.updatedAt);
    
    const durationMs = sessionEnd.getTime() - sessionStart.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    
    // Use consistent time slot dimensions: 60px for 30 minutes = 2px per minute
    const height = durationMinutes * getPixelsPerMinute();
    
    return Math.max(height, 20); // Minimum 20px so it's visible
  };

  const calculateSessionTop = (session: any) => {
    // Use actual Firebase timestamp
    const sessionStart = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
    const startHour = sessionStart.getHours();
    const startMinute = sessionStart.getMinutes();
    
    // Calculate position within the current time slot
    // Use consistent time slot dimensions: 60px for 30 minutes = 2px per minute
    const minutesWithinSlot = startMinute % 30; // Minutes within the 30-minute slot
    const topPosition = minutesWithinSlot * getPixelsPerMinute(); // Use consistent calculation
    
    return topPosition;
  };

  const handleStart = () => {
    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a subject for your study session.");
      return;
    }
    
    if (!isRecording) {
      setSeconds(0);
      setSessionStartTime(new Date()); // Record the start time
    }
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
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

  const resetSession = () => {
    setIsRecording(false);
    setIsPaused(false);
    setSeconds(0);
    setSubject("");
    setNotes("");
    setSessionStartTime(null);
  };

  // Calendar helper functions
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) { // Every 30 minutes
        const startTime = new Date(selectedDate);
        startTime.setHours(hour, minute, 0, 0);
        
        const endTime = new Date(selectedDate);
        if (minute === 30) {
          endTime.setHours(hour + 1, 0, 0, 0);
        } else {
          endTime.setHours(hour, 30, 0, 0);
        }
        
        slots.push({
          startTime,
          endTime,
          hour,
          minute,
          displayTime: startTime // For display purposes
        });
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

  const isCurrentTime = (slot: any) => {
    const slotHour = slot.hour;
    const slotMinute = slot.minute;
    const slotTimeInMinutes = slotHour * 60 + slotMinute;
    
    // Check if current time falls within this 30-minute slot
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    const isCurrent = currentTimeInMinutes >= slotTimeInMinutes && 
           currentTimeInMinutes < slotTimeInMinutes + 30;
    
    // Debug logging for 4:30 slot specifically
    if (slotHour === 16 && slotMinute === 30) {
      console.log(`🔍 isCurrentTime debug for ${slotHour}:${slotMinute.toString().padStart(2, '0')}:`);
      console.log(`   Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTimeInMinutes} minutes)`);
      console.log(`   Slot time: ${slotHour}:${slotMinute.toString().padStart(2, '0')} (${slotTimeInMinutes} minutes)`);
      console.log(`   Is current: ${isCurrent}`);
      if (isCurrent) {
        const minutesIntoSlot = currentTimeInMinutes - slotTimeInMinutes;
        const expectedPosition = minutesIntoSlot * getPixelsPerMinute();
        console.log(`   Minutes into slot: ${minutesIntoSlot}`);
        console.log(`   Expected position: ${expectedPosition}px (should be ${(minutesIntoSlot/30*100).toFixed(1)}% through slot)`);
      }
    }
    
    return isCurrent;
  };

  // Dynamic positioning based on actual time slot height
  const MINUTES_PER_SLOT = 30;
  const ACTUAL_TIME_SLOT_HEIGHT = 60; // Use the actual time slot height from styles
  const getPixelsPerMinute = () => ACTUAL_TIME_SLOT_HEIGHT / MINUTES_PER_SLOT;

  const getCurrentTimePosition = (slot: any) => {
    const slotHour = slot.hour;
    const slotMinute = slot.minute;
    const slotTimeInMinutes = slotHour * 60 + slotMinute;
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Calculate how many minutes into the 30-minute slot the current time is
    const minutesIntoSlot = currentTimeInMinutes - slotTimeInMinutes;
    const topPosition = minutesIntoSlot * getPixelsPerMinute();
    
    console.log(`📍 Current time position: ${currentHour}:${currentMinute.toString().padStart(2, '0')} in slot ${slotHour}:${slotMinute.toString().padStart(2, '0')}`);
    console.log(`   Minutes into slot: ${minutesIntoSlot}, Pixels per minute: ${getPixelsPerMinute()}, Top position: ${topPosition}px`);
    
    return topPosition;
  };

  const onTimeSlotLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    console.log(`📏 Measured time slot height: ${height}px`);
    if (height !== timeSlotHeight) {
      setTimeSlotHeight(height);
    }
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
      // Import the Firebase service function
      const { getStudySessions: loadAllSessionsFromFirebase } = await import("../firebase/studySessionService.js");
      const allSessions = await loadAllSessionsFromFirebase();
      
      // Filter for current-user in JavaScript (no index needed)
      const userSessions = allSessions.filter(session => session.userId === "current-user");
      
      // Filter sessions by selected date
      const selectedDateString = selectedDate.toDateString();
      const sessionsForDate = userSessions.filter(session => {
        // Convert Firebase timestamp to date string for comparison
        const sessionDate = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
        return sessionDate.toDateString() === selectedDateString;
      });
      
      // Loading sessions
      
      // Process sessions
      return sessionsForDate;
    } catch (error) {
      console.error("Error loading user sessions from Firebase:", error);
      return [];
    }
  };

  const [studySessions, setStudySessions] = useState([]);

  // Load sessions from Firebase when component mounts or date changes
  useEffect(() => {
    const loadSessions = async () => {
      const sessions = await getStudySessions();
      setStudySessions(sessions);
    };
    loadSessions();
  }, [selectedDate]); // Reload when selectedDate changes

  // Function to add test session to Firebase
  const addTestSession = async () => {
    try {
      const { saveStudySession } = await import("../firebase/studySessionService.js");
      
      // Create session for TODAY at 5 PM
      const today = new Date();
      today.setHours(17, 0, 0, 0); // 5:00 PM today
      
      // Create end time (6 PM) - 1 hour later
      const endTime = new Date(today.getTime() + 3600000); // Add 1 hour (3600000 ms)
      
      const sessionData = {
        subject: "Test Study Session",
        userId: "current-user",
        duration: 3600, // 1 hour in seconds
        notes: "Test session for Friday 5-6 PM",
        color: "#FF6B6B",
        isActive: false,
        createdAt: today,
        updatedAt: endTime
      };
      
      const sessionId = await saveStudySession(sessionData);
      // Test session added
      
      // Reload sessions to show the new one
      const sessions = await getStudySessions();
      setStudySessions(sessions);
      
      Alert.alert("Success", "Test session added to Firebase!");
    } catch (error) {
      console.error("Error adding test session:", error);
      Alert.alert("Error", "Failed to add test session");
    }
  };

  const getSessionForTime = (hour: number, minute: number) => {
    const timeInHours = hour + minute / 60;
    
    return studySessions.find(session => {
      // Use the actual Firebase timestamps
      const sessionStart = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
      const sessionEnd = session.updatedAt?.toDate ? session.updatedAt.toDate() : new Date(session.updatedAt);
      
      const startHour = sessionStart.getHours() + sessionStart.getMinutes() / 60;
      const endHour = sessionEnd.getHours() + sessionEnd.getMinutes() / 60;
      
      // Session check
      
      return timeInHours >= startHour && timeInHours <= endHour;
    });
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
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          {/* Time slots */}
          {timeSlots.map((slot, index) => {
            const hour = slot.hour;
            const minute = slot.minute;
            const session = getSessionForTime(hour, minute);
            const isCurrent = isCurrentTime(slot) && isToday;
            
            // Debug current time detection
            if (isToday && (hour === 15 || hour === 16)) {
              console.log(`🕐 Time slot ${hour}:${minute.toString().padStart(2, '0')} - isCurrent: ${isCurrent}`);
              if (isCurrent) {
                console.log(`✅ Current time line should appear in slot ${hour}:${minute.toString().padStart(2, '0')}`);
              }
            }
            
            const isHalfHour = minute === 30;

  return (
              <View key={index} style={styles.timeSlot} onLayout={onTimeSlotLayout}>
                {/* Time label */}
                <View style={styles.timeLabel}>
                  <Text style={[
                    styles.timeText,
                    isCurrent && styles.currentTimeText
                  ]}>
                    {formatCalendarTime(slot.displayTime)}
                  </Text>
                </View>

                {/* Time line container */}
                <View style={styles.timeLineContainer}>
                  <View style={[
                    styles.timeLine,
                    isHalfHour && styles.halfHourLine
                  ]} />
                  
                  {/* Current time indicator - only show on today */}
                  {isCurrent && isToday && (
                    <>
                      {/* Time line at exact position */}
                      <View style={[
                        styles.currentTimeLine,
                        { 
                          backgroundColor: "#007AFF",
                          position: 'absolute',
                          top: getCurrentTimePosition(slot),
                          left: 0,
                          right: 0,
                          height: 2
                        }
                      ]} />
                      
                      {/* Circle above the line */}
                      <View style={[
                        styles.currentTimeDot,
                        { 
                          backgroundColor: "#007AFF",
                          position: 'absolute',
                          top: getCurrentTimePosition(slot) - 4, // 4px above the line
                          left: -4 // Center the circle
                        }
                      ]} />
                      
                      {/* Time label */}
                      <Text style={[
                        styles.currentTimeLabel, 
                        { 
                          backgroundColor: "#007AFF",
                          position: 'absolute',
                          top: getCurrentTimePosition(slot) - 8,
                          right: 10
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





                  {/* Test purple line at 4:30 PM, 0px down */}
                  {slot.hour === 16 && slot.minute === 30 && (
                    <>
                      {/* Purple line at exact position */}
                      <View style={[
                        styles.currentTimeLine,
                        { 
                          backgroundColor: "#8B5CF6",
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 2
                        }
                      ]} />
                      
                      {/* Purple circle above the line */}
                      <View style={[
                        styles.currentTimeDot,
                        { 
                          backgroundColor: "#8B5CF6",
                          position: 'absolute',
                          top: -4, // 4px above the line
                          left: -4 // Center the circle
                        }
                      ]} />
                    </>
                  )}

                  {/* Start time line indicators for all sessions */}
                  {studySessions.map((session, index) => {
                    const sessionStart = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
                    const sessionHour = sessionStart.getHours();
                    const sessionMinute = sessionStart.getMinutes();
                    const sessionTimeInMinutes = sessionHour * 60 + sessionMinute;
                    
                    // Check if this session starts in the current time slot
                    const slotTimeInMinutes = hour * 60 + minute;
                    const isInCurrentSlot = sessionTimeInMinutes >= slotTimeInMinutes && 
                      sessionTimeInMinutes < slotTimeInMinutes + 30;
                    
                    if (!isInCurrentSlot) return null;
                    
                    
                    // Calculate exact position within the 30-minute slot using same calculation as current time
                    const minutesWithinSlot = sessionTimeInMinutes - slotTimeInMinutes;
                    const topPosition = minutesWithinSlot * getPixelsPerMinute();
                    
                    // Session positioning (no logging)

  return (
                      <>
                        {/* Session line at exact position */}
                        <View 
                          key={`session-line-${index}`}
                          style={[
                            styles.currentTimeLine,
                            { 
                              backgroundColor: "#FF3B30",
                              position: 'absolute',
                              top: topPosition,
                              left: 0,
                              right: 0,
                              height: 2
                            }
                          ]} 
                        />
                        
                        {/* Session circle above the line */}
                        <View 
                          key={`session-dot-${index}`}
                          style={[
                            styles.currentTimeDot,
                            { 
                              backgroundColor: "#FF3B30",
                              position: 'absolute',
                              top: topPosition - 4, // 4px above the line
                              left: -4 // Center the circle
                            }
                          ]} 
                        />
                      </>
                    );
                  })}
                  
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Test Button */}
      <View style={styles.testButtonContainer}>
        <TouchableOpacity style={styles.testButton} onPress={addTestSession}>
          <Text style={styles.testButtonText}>Add Test Session (Today 5-6 PM)</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>
          {isToday ? "Today's Sessions" : `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Sessions`}
        </Text>
        
        {studySessions.length > 0 ? (
          studySessions.map((session) => (
            <View key={session.id} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: session.color || "#2D5A27" }]} />
              <Text style={styles.legendText}>{session.subject}</Text>
              <Text style={styles.legendTime}>
                {formatFirebaseTime(session.createdAt)} - {formatFirebaseTime(session.updatedAt)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noSessionsText}>No study sessions for this day</Text>
        )}
      </View>

      {/* Floating Plus Button */}
      <TouchableOpacity 
        style={[
          styles.floatingButton,
          isRecording && styles.recordingButton
        ]}
        onPress={() => setShowRecordModal(true)}
      >
        <Ionicons 
          name={isRecording ? "stop" : "add"} 
          size={28} 
          color="white" 
        />
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
  },
  timeSlot: {
    flexDirection: "row",
    height: 60, // Fixed height for time slots
    paddingHorizontal: 20,
    position: 'relative', // Allow absolute positioning within time slots
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  timeLabel: {
    width: 80,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingRight: 10,
    paddingTop: 0,
    transform: [{ translateY: -8 }], // Move time text up to overlap with border
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
    justifyContent: "flex-start",
    paddingTop: 0, // Position line at the very top to overlap with border
  },
  timeLine: {
    height: 2,
    backgroundColor: "#E5E5EA",
    width: "100%",
  },
  halfHourLine: {
    backgroundColor: "#D1D5DB",
    height: 1,
  },
  currentTimeLine: {
    backgroundColor: "#E5E5EA",
    height: 3,
  },
  currentTimeIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "transparent",
  },
  currentTimeLabel: {
    position: "absolute",
    right: 10,
    top: -8,
    backgroundColor: "#007AFF",
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2D5A27",
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
  recordingButton: {
    backgroundColor: "#FF3B30", // Red color when recording
    shadowColor: "#FF3B30",
    transform: [{ scale: 1.1 }], // Slightly larger when recording
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
  testButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  testButton: {
    backgroundColor: "#2D5A27",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  testButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
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
});