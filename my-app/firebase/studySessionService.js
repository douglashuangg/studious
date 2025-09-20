import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit,
  where,
  onSnapshot
} from "firebase/firestore";
import { db } from "./firebaseInit.js";

// Collection name for study sessions
const STUDY_SESSIONS_COLLECTION = "studySessions";

// Save a new study session
export const saveStudySession = async (sessionData) => {
  try {
    const docRef = await addDoc(collection(db, STUDY_SESSIONS_COLLECTION), {
      ...sessionData,
      // Use the provided createdAt and updatedAt timestamps
      // Only set current time if not provided
      createdAt: sessionData.createdAt || new Date(),
      updatedAt: sessionData.updatedAt || new Date(),
    });
    console.log("Study session saved with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving study session: ", error);
    throw error;
  }
};

// Get all study sessions
export const getStudySessions = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, STUDY_SESSIONS_COLLECTION));
    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return sessions;
  } catch (error) {
    console.error("Error getting study sessions: ", error);
    throw error;
  }
};

// Get study sessions for a specific user
export const getUserStudySessions = async (userId) => {
  try {
    const q = query(
      collection(db, STUDY_SESSIONS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return sessions;
  } catch (error) {
    console.error("Error getting user study sessions: ", error);
    throw error;
  }
};

// Update a study session
export const updateStudySession = async (sessionId, updateData) => {
  try {
    const sessionRef = doc(db, STUDY_SESSIONS_COLLECTION, sessionId);
    await updateDoc(sessionRef, {
      ...updateData,
      updatedAt: new Date(),
    });
    console.log("Study session updated: ", sessionId);
  } catch (error) {
    console.error("Error updating study session: ", error);
    throw error;
  }
};

// Delete a study session
export const deleteStudySession = async (sessionId) => {
  try {
    await deleteDoc(doc(db, STUDY_SESSIONS_COLLECTION, sessionId));
    console.log("Study session deleted: ", sessionId);
  } catch (error) {
    console.error("Error deleting study session: ", error);
    throw error;
  }
};

// Listen to real-time updates for study sessions
export const subscribeToStudySessions = (callback) => {
  const q = query(
    collection(db, STUDY_SESSIONS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(sessions);
  });
};

// Get currently active study sessions (for the "Currently Studying" section)
export const getActiveStudySessions = async () => {
  try {
    // Simplified query - just get all sessions for now
    // We'll add filtering and ordering after creating the index
    const querySnapshot = await getDocs(collection(db, STUDY_SESSIONS_COLLECTION));
    const sessions = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter active sessions in JavaScript for now
      if (data.isActive === true) {
        sessions.push({
          id: doc.id,
          ...data
        });
      }
    });
    // Sort by startTime in JavaScript
    sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    return sessions;
  } catch (error) {
    console.error("Error getting active study sessions: ", error);
    throw error;
  }
};
