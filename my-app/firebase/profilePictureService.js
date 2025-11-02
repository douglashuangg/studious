import { storage } from './firebaseInit.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebaseInit.js';

/**
 * Validate that a URL is a valid Firebase Storage URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
const isValidFirebaseStorageUrl = (url) => {
  return url && url.startsWith('https://firebasestorage.googleapis.com/');
};

/**
 * Validate that a URL is NOT a local file URI
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is safe (not local)
 */
const isNotLocalFileUri = (url) => {
  return !url || !url.startsWith('file://');
};

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
    
    // Validate input URI is not already a Firebase Storage URL
    if (isValidFirebaseStorageUrl(imageUri)) {
      console.warn('⚠️ Attempted to upload an already uploaded Firebase Storage URL');
      return imageUri; // Return the existing URL
    }
    
    // Validate input URI is not a local file URI (shouldn't happen, but safety check)
    if (!isNotLocalFileUri(imageUri)) {
      throw new Error('Invalid image URI: local file URIs cannot be uploaded');
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
    
    // Validate the download URL before saving
    if (!isValidFirebaseStorageUrl(downloadURL)) {
      throw new Error('Invalid download URL received from Firebase Storage');
    }
    
    // Update the user's profile in Firestore with the new image URL
    await updateDoc(doc(db, 'users', userId), {
      profilePictureUrl: downloadURL,
      updatedAt: new Date()
    });
    
    console.log('✅ Profile picture uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    throw error;
  }
};

/**
 * Safely update a user's profile picture URL with validation
 * @param {string} userId - The user's ID
 * @param {string} profilePictureUrl - The profile picture URL to save
 * @returns {Promise<void>}
 */
export const safeUpdateProfilePictureUrl = async (userId, profilePictureUrl) => {
  try {
    // Validate the URL before saving
    if (profilePictureUrl && !isValidFirebaseStorageUrl(profilePictureUrl)) {
      if (profilePictureUrl.startsWith('file://')) {
        console.error('❌ Attempted to save local file URI to database:', profilePictureUrl);
        throw new Error('Cannot save local file URI to database. Please upload the image first.');
      } else {
        console.warn('⚠️ Attempted to save non-Firebase Storage URL:', profilePictureUrl);
        // Allow other HTTPS URLs but log a warning
      }
    }
    
    // Update the user's profile in Firestore
    await updateDoc(doc(db, 'users', userId), {
      profilePictureUrl: profilePictureUrl || null,
      updatedAt: new Date()
    });
    
    console.log('✅ Profile picture URL updated safely:', profilePictureUrl);
  } catch (error) {
    console.error('❌ Error updating profile picture URL:', error);
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

// Export validation functions for use in other parts of the app
export { isValidFirebaseStorageUrl, isNotLocalFileUri };
