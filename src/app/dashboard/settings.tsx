import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../utils/api";

type ThemeMode = "light" | "dark";
type PrivacyLevel = "public" | "private";

interface Preferences {
  themeMode: ThemeMode;
  privacyLevel: PrivacyLevel;
  autoSync: boolean;
  notifications: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  themeMode: "light",
  privacyLevel: "private",
  autoSync: false,
  notifications: true
};

export default function SettingsScreen() {
  const { logout, user, disconnectGitHub } = useAuth();
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ preferences: Preferences }>("/auth/preferences");
      setPreferences(response.data.preferences || DEFAULT_PREFERENCES);
    } catch (_error) {
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPreferences();
    }, [fetchPreferences])
  );

  const persistPreferences = async (next: Preferences) => {
    try {
      setSaving(true);
      setPreferences(next);
      await api.put("/auth/preferences", next);
    } catch (_error) {
      Alert.alert("Update Failed", "Could not save preferences. Please try again.");
      fetchPreferences();
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        onPress: () => {}
      },
      {
        text: "Logout",
        onPress: async () => {
          try {
            await logout();
            router.replace("/auth");
          } catch (error) {
            Alert.alert("Error", "Failed to logout");
          }
        },
        style: "destructive"
      }
    ]);
  };

  const handleDisconnectGitHub = async () => {
    Alert.alert(
      "Disconnect GitHub",
      "This will remove your GitHub connection but keep your extracted skills",
      [
        {
          text: "Cancel",
          onPress: () => {}
        },
        {
          text: "Disconnect",
          onPress: async () => {
            try {
              await disconnectGitHub();
              Alert.alert("Success", "GitHub account disconnected");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to disconnect GitHub");
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>Account Status</Text>
            <Text style={styles.settingValue}>Active</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync & Theme</Text>

        <View style={styles.settingItemWithToggle}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Auto-Sync Skills</Text>
            <Text style={styles.settingDescription}>
              Automatically sync your skills daily
            </Text>
          </View>
          <Switch
            value={preferences.autoSync}
            onValueChange={(value) => persistPreferences({ ...preferences, autoSync: value })}
            trackColor={{ false: "#767577", true: "#81C784" }}
            thumbColor={preferences.autoSync ? "#4CAF50" : "#f4f3f4"}
            disabled={saving}
          />
        </View>

        <View style={styles.settingItemWithToggle}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive updates about new skills detected
            </Text>
          </View>
          <Switch
            value={preferences.notifications}
            onValueChange={(value) => persistPreferences({ ...preferences, notifications: value })}
            trackColor={{ false: "#767577", true: "#81C784" }}
            thumbColor={preferences.notifications ? "#4CAF50" : "#f4f3f4"}
            disabled={saving}
          />
        </View>

        <View style={styles.settingItemWithToggle}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Text style={styles.settingDescription}>Persisted preference across sessions</Text>
          </View>
          <Switch
            value={preferences.themeMode === "dark"}
            onValueChange={(value) =>
              persistPreferences({ ...preferences, themeMode: value ? "dark" : "light" })
            }
            trackColor={{ false: "#767577", true: "#90CAF9" }}
            thumbColor={preferences.themeMode === "dark" ? "#1E3A8A" : "#f4f3f4"}
            disabled={saving}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.settingItemWithToggle}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Public Profile</Text>
            <Text style={styles.settingDescription}>Allow your portfolio link to be discoverable</Text>
          </View>
          <Switch
            value={preferences.privacyLevel === "public"}
            onValueChange={(value) =>
              persistPreferences({ ...preferences, privacyLevel: value ? "public" : "private" })
            }
            trackColor={{ false: "#767577", true: "#81C784" }}
            thumbColor={preferences.privacyLevel === "public" ? "#2E7D32" : "#f4f3f4"}
            disabled={saving}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GitHub Integration</Text>

        {user?.githubId ? (
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleDisconnectGitHub}
          >
            <Text style={styles.dangerButtonText}>Disconnect GitHub Account</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              No GitHub account connected. Connect on your Profile page.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
        </View>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>Build</Text>
            <Text style={styles.settingValue}>2026.03.22</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLink}>Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLink}>Terms of Service</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa"
  },
  loadingText: {
    marginTop: 10,
    color: "#666"
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 8,
    marginHorizontal: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden"
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: "uppercase"
  },
  settingItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0"
  },
  settingItemWithToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0"
  },
  settingContent: {
    flex: 1
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4
  },
  settingValue: {
    fontSize: 12,
    color: "#666"
  },
  settingDescription: {
    fontSize: 12,
    color: "#999",
    marginTop: 4
  },
  settingLink: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500"
  },
  infoBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f0f8ff",
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
    marginHorizontal: 16,
    marginBottom: 16
  },
  infoText: {
    fontSize: 12,
    color: "#007AFF"
  },
  dangerButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff3f3",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FF3B30"
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3B30",
    textAlign: "center"
  },
  logoutButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FF3B30",
    borderRadius: 8
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center"
  },
  footer: {
    height: 40
  }
});
