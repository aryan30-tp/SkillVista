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
  contributionHeatmap: number[][];
  centralityMetrics: Array<{ name: string; degree: number }>;
  clusterDetection: {
    clusterCount: number;
    dominantCluster: string;
    dominantClusterShare: number;
  };
  learningGrowthTrend: Array<{
    month: string;
    skillCount: number;
    avgConfidence: number;
  }>;
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

  const distribution = payload?.categoryDistribution || [];
  const total = Math.max(1, distribution.reduce((sum, item) => sum + item.count, 0));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Skill Distribution</Text>
        {distribution.length === 0 ? (
          <Text style={styles.muted}>No skills to analyze yet.</Text>
        ) : (
          distribution.map((item) => {
            const ratio = Math.round((item.count / total) * 100);
            return (
              <View key={item.category} style={styles.blockRow}>
                <View style={styles.blockRowHeader}>
                  <Text style={styles.label}>{item.category}</Text>
                  <Text style={styles.value}>{item.count} ({ratio}%)</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${ratio}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contribution Heatmap</Text>
        {(payload?.contributionHeatmap || []).map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.heatmapRow}>
            {week.map((value, dayIndex) => (
              <View
                key={`heat-${weekIndex}-${dayIndex}`}
                style={[styles.heatCell, { opacity: Math.max(0.15, value / 100) }]}
              />
            ))}
          </View>
        ))}
        <Text style={styles.caption}>Low to high contribution intensity.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Graph Centrality Metrics</Text>
        {(payload?.centralityMetrics || []).length === 0 ? (
          <Text style={styles.muted}>Not enough graph links yet.</Text>
        ) : (
          (payload?.centralityMetrics || []).map((metric, idx) => (
            <View key={`${metric.name}-${idx}`} style={styles.row}>
              <Text style={styles.label}>{metric.name}</Text>
              <Text style={styles.value}>Degree {metric.degree}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cluster Detection</Text>
        <Text style={styles.muted}>Cluster Count: {payload?.clusterDetection.clusterCount ?? 0}</Text>
        <Text style={styles.muted}>Dominant Cluster: {payload?.clusterDetection.dominantCluster || "none"}</Text>
        <Text style={styles.muted}>Dominant Share: {payload?.clusterDetection.dominantClusterShare ?? 0}%</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Learning Growth Trend</Text>
        {(payload?.learningGrowthTrend || []).map((point, idx) => (
          <View key={`${point.month}-${idx}`} style={styles.trendRow}>
            <Text style={styles.trendMonth}>{point.month}</Text>
            <View style={styles.trendBarTrack}>
              <View style={[styles.trendBarFill, { width: `${Math.max(8, Math.round(point.avgConfidence * 100))}%` }]} />
            </View>
            <Text style={styles.trendMeta}>{point.skillCount} skills</Text>
          </View>
        ))}
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
        <Text style={styles.muted}>Avg Confidence: {Math.round((payload?.learningTrend.averageConfidence || 0) * 100)}%</Text>
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
  blockRow: {
    marginBottom: 10
  },
  blockRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563EB"
  },
  heatmapRow: {
    flexDirection: "row",
    marginBottom: 4
  },
  heatCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 4,
    backgroundColor: "#0F766E"
  },
  caption: {
    marginTop: 8,
    fontSize: 11,
    color: "#6B7280"
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  trendMonth: {
    width: 34,
    fontSize: 12,
    color: "#374151"
  },
  trendBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginHorizontal: 8
  },
  trendBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0EA5E9"
  },
  trendMeta: {
    width: 72,
    textAlign: "right",
    fontSize: 11,
    color: "#6B7280"
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
