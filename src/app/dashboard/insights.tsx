import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../utils/api";

interface InsightResponse {
  targetRole: string;
  careerReadinessScore: number;
  skillGapAnalysis: {
    baselineSkills: string[];
    missingSkills: string[];
    coveragePercentage: number;
  };
  suggestedNextSkills: string[];
  recommendedCertifications: string[];
  suggestedProjects: Array<{
    title: string;
    description: string;
    skillsToPractice: string[];
  }>;
  strengths: Array<{
    name: string;
    category: string;
    score: number;
  }>;
}

export default function InsightsScreen() {
  const [payload, setPayload] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<InsightResponse>("/github/insights", {
        params: { targetRole: "fullstack-developer" }
      });
      setPayload(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInsights();
    }, [fetchInsights])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Generating insights...</Text>
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
        <Text style={styles.heroTitle}>AI Insights</Text>
        <Text style={styles.heroValue}>{payload?.careerReadinessScore ?? 0}%</Text>
        <Text style={styles.heroSubtitle}>Career readiness for {payload?.targetRole?.replace(/-/g, " ")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Skill Gap Analysis</Text>
        <Text style={styles.cardSubtitle}>Coverage: {payload?.skillGapAnalysis.coveragePercentage ?? 0}%</Text>
        {(payload?.skillGapAnalysis.missingSkills || []).length === 0 ? (
          <Text style={styles.bodyText}>No major gaps detected for this baseline role.</Text>
        ) : (
          <View style={styles.rowWrap}>
            {payload?.skillGapAnalysis.missingSkills.map((skill) => (
              <View key={skill} style={styles.chipWarning}>
                <Text style={styles.chipWarningText}>{skill}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Suggested Next Skills</Text>
        <View style={styles.rowWrap}>
          {(payload?.suggestedNextSkills || []).map((skill) => (
            <View key={skill} style={styles.chip}>
              <Text style={styles.chipText}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recommended Certifications</Text>
        {(payload?.recommendedCertifications || []).map((cert) => (
          <Text key={cert} style={styles.listItem}>• {cert}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Suggested Projects</Text>
        {(payload?.suggestedProjects || []).map((project) => (
          <View key={project.title} style={styles.projectBlock}>
            <Text style={styles.projectTitle}>{project.title}</Text>
            <Text style={styles.bodyText}>{project.description}</Text>
            {(project.skillsToPractice || []).length > 0 ? (
              <Text style={styles.projectSkills}>Practice: {project.skillsToPractice.join(", ")}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Strengths</Text>
        {(payload?.strengths || []).map((item) => (
          <View key={item.name} style={styles.strengthRow}>
            <Text style={styles.bodyText}>{item.name}</Text>
            <Text style={styles.strengthScore}>{item.score}%</Text>
          </View>
        ))}
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
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10
  },
  heroTitle: {
    color: "#DBEAFE",
    fontWeight: "700"
  },
  heroValue: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 36,
    marginTop: 2
  },
  heroSubtitle: {
    color: "#BFDBFE",
    marginTop: 4,
    fontSize: 12,
    textTransform: "capitalize"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827"
  },
  cardSubtitle: {
    marginTop: 4,
    marginBottom: 8,
    color: "#374151",
    fontSize: 12
  },
  bodyText: {
    color: "#374151",
    fontSize: 13
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8
  },
  chip: {
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6
  },
  chipText: {
    color: "#065F46",
    fontSize: 11,
    fontWeight: "600"
  },
  chipWarning: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6
  },
  chipWarningText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "700"
  },
  listItem: {
    color: "#374151",
    marginTop: 6,
    fontSize: 13
  },
  projectBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f1f1",
    paddingTop: 10
  },
  projectTitle: {
    color: "#111827",
    fontWeight: "700",
    marginBottom: 2
  },
  projectSkills: {
    marginTop: 4,
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "600"
  },
  strengthRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  strengthScore: {
    color: "#0F766E",
    fontWeight: "700"
  }
});
