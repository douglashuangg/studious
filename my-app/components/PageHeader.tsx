import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PageHeaderProps = {
  title: string;
  onPressBack?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
};

export default function PageHeader({
  title,
  onPressBack,
  left,
  right,
  containerStyle,
  titleStyle,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: Math.max(50, insets.top + 10) }, containerStyle]}> 
      <View style={styles.side}>{left}</View>
      <Text style={[styles.headerTitle, titleStyle]} numberOfLines={1}>{title}</Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
    flex: 1,
  },
  side: {
    width: 40,
    alignItems: "center",
  },
});



