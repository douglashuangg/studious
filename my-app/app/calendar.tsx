import { Text, View, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";
import { getStudySessions as loadStudySessionsFromFirebase } from "../firebase/studySessionService.js";

const { height: screenHeight } = Dimensions.get('window');

export default function Calendar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [studySessions, setStudySessions] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load study sessions from Firebase
  useEffect(() => {
    loadStudySessions();
  }, [selectedDate]);

  const loadStudySessions = async () => {
    try {
      const sessions = await loadStudySessionsFromFirebase();
      setStudySessions(sessions);
      console.log("=== CALENDAR DEBUG ===");
      console.log("Total sessions loaded:", sessions.length);
      console.log("All sessions:", sessions);
      console.log("Selected date:", selectedDate.toDateString());
      
      sessions.forEach((session, index) => {
        console.log(`Session ${index}:`, {
          id: session.id,
          subject: session.subject,
          startTime: session.startTime,
          startTimeType: typeof session.startTime,
          startTimeDate: new Date(session.startTime),
          startTimeString: new Date(session.startTime).toDateString()
        });
      });
      
      const filteredSessions = sessions.filter(session => {
        const sessionDate = new Date(session.startTime);
        const matches = sessionDate.toDateString() === selectedDate.toDateString();
        console.log("Date comparison:", {
          sessionDate: sessionDate.toDateString(),
          selectedDate: selectedDate.toDateString(),
          matches: matches
        });
        return matches;
      });
      
      console.log("Filtered sessions for selected date:", filteredSessions);
    } catch (error) {
      console.error("Error loading study sessions:", error);
    }
  };

  // Generate time slots for the day (24 hours)
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

  // Calculate scroll position to center on current time
  useEffect(() => {
    const timeSlotHeight = 60; // Height of each time slot
    const currentTimeIndex = timeSlots.findIndex(slot => {
      const slotHour = slot.getHours();
      const slotMinute = slot.getMinutes();
      const slotTimeInMinutes = slotHour * 60 + slotMinute;
      return slotTimeInMinutes >= currentTimeInMinutes;
    });
    
    if (currentTimeIndex !== -1) {
      const scrollToPosition = Math.max(0, (currentTimeIndex * timeSlotHeight) - (screenHeight / 2));
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: scrollToPosition, animated: true });
      }, 100);
    }
  }, [selectedDate]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${dayName}, ${monthName} ${day}, ${year}`;
  };

  const isCurrentTime = (slot: Date) => {
    const slotHour = slot.getHours();
    const slotMinute = slot.getMinutes();
    const slotTimeInMinutes = slotHour * 60 + slotMinute;
    return Math.abs(slotTimeInMinutes - currentTimeInMinutes) <= 15; // Within 15 minutes
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


  const getStudySessionsForDate = () => {
    // Filter sessions for the selected date
    const selectedDateString = selectedDate.toDateString();
    const filteredSessions = studySessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      const sessionDateString = sessionDate.toDateString();
      console.log("Comparing dates:", {
        selected: selectedDateString,
        session: sessionDateString,
        matches: sessionDateString === selectedDateString
      });
      return sessionDateString === selectedDateString;
    });
    console.log("Filtered sessions for date:", filteredSessions);
    return filteredSessions;
  };

  const sessionsForDate = getStudySessionsForDate();

  const getSessionForTime = (hour: number, minute: number) => {
    const timeInHours = hour + minute / 60;
    return sessionsForDate.find(session => {
      const startHour = new Date(session.startTime).getHours();
      const startMinute = new Date(session.startTime).getMinutes();
      const endHour = new Date(session.endTime).getHours();
      const endMinute = new Date(session.endTime).getMinutes();
      const sessionStartTime = startHour + startMinute / 60;
      const sessionEndTime = endHour + endMinute / 60;
      
      return timeInHours >= sessionStartTime && timeInHours <= sessionEndTime;
    });
  };


  return (
    <View style={styles.container}>
      {/* Header with Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color="#2D5A27" />
        </TouchableOpacity>
        
        <View style={styles.dateContainer}>
          <Text style={styles.title}>Study Calendar</Text>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <TouchableOpacity onPress={loadStudySessions} style={styles.refreshButton}>
            <Ionicons name="refresh" size={16} color="#2D5A27" />
          </TouchableOpacity>
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
          onScroll={(event) => setScrollPosition(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          {/* Time slots */}
          {timeSlots.map((slot, index) => {
            const hour = slot.getHours();
            const minute = slot.getMinutes();
            const session = getSessionForTime(hour, minute);
            const isCurrent = isCurrentTime(slot);
            const isHalfHour = minute === 30;

            return (
              <View key={index} style={styles.timeSlot}>
                {/* Time label */}
                <View style={styles.timeLabel}>
                  <Text style={[styles.timeText, isCurrent && styles.currentTimeText]}>
                    {formatTime(slot)}
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
                  {session && minute === 0 && (() => {
                    const startTime = new Date(session.startTime);
                    const endTime = new Date(session.endTime);
                    const startHour = startTime.getHours();
                    const startMinute = startTime.getMinutes();
                    const endHour = endTime.getHours();
                    const endMinute = endTime.getMinutes();
                    
                    const startTimeInHours = startHour + startMinute / 60;
                    const endTimeInHours = endHour + endMinute / 60;
                    const durationInHours = endTimeInHours - startTimeInHours;
                    const heightInPixels = Math.max(durationInHours * 60, 30); // Minimum 30px height
                    
                    console.log("Rendering session block:", {
                      subject: session.subject,
                      startTime: startTime.toLocaleTimeString(),
                      endTime: endTime.toLocaleTimeString(),
                      height: heightInPixels,
                      hour: hour,
                      minute: minute
                    });
                    
                    return (
                      <View style={[
                        styles.sessionBlock,
                        { 
                          backgroundColor: session.color,
                          height: heightInPixels,
                          top: 0
                        }
                      ]}>
                        <Text style={styles.sessionText}>{session.subject}</Text>
                        <Text style={styles.sessionTime}>
                          {startTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          })} - {endTime.toLocaleTimeString('en-US', { 
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

        {/* Current time line overlay */}
        <View style={styles.currentTimeOverlay}>
          <View style={styles.currentTimeLineOverlay} />
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>
          {`${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Sessions`}
        </Text>
        {sessionsForDate.length > 0 ? (
          sessionsForDate.map((session) => {
            const startTime = new Date(session.startTime);
            const endTime = new Date(session.endTime);
            const startTimeStr = startTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            const endTimeStr = endTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            
            return (
              <View key={session.id} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: session.color }]} />
                <Text style={styles.legendText}>{session.subject}</Text>
                <Text style={styles.legendTime}>
                  {startTimeStr} - {endTimeStr}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.noSessionsText}>No study sessions scheduled for this day</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
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
  title: {
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
  dateButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
    backgroundColor: "#f0f0f0",
    padding: 8,
    borderRadius: 8,
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
  currentTimeOverlay: {
    position: "absolute",
    left: 100,
    right: 20,
    top: 0,
    bottom: 0,
    pointerEvents: "none",
  },
  currentTimeLineOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#2D5A27",
    opacity: 0.3,
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
});