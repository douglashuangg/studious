import { Text, View, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import * as ImagePicker from 'expo-image-picker';
import { uploadProfilePicture } from "../firebase/profilePictureService";

export default function EditProfile() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [school, setSchool] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleSave = useCallback(async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to edit your profile.");
      return;
    }


    // Only validate if fields are truly empty (not just whitespace)
    if (!firstName || firstName.trim() === '') {
      Alert.alert("Required Fields", "First name is required.");
      return;
    }
    
    if (!lastName || lastName.trim() === '') {
      Alert.alert("Required Fields", "Last name is required.");
      return;
    }
    
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    

    if (!username.trim()) {
      Alert.alert("Required Fields", "Username is required.");
      return;
    }

    try {
      setSaving(true);
      
      const userData = {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        username: username.trim(),
        school: school.trim(),
        bio: bio.trim(),
        displayName: `${trimmedFirstName} ${trimmedLastName}`,
        email: user.email,
        createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date(),
        updatedAt: new Date()
      };


      // Check if user document exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        // Update existing document
        await updateDoc(userDocRef, userData);
      } else {
        // Create new document
        await setDoc(userDocRef, userData);
      }
      
      // Navigate back to profile page after successful save
      navigation.goBack();
      
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      Alert.alert("Error", `Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [user, firstName, lastName, username, school, bio, navigation]);

  // Set up dynamic header with save button
  useEffect(() => {
    navigation.setOptions({
      headerTintColor: '#000000', // Black back button
      headerRight: () => (
        <TouchableOpacity 
          style={{ marginRight: 10 }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#4A7C59" />
          ) : (
            <Text style={{ 
              color: saving ? '#999' : '#4A7C59', 
              fontSize: 16, 
              fontWeight: '600' 
            }}>Save</Text>
          )}
        </TouchableOpacity>
      )
    });
  }, [navigation, saving, loading, handleSave]);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;
      
      
      try {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFirstName(userData.firstName || "");
          setLastName(userData.lastName || "");
          setUsername(userData.username || user.email?.split('@')[0] || "");
          setSchool(userData.school || "");
          setBio(userData.bio || "");
          setProfilePictureUrl(userData.profilePictureUrl || "");
        } else {
          // If no user document exists, create one with basic info
          setFirstName(user.displayName?.split(' ')[0] || "");
          setLastName(user.displayName?.split(' ').slice(1).join(' ') || "");
          setUsername(user.email?.split('@')[0] || "");
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert("Error", "Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []); // Only run once on mount

  const handleImagePicker = () => {
    Alert.alert(
      'Select Profile Picture',
      'Choose how you want to add a profile picture',
      [
        { text: 'Camera', onPress: () => pickImage('camera') },
        { text: 'Photo Library', onPress: () => pickImage('library') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Camera permission is required to take photos');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          exif: false, // Remove EXIF data to reduce size
        });
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Photo library permission is required to select photos');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          exif: false, // Remove EXIF data to reduce size
        });
      }

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (imageUri: string) => {
    if (!user) return;
    
    try {
      setUploading(true);
      const downloadURL = await uploadProfilePicture(user.uid, imageUri);
      setProfilePictureUrl(downloadURL);
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', `Failed to upload profile picture: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: () => logout() }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2D5A27" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Profile Picture Section */}
      <View style={styles.profilePictureSection}>
        <TouchableOpacity 
          style={styles.profilePictureContainer}
          onPress={handleImagePicker}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.profilePicture}>
              <Ionicons name="cloud-upload" size={30} color="#666" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.profilePicture}
            />
          ) : (
            <View style={styles.profilePicture}>
              <Text style={styles.profilePictureText}>
                {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.editPictureButton}
            onPress={handleImagePicker}
            disabled={uploading}
          >
            <Ionicons name="camera" size={20} color="#2D5A27" />
          </TouchableOpacity>
        </TouchableOpacity>
        <Text style={styles.profilePictureLabel}>Profile Picture</Text>
        <Text style={styles.profilePictureSubtext}>Tap to change</Text>
      </View>

      {/* Form Fields */}
      <View style={styles.formContainer}>
        {/* First Name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>First Name *</Text>
          <TextInput
            style={styles.textInput}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            placeholderTextColor="#999"
            maxLength={50}
          />
        </View>

        {/* Last Name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Last Name *</Text>
          <TextInput
            style={styles.textInput}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter your last name"
            placeholderTextColor="#999"
            maxLength={50}
          />
        </View>

        {/* Username */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Username *</Text>
          <TextInput
            style={styles.textInput}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="#999"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.fieldHint}>This will be your unique identifier (e.g., @{username || 'username'})</Text>
        </View>

        {/* School */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>School</Text>
          <TextInput
            style={styles.textInput}
            value={school}
            onChangeText={setSchool}
            placeholder="Enter your school or university"
            placeholderTextColor="#999"
            maxLength={100}
          />
        </View>

        {/* Bio */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            style={[styles.textInput, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={200}
          />
          <Text style={styles.characterCount}>{bio.length}/200</Text>
        </View>

        {/* Account Info */}
        <View style={styles.accountInfoContainer}>
          <Text style={styles.accountInfoTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || "Not available"}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Joined</Text>
            <Text style={styles.infoValue}>
              {user?.metadata?.creationTime ? 
                new Date(user.metadata.creationTime).toLocaleDateString() : 
                "Unknown"
              }
            </Text>
          </View>
        </View>
      </View>


      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  saveButton: {
    padding: 8,
    minWidth: 60,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D5A27",
  },
  profilePictureSection: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    marginBottom: 20,
  },
  profilePictureContainer: {
    position: "relative",
    marginBottom: 15,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#E5E5EA",
  },
  profilePictureText: {
    fontSize: 40,
    color: "#666",
  },
  editPictureButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2D5A27",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profilePictureLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 5,
  },
  profilePictureSubtext: {
    fontSize: 14,
    color: "#666",
  },
  uploadingText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#FFFFFF",
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
  characterCount: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    marginTop: 5,
  },
  fieldHint: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    fontStyle: "italic",
  },
  accountInfoContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  accountInfoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: "#666",
  },
  infoValue: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  logoutContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  logoutButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
});
