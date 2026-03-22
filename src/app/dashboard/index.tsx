import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");

  const handleSyncSkills = async () => {
    try {
      setLoading(true);
      setSyncStatus("syncing");
      const response = await api.post("/github/sync-skills");
      Alert.alert("Success", "Skills synced successfully!");
      setSyncStatus("completed");
    } catch (error: any) {
      Alert.alert(
        "Sync Failed",
        error.response?.data?.error || "Failed to sync skills"
      );
      setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    Alert.alert(
      "GitHub Connection",
      "GitHub OAuth integration will be implemented in Phase 2"
    );
  };

  const isGitHubConnected = user?.githubId;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GitHub Connection</Text>

        {isGitHubConnected ? (
          <View style={styles.connectedBox}>
            <Text style={styles.connectedIcon}>✓</Text>
            <View style={styles.connectedContent}>
              <Text style={styles.connectedText}>GitHub Connected</Text>
              <Text style={styles.connectedSubtext}>
                Username: {user?.githubUsername || "Loading..."}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.githubButton}
            onPress={handleConnectGitHub}
            disabled={loading}
          >
            <Text style={styles.githubButtonText}>Connect GitHub Account</Text>
          </TouchableOpacity>
        )}
      </View>

      {isGitHubConnected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skill Extraction</Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Status: </Text>
            <Text style={styles.statusValue}>
              {user?.skillExtractionStatus || "Not started"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.syncButton, loading && styles.syncButtonDisabled]}
            onPress={handleSyncSkills}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.syncButtonText}>Sync Skills from GitHub</Text>
            )}
          </TouchableOpacity>

          {syncStatus === "completed" && (
            <Text style={styles.successText}>
              ✓ Skills synced successfully!
            </Text>
          )}
          {syncStatus === "error" && (
            <Text style={styles.errorText}>✗ Sync failed. Try again.</Text>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>User ID:</Text>
          <Text style={styles.infoValue}>{user?.id}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Member Since:</Text>
          <Text style={styles.infoValue}>
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString()
              : "Unknown"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff"
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4
  },
  userEmail: {
    fontSize: 14,
    color: "#666"
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12
  },
  githubButton: {
    height: 50,
    backgroundColor: "#24292e",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center"
  },
  githubButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  connectedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f8ff",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF"
  },
  connectedIcon: {
    fontSize: 24,
    marginRight: 12,
    color: "#007AFF"
  },
  connectedContent: {
    flex: 1
  },
  connectedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000"
  },
  connectedSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4
  },
  statusBox: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 12
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666"
  },
  statusValue: {
    fontSize: 14,
    color: "#000",
    textTransform: "capitalize"
  },
  syncButton: {
    height: 50,
    backgroundColor: "#34C759",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center"
  },
  syncButtonDisabled: {
    opacity: 0.6
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  successText: {
    color: "#34C759",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center"
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center"
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  infoLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500"
  },
  infoValue: {
    fontSize: 12,
    color: "#000",
    flex: 1,
    textAlign: "right"
  }
});
