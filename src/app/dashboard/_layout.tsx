import React from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";

export default function DashboardLayout() {
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
        name="summary"
        options={{
          title: "Summary",
          tabBarLabel: "Summary",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarLabel: "Projects",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💼</Text>
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "AI Insights",
          tabBarLabel: "Insights",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🚀</Text>
        }}
      />
      <Tabs.Screen
        name="resume"
        options={{
          title: "Resume",
          tabBarLabel: "Resume",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📄</Text>
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarLabel: "Analytics",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📈</Text>
        }}
      />
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
