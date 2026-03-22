import React from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function DashboardLayout() {
  const { logout } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTintColor: "#007AFF",
        headerTitleStyle: { fontWeight: "bold" },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#999",
        tabBarLabelStyle: { fontSize: 12, marginTop: -6 }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          title: "Skills",
          tabBarLabel: "Skills",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⭐</Text>
        }}
      />
      <Tabs.Screen
        name="knowledge-map"
        options={{
          title: "Knowledge Map",
          tabBarLabel: "Map",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺️</Text>
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>
        }}
      />
    </Tabs>
  );
}
