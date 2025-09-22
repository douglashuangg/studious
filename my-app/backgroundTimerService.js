import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_TIMER_TASK = 'background-timer-task';

// Background task to keep timer running when screen is off
TaskManager.defineTask(BACKGROUND_TIMER_TASK, async () => {
  try {
    console.log('Background timer task running...');
    
    // Get current timer state from storage
    const timerData = await AsyncStorage.getItem('timerData');
    if (timerData) {
      const { isRecording, startTime, pausedTime } = JSON.parse(timerData);
      
      if (isRecording && startTime && !pausedTime) {
        // Calculate elapsed time
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        
        // Update stored time
        await AsyncStorage.setItem('timerData', JSON.stringify({
          ...JSON.parse(timerData),
          lastUpdate: now,
          elapsedTime: elapsed
        }));
        
        console.log(`Background timer: ${elapsed} seconds elapsed`);
      }
    }
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background timer task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Start background timer with fallback
export const startBackgroundTimer = async () => {
  try {
    // Try to register background fetch
    const status = await BackgroundFetch.getStatusAsync();
    console.log('Background fetch status:', status);
    
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TIMER_TASK, {
          minimumInterval: 1000, // Update every second
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('Background timer started - will work when screen is off');
        return true;
      } catch (registerError) {
        console.log('Background fetch registration failed, using fallback');
        return false;
      }
    } else {
      console.log('Background fetch not available, using fallback method');
      return false;
    }
  } catch (error) {
    console.error('Failed to start background timer:', error);
    console.log('Using fallback method - timer will work when app is active');
    return false;
  }
};

// Stop background timer
export const stopBackgroundTimer = async () => {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TIMER_TASK);
    console.log('Background timer stopped');
    return true;
  } catch (error) {
    console.log('Background timer task was not registered or already stopped');
    return true;
  }
};

// Save timer state to storage
export const saveTimerState = async (timerState) => {
  try {
    await AsyncStorage.setItem('timerData', JSON.stringify(timerState));
    console.log('Timer state saved:', timerState);
  } catch (error) {
    console.error('Failed to save timer state:', error);
  }
};

// Load timer state from storage
export const loadTimerState = async () => {
  try {
    const timerData = await AsyncStorage.getItem('timerData');
    if (timerData) {
      return JSON.parse(timerData);
    }
    return null;
  } catch (error) {
    console.error('Failed to load timer state:', error);
    return null;
  }
};

// Clear timer state
export const clearTimerState = async () => {
  try {
    await AsyncStorage.removeItem('timerData');
    console.log('Timer state cleared');
  } catch (error) {
    console.error('Failed to clear timer state:', error);
  }
};

// Calculate elapsed time from stored start time
export const calculateElapsedTime = (startTime) => {
  if (!startTime) return 0;
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);
  return Math.max(0, elapsed);
};

// Restore timer state when app returns to foreground
export const restoreTimerState = async () => {
  try {
    const savedState = await loadTimerState();
    if (savedState && savedState.isRecording && savedState.startTime) {
      const elapsed = calculateElapsedTime(savedState.startTime);
      return {
        ...savedState,
        elapsedTime: elapsed
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to restore timer state:', error);
    return null;
  }
};