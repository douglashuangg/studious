import React, { useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { isValidFirebaseStorageUrl, isNotLocalFileUri } from '../firebase/profilePictureService';

interface SafeProfileImageProps {
  uri?: string | null;
  displayName?: string;
  style?: any;
  fallbackStyle?: any;
  textStyle?: any;
}

export const SafeProfileImage: React.FC<SafeProfileImageProps> = ({
  uri,
  displayName,
  style,
  fallbackStyle,
  textStyle
}) => {
  const [imageError, setImageError] = useState(false);

  // Check if URI is valid and safe to display
  const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    
    // Reject local file URIs
    if (!isNotLocalFileUri(url)) {
      console.warn('⚠️ Rejected local file URI for profile picture:', url);
      return false;
    }
    
    // Prefer Firebase Storage URLs
    if (isValidFirebaseStorageUrl(url)) {
      return true;
    }
    
    // Accept other HTTPS URLs but log a warning
    if (url.startsWith('https://')) {
      console.warn('⚠️ Using non-Firebase Storage URL for profile picture:', url);
      return true;
    }
    
    console.warn('⚠️ Unknown URL format for profile picture:', url);
    return false;
  };

  // If no valid URI or image failed to load, show fallback
  if (!isValidUrl(uri) || imageError) {
    const initials = displayName?.split(' ').map(name => name.charAt(0)).join('').toUpperCase() || 'U';
    
    return (
      <View style={[styles.fallbackContainer, style, fallbackStyle]}>
        <Text style={[styles.fallbackText, textStyle]}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: uri! }}
      style={style}
      onError={(error) => {
        console.error('❌ Profile image failed to load:', {
          uri,
          error: error.nativeEvent.error,
          displayName
        });
        setImageError(true);
      }}
      onLoad={() => {
        console.log('✅ Profile image loaded successfully:', { uri, displayName });
        setImageError(false);
      }}
    />
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
});
