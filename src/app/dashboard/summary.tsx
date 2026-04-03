import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../utils/api";

interface SummaryResponse {
  totals: {
    skills: number;
    projects: number;
    certifications: number;
  };
  skillStrengthScore: number;
  readinessPercentage: number;
  topSkills: Array<{
    name: string;
    category: string;
    confidenceScore: number;
  }>;
  recentActivity: Array<{
    type: string;
    title: string;
    timestamp: string | null;
  }>;
  metadata: {
    calculatedAt: string;
    lastSkillSync: string | null;
  };
}

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
};

export default function SummaryScreen() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get<SummaryResponse>("/github/summary");
      setSummary(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load dashboard summary");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSummary();
    }, [fetchSummary])
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchSummary(true)} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Career Readiness</Text>
        <Text style={styles.readinessValue}>{summary?.readinessPercentage ?? 0}%</Text>
        <Text style={styles.headerSubtitle}>Rule-based baseline score from skills, projects, and certifications</Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Skills</Text>
          <Text style={styles.metricValue}>{summary?.totals.skills ?? 0}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Projects</Text>
          <Text style={styles.metricValue}>{summary?.totals.projects ?? 0}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Certifications</Text>
          <Text style={styles.metricValue}>{summary?.totals.certifications ?? 0}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Skill Strength</Text>
          <Text style={styles.metricValue}>{summary?.skillStrengthScore ?? 0}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Top Skills</Text>
        {(summary?.topSkills || []).length === 0 ? (
          <Text style={styles.emptyText}>Sync skills from GitHub to populate this section.</Text>
        ) : (
          summary?.topSkills.map((skill) => (
            <View key={skill.name} style={styles.listRow}>
              <View>
                <Text style={styles.rowTitle}>{skill.name}</Text>
                <Text style={styles.rowSubtitle}>{skill.category}</Text>
              </View>
              <Text style={styles.rowScore}>{Math.round(skill.confidenceScore * 100)}%</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {(summary?.recentActivity || []).length === 0 ? (
          <Text style={styles.emptyText}>No recent activity yet.</Text>
        ) : (
          summary?.recentActivity.map((activity, index) => (
            <View key={`${activity.type}-${index}`} style={styles.activityRow}>
              <Text style={styles.rowTitle}>{activity.title}</Text>
              <Text style={styles.rowSubtitle}>{formatTimestamp(activity.timestamp)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Last Skill Sync</Text>
        <Text style={styles.rowSubtitle}>{formatTimestamp(summary?.metadata.lastSkillSync || null)}</Text>
      </View>

      {error ? (
        <View style={[styles.sectionCard, styles.errorCard]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa"
  },
  loadingText: {
    marginTop: 12,
    color: "#666"
  },
  headerCard: {
    backgroundColor: "#0F766E",
    margin: 12,
    borderRadius: 12,
    padding: 18
  },
  headerTitle: {
    color: "#D1FAE5",
    fontSize: 15,
    fontWeight: "600"
  },
  readinessValue: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "700",
    marginTop: 4
  },
  headerSubtitle: {
    color: "#CCFBF1",
    marginTop: 6,
    fontSize: 12
  },
  metricsGrid: {
    marginHorizontal: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10
  },
  metricLabel: {
    fontSize: 12,
    color: "#666"
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 4
  },
  sectionCard: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 10
  },
  emptyText: {
    color: "#666",
    fontSize: 13
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1"
  },
  activityRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1"
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827"
  },
  rowSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2
  },
  rowScore: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F766E"
  },
  errorCard: {
    backgroundColor: "#FEF2F2"
  },
  errorText: {
    color: "#B91C1C"
  },
  footerSpace: {
    height: 24
  }
});
