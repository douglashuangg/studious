import { Text, View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseInit";
import * as ImagePicker from 'expo-image-picker';

export default function SetupProfilePicture() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [hasProfilePicture, setHasProfilePicture] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  const handleSkip = () => {
    Alert.alert(
      "Skip Profile Picture",
      "You can add a profile picture later. Are you sure you want to skip?",
      [
        { text: "Add Picture", style: "cancel" },
        { text: "Skip", style: "destructive", onPress: () => router.replace("/") }
      ]
    );
  };

  const handleAddPicture = async () => {
    try {
      // Request permission to access media library
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert("Permission Required", "Please grant permission to access your photo library.");
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImageUri(result.assets[0].uri);
        setHasProfilePicture(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      
      // Update user document to mark profile picture setup as complete
      const updateData: any = {
        profilePictureSetup: true,
        updatedAt: new Date()
      };

      // If a profile picture was selected, save the URI
      if (profileImageUri) {
        updateData.profilePictureUrl = profileImageUri;
      }

      await updateDoc(doc(db, 'users', user!.uid), updateData);
      
      router.replace("/");
      
    } catch (error) {
      console.error('Error completing profile picture setup:', error);
      Alert.alert("Error", "Failed to complete setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Add Profile Picture</Text>
          <Text style={styles.welcomeSubtitle}>Make your profile more personal</Text>
        </View>
      </View>

      {/* Profile Picture Section */}
      <View style={styles.profilePictureSection}>
        <View style={styles.profilePictureContainer}>
          <View style={styles.profilePicture}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
            ) : (
              <Ionicons name="camera" size={40} color="#000000" />
            )}
          </View>
          <TouchableOpacity 
            style={styles.addPictureButton}
            onPress={handleAddPicture}
          >
            <Ionicons name="camera" size={20} color="#000000" />
            <Text style={styles.addPictureButtonText}>Add Photo</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.profilePictureLabel}>Your Profile Picture</Text>
        <Text style={styles.profilePictureSubtext}>
          Choose a photo that represents you. You can always change it later.
        </Text>
      </View>


    </ScrollView>

    {/* Fixed Bottom Buttons */}
    <View style={styles.bottomButtonContainer}>
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleSkip}
        >
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.completeButton, (loading || !hasProfilePicture) && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={loading || !hasProfilePicture}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.completeButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  welcomeContainer: {
    alignItems: "center",
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#666",
  },
  profilePictureSection: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: "#f8f9fa",
    marginBottom: 20,
  },
  profilePictureContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#E5E5EA",
    borderStyle: "dashed",
    marginBottom: 20,
  },
  addPictureButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#000000",
  },
  addPictureButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  profilePictureLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  profilePictureSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 40,
  },
  actionContainer: {
    flexDirection: "row",
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  completeButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#5A8A4A",
  },
  completeButtonDisabled: {
    backgroundColor: "#999",
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
});
