import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return false;
  }

  return true;
};

export const getExpoPushToken = async () => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    // For now, we'll skip the push token since it requires Expo project configuration
    // This is mainly needed for server-sent push notifications
    console.log('Notification permissions granted - local notifications ready');
    return 'local-notifications-enabled';
  } catch (error) {
    console.error('Error getting expo push token:', error);
    return null;
  }
};

export const scheduleLocalNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
    
    // Increment badge count
    const currentCount = await getNotificationBadgeCount();
    await setNotificationBadgeCount(currentCount + 1);
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
};

export const scheduleStudyReminder = async (minutesFromNow = 30) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Study Reminder",
        body: "Time to get back to studying! 📚",
        data: { type: 'study_reminder' },
        sound: 'default',
      },
      trigger: {
        seconds: minutesFromNow * 60,
      },
    });
    
    // Increment badge count
    const currentCount = await getNotificationBadgeCount();
    await setNotificationBadgeCount(currentCount + 1);
  } catch (error) {
    console.error('Error scheduling study reminder:', error);
  }
};

export const scheduleAchievementNotification = async (achievement) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Achievement Unlocked! 🏆",
        body: `Congratulations! You've earned: ${achievement}`,
        data: { type: 'achievement', achievement },
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
    
    // Increment badge count
    const currentCount = await getNotificationBadgeCount();
    await setNotificationBadgeCount(currentCount + 1);
  } catch (error) {
    console.error('Error scheduling achievement notification:', error);
  }
};

export const scheduleFollowNotification = async (followerName) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "New Follower! 👥",
        body: `${followerName} started following you`,
        data: { type: 'follow', followerName },
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
    
    // Increment badge count
    const currentCount = await getNotificationBadgeCount();
    await setNotificationBadgeCount(currentCount + 1);
  } catch (error) {
    console.error('Error scheduling follow notification:', error);
  }
};

export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
};

export const getNotificationBadgeCount = async () => {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
};

export const setNotificationBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
};
