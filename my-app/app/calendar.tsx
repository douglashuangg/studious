import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, Dimensions, AppState } from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import { saveStudySession } from "../firebase/studySessionService.js";
import { 
  startBackgroundTimer, 
  stopBackgroundTimer, 
  saveTimerState, 
  loadTimerState, 
  clearTimerState,
  restoreTimerState,
  calculateElapsedTime
} from "../backgroundTimerService.js";

const { height: screenHeight } = Dimensions.get('window');

export default function Calendar() {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [timeSlotHeight, setTimeSlotHeight] = useState(60); // Default height
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

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
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

  const handleStart = async () => {
    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a subject for your study session.");
      return;
    }
    
    if (!isRecording) {
      setSeconds(0);
      const startTime = new Date();
      setSessionStartTime(startTime); // Record the start time
      
      // Start background timer (may not be available on all devices)
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
    
    // Stop background timer and clear state
    await stopBackgroundTimer();
    await clearTimerState();
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

  // Function to add test session to Firebase
  const addTestSession = async () => {
    try {
      const { saveStudySession } = await import("../firebase/studySessionService.js");
      
      // Create session for CURRENT TIME
      const now = new Date();
      
      // Create end time - 1 hour later from current time
      const endTime = new Date(now.getTime() + 3600000); // Add 1 hour (3600000 ms)
      
      const sessionData = {
        subject: "Test Study Session",
        duration: 3600, // 1 hour in seconds
        notes: `Test session from ${now.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`,
        color: "#FF6B6B",
        isActive: false,
        createdAt: now,
        updatedAt: new Date(now.getTime() + 3600000) // now + 1 hour
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
                          height: 2,
                          zIndex: 10 // Above session blocks
                        }
                      ]} />
                      
                      {/* Circle above the line */}
                      <View style={[
                        styles.currentTimeDot,
                        { 
                          backgroundColor: "#007AFF",
                          position: 'absolute',
                          top: getCurrentTimePosition(slot) - 4, // 4px above the line
                          left: -4, // Center the circle
                          zIndex: 10 // Above session blocks
                        }
                      ]} />
                      
                      {/* Time label */}
                      <Text style={[
                        styles.currentTimeLabel, 
                        { 
                          backgroundColor: "#007AFF",
                          position: 'absolute',
                          top: getCurrentTimePosition(slot) - 8,
                          right: 10,
                          zIndex: 10 // Above session blocks
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






                  {/* Study session blocks - render based on start and end times */}
                  {studySessions.map((session) => {
                    // Get the formatted times to extract hours and minutes
                    const startTimeFormatted = session.startTime ? formatFirebaseTime(session.startTime) : formatFirebaseTime(session.createdAt);
                    const endTimeFormatted = session.endTime ? formatFirebaseTime(session.endTime) : formatFirebaseTime(session.updatedAt);
                    
                    // Extract start time
                    const startHour = parseInt(startTimeFormatted.split(':')[0]);
                    const startMinute = parseInt(startTimeFormatted.split(':')[1].split(' ')[0]);
                    const startIsAM = startTimeFormatted.includes('AM');
                    const adjustedStartHour = startIsAM ? (startHour === 12 ? 0 : startHour) : (startHour === 12 ? 12 : startHour + 12);
                    
                    // Extract end time
                    const endHour = parseInt(endTimeFormatted.split(':')[0]);
                    const endMinute = parseInt(endTimeFormatted.split(':')[1].split(' ')[0]);
                    const endIsAM = endTimeFormatted.includes('AM');
                    const adjustedEndHour = endIsAM ? (endHour === 12 ? 0 : endHour) : (endHour === 12 ? 12 : endHour + 12);
                    
                    console.log(`Session: ${session.subject}`);
                    console.log(`Start: ${startTimeFormatted} (${adjustedStartHour}:${startMinute})`);
                    console.log(`End: ${endTimeFormatted} (${adjustedEndHour}:${endMinute})`);
                    console.log(`Current slot: ${hour}:${minute}`);
                    
                    // Check if this session overlaps with this time slot
                    const sessionStartsInThisSlot = adjustedStartHour === hour && 
                      (startMinute >= minute && startMinute < minute + 30);
                    const sessionEndsInThisSlot = adjustedEndHour === hour && 
                      (endMinute >= minute && endMinute < minute + 30);
                    const sessionSpansThisSlot = adjustedStartHour < hour && adjustedEndHour > hour;
                    const sessionContinuesFromPrevious = adjustedStartHour < hour && adjustedEndHour === hour && endMinute > minute;
                    const sessionContinuesToNext = adjustedStartHour === hour && startMinute < minute + 30 && adjustedEndHour > hour;
                    
                    const sessionOverlapsSlot = sessionStartsInThisSlot || sessionEndsInThisSlot || sessionSpansThisSlot || 
                      sessionContinuesFromPrevious || sessionContinuesToNext;
                    
                    if (!sessionOverlapsSlot) {
                      return null;
                    }
                    
                    // Calculate position and height within the slot
                    let topPosition = 0;
                    let height = 0;
                    
                    if (sessionStartsInThisSlot) {
                      // Session starts in this slot
                      topPosition = (startMinute - minute) * getPixelsPerMinute();
                      if (sessionEndsInThisSlot) {
                        // Session ends in this slot too
                        height = (endMinute - startMinute) * getPixelsPerMinute();
                      } else {
                        // Session continues to next slot(s)
                        height = (30 - (startMinute - minute)) * getPixelsPerMinute();
                      }
                    } else if (sessionEndsInThisSlot) {
                      // Session ends in this slot
                      topPosition = 0;
                      height = (endMinute - minute) * getPixelsPerMinute();
                    } else if (sessionSpansThisSlot || sessionContinuesFromPrevious || sessionContinuesToNext) {
                      // Session spans the entire slot
                      topPosition = 0;
                      height = 30 * getPixelsPerMinute();
                    }
                    
                    return (
                      <View
                        key={session.id}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: topPosition,
                          height: Math.max(height, 4), // Minimum 4px height
                          backgroundColor: '#34C759', // Green block
                          zIndex: 10,
                        }}
                      />
                    );
                  })}

                  {/* Test session block 4:31-4:33 PM */}
                  {slot.hour === 16 && slot.minute === 30 && (
                    <View style={[
                      styles.sessionBlock,
                      {
                        backgroundColor: "#FF6B6B",
                        height: 2, // 2 minutes = 4px, but let's make it 2px for a thin line
                        top: 2, // 1 minute into slot (1 × 2px = 2px)
                        left: 0,
                        right: 0,
                      }
                    ]}>
                      <Text style={styles.sessionText}>Test 4:31-4:33</Text>
                      <Text style={styles.sessionTime}>4:31 PM - 4:33 PM</Text>
                    </View>
                  )}

                  {/* Study session blocks - only render at the start of each session */}
                  {session && minute === 0 && (() => {
                    const sessionStart = session.createdAt?.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
                    const sessionEnd = session.updatedAt?.toDate ? session.updatedAt.toDate() : new Date(session.updatedAt);
                    
                    // Calculate the duration and height
                    const durationMs = sessionEnd.getTime() - sessionStart.getTime();
                    const durationMinutes = durationMs / (1000 * 60);
                    const heightInPixels = durationMinutes * getPixelsPerMinute();
                    
                    // Calculate position within the current time slot
                    const slotStartTime = new Date(selectedDate);
                    slotStartTime.setHours(hour, minute, 0, 0);
                    const minutesIntoSlot = (sessionStart.getTime() - slotStartTime.getTime()) / (1000 * 60);
                    const topPosition = minutesIntoSlot * getPixelsPerMinute();
                    
                    return (
                      <View style={[
                        styles.sessionBlock,
                        {
                          backgroundColor: session.color || "#2D5A27",
                          height: heightInPixels, // Use actual calculated height
                          top: topPosition, // Position based on exact start time
                          left: 0,
                          right: 0,
                        }
                      ]}>
                        <Text style={styles.sessionText}>{session.subject}</Text>
                        <Text style={styles.sessionTime}>
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
                  })()}

                  
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Test Button */}
      <View style={styles.testButtonContainer}>
        <TouchableOpacity style={styles.testButton} onPress={addTestSession}>
          <Text style={styles.testButtonText}>Add Test Session (Current Time + 1hr)</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendHeader}>
          <Text style={styles.legendTitle}>
            {isToday ? "Today's Sessions" : `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Sessions`}
          </Text>
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
          </TouchableOpacity>
        </View>
        
        {studySessions.length > 0 ? (
          studySessions.map((session, index) => (
            <View key={session.id || index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: session.color || "#2D5A27" }]} />
              <View style={styles.legendContent}>
                <Text style={styles.legendText}>{session.subject}</Text>
                <Text style={styles.legendTime}>
                  {session.startTime ? formatFirebaseTime(session.startTime) : formatFirebaseTime(session.createdAt)} - {session.endTime ? formatFirebaseTime(session.endTime) : formatFirebaseTime(session.updatedAt)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noSessionsText}>No study sessions for this day</Text>
        )}
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
  legendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  recordButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2D5A27",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2D5A27",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  legendContent: {
    flex: 1,
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  debugText: {
    fontSize: 10,
    color: "#666",
    marginBottom: 2,
    fontFamily: "monospace",
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