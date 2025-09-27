import { storage } from './firebaseInit.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebaseInit.js';

/**
 * Upload a profile picture to Firebase Storage
 * @param {string} userId - The user's ID
 * @param {string} imageUri - The local URI of the image
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export const uploadProfilePicture = async (userId, imageUri) => {
  try {
    // Check authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to upload profile pictures');
    }
    
    if (currentUser.uid !== userId) {
      throw new Error('User ID mismatch - cannot upload for different user');
    }
    
    // Create a reference to the storage location
    const imageRef = ref(storage, `profile-pictures/${userId}/profile.jpg`);
    
    // Convert the image URI to a blob
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Validate blob
    if (blob.size === 0) {
      throw new Error('Image file is empty or corrupted');
    }
    
    if (blob.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Image file is too large (max 10MB)');
    }
    
    // Upload the image
    const uploadTask = await uploadBytes(imageRef, blob);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(uploadTask.ref);
    
    // Update the user's profile in Firestore with the new image URL
    await updateDoc(doc(db, 'users', userId), {
      profilePictureUrl: downloadURL,
      updatedAt: new Date()
    });
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
};

/**
 * Delete a profile picture from Firebase Storage
 * @param {string} userId - The user's ID
 */
export const deleteProfilePicture = async (userId) => {
  try {
    const imageRef = ref(storage, `profile-pictures/${userId}/profile.jpg`);
    await deleteObject(imageRef);
    
    // Update the user's profile in Firestore to remove the image URL
    await updateDoc(doc(db, 'users', userId), {
      profilePictureUrl: null,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    throw error;
  }
};
