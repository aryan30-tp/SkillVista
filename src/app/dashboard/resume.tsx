import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import api from "../../utils/api";

interface ResumeResponse {
  resume: {
    basics: {
      name: string;
      email: string;
      githubUsername: string | null;
      headline: string;
      summary: string;
    };
    skills: Array<{
      name: string;
      category: string;
      confidenceScore: number;
    }>;
    certifications: Array<{
      name: string;
      issuer: string;
      issuedAt: string | null;
      credentialUrl: string;
    }>;
    insights: {
      careerReadinessScore: number;
      targetRole: string;
      missingSkills: string[];
    };
  };
  ats: {
    score: number;
    band: string;
    suggestions: string[];
  };
  portfolioLink: string;
}

const BASE_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "https://skillvista-if50.onrender.com/api";

export default function ResumeScreen() {
  const [payload, setPayload] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResume = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<ResumeResponse>("/github/resume-portfolio", {
        params: { targetRole: "fullstack-developer" }
      });
      setPayload(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load resume data");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchResume();
    }, [fetchResume])
  );

  const handleDownloadPdf = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert("Session expired", "Please sign in again to download your resume.");
        return;
      }

      const url = `${BASE_API_URL}/github/resume.pdf?targetRole=fullstack-developer&token=${encodeURIComponent(token)}`;
      await Linking.openURL(url);
    } catch (_error) {
      Alert.alert("Download failed", "Unable to open resume PDF link.");
    }
  };

  const handleOpenPortfolio = async () => {
    if (!payload?.portfolioLink) {
      return;
    }

    try {
      await Linking.openURL(payload.portfolioLink);
    } catch (_error) {
      Alert.alert("Open failed", "Unable to open portfolio link.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Preparing resume and portfolio...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>ATS Score</Text>
        <Text style={styles.heroValue}>{payload?.ats.score ?? 0}</Text>
        <Text style={styles.heroSubtitle}>{payload?.ats.band || "Unknown"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{payload?.resume.basics.name}</Text>
        <Text style={styles.subtitle}>{payload?.resume.basics.headline}</Text>
        <Text style={styles.body}>{payload?.resume.basics.summary}</Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleDownloadPdf}>
          <Text style={styles.primaryButtonText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenPortfolio}>
          <Text style={styles.secondaryButtonText}>Open Portfolio</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Top Skills</Text>
        {(payload?.resume.skills || []).slice(0, 10).map((skill) => (
          <View key={skill.name} style={styles.row}>
            <Text style={styles.body}>{skill.name}</Text>
            <Text style={styles.score}>{skill.confidenceScore}%</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>ATS Suggestions</Text>
        {(payload?.ats.suggestions || []).length === 0 ? (
          <Text style={styles.body}>No immediate ATS fixes required.</Text>
        ) : (
          (payload?.ats.suggestions || []).map((item) => (
            <Text key={item} style={styles.bulletText}>• {item}</Text>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Portfolio Link</Text>
        <Text style={styles.linkText}>{payload?.portfolioLink || "Not available"}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 24
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280"
  },
  errorText: {
    color: "#B91C1C",
    textAlign: "center"
  },
  heroCard: {
    backgroundColor: "#0F766E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10
  },
  heroTitle: {
    color: "#CCFBF1",
    fontSize: 14,
    fontWeight: "700"
  },
  heroValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 2
  },
  heroSubtitle: {
    color: "#A7F3D0",
    fontWeight: "700",
    marginTop: 2
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827"
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2
  },
  body: {
    fontSize: 13,
    color: "#374151",
    marginTop: 6
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1D4ED8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 6
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginLeft: 6
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1"
  },
  score: {
    color: "#0F766E",
    fontWeight: "700"
  },
  bulletText: {
    color: "#374151",
    marginTop: 6,
    fontSize: 13
  },
  linkText: {
    color: "#1D4ED8",
    fontSize: 12
  }
});
