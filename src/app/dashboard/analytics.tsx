import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../utils/api";

interface AnalyticsResponse {
  categoryDistribution: Array<{ category: string; count: number }>;
  confidenceBuckets: {
    strong: number;
    medium: number;
    emerging: number;
  };
  learningTrend: {
    lastSkillSync: string | null;
    repositoryCount: number;
    totalSkills: number;
    averageConfidence: number;
  };
  metadata: {
    generatedAt: string;
  };
}

export default function AnalyticsScreen() {
  const [payload, setPayload] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<AnalyticsResponse>("/github/analytics");
      setPayload(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Skill Distribution</Text>
        {(payload?.categoryDistribution || []).length === 0 ? (
          <Text style={styles.muted}>No skills to analyze yet.</Text>
        ) : (
          payload?.categoryDistribution.map((item) => (
            <View key={item.category} style={styles.row}>
              <Text style={styles.label}>{item.category}</Text>
              <Text style={styles.value}>{item.count}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Confidence Buckets</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Strong (&gt;=75%)</Text>
          <Text style={styles.value}>{payload?.confidenceBuckets.strong ?? 0}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Medium (45-74%)</Text>
          <Text style={styles.value}>{payload?.confidenceBuckets.medium ?? 0}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Emerging (&lt;45%)</Text>
          <Text style={styles.value}>{payload?.confidenceBuckets.emerging ?? 0}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Learning Trend Snapshot</Text>
        <Text style={styles.muted}>Total Skills: {payload?.learningTrend.totalSkills ?? 0}</Text>
        <Text style={styles.muted}>Repository Count: {payload?.learningTrend.repositoryCount ?? 0}</Text>
        <Text style={styles.muted}>
          Avg Confidence: {Math.round((payload?.learningTrend.averageConfidence || 0) * 100)}%
        </Text>
        <Text style={styles.muted}>
          Last Sync: {payload?.learningTrend.lastSkillSync ? new Date(payload.learningTrend.lastSkillSync).toLocaleString() : "Not available"}
        </Text>
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
    backgroundColor: "#f8f9fa"
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280"
  },
  errorText: {
    color: "#B91C1C",
    textAlign: "center"
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
    color: "#111827",
    marginBottom: 8
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6"
  },
  label: {
    color: "#374151",
    fontSize: 13,
    textTransform: "capitalize"
  },
  value: {
    color: "#111827",
    fontWeight: "700"
  },
  muted: {
    color: "#4B5563",
    marginTop: 4,
    fontSize: 13
  }
});
