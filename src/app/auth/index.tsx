import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";

export default function AuthLandingScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>SkillVista</Text>
        <Text style={styles.heroSubtitle}>
          Visualize Your Technical Skills
        </Text>
        <Text style={styles.heroDescription}>
          Connect your GitHub, auto-extract your skills, and visualize your
          technical knowledge in a stunning 3D knowledge map.
        </Text>
      </View>

      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🔐</Text>
          <Text style={styles.featureTitle}>Secure Connection</Text>
          <Text style={styles.featureText}>
            Your data is encrypted and secure
          </Text>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🚀</Text>
          <Text style={styles.featureTitle}>Auto Detection</Text>
          <Text style={styles.featureText}>
            Automatically detect skills from your repos
          </Text>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📊</Text>
          <Text style={styles.featureTitle}>3D Visualization</Text>
          <Text style={styles.featureText}>
            See your skills in an interactive 3D map
          </Text>
        </View>
      </View>

      <View style={styles.authButtons}>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push("/auth/register")}
        >
          <Text style={styles.registerButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: "#f8f9fa"
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 16
  },
  heroDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20
  },
  features: {
    paddingHorizontal: 20,
    paddingVertical: 40
  },
  featureItem: {
    marginBottom: 24
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 12
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 6
  },
  featureText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 18
  },
  authButtons: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  loginButton: {
    height: 50,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  registerButton: {
    height: 50,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd"
  },
  registerButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600"
  }
});
