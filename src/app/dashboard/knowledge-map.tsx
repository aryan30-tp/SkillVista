import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert
} from "react-native";
import api from "../../utils/api";

interface SkillNode {
  id: string;
  name: string;
  category: string;
  confidence: number;
  color: string;
}

export default function KnowledgeMapScreen() {
  const [skills, setSkills] = useState<SkillNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSkillsForMap();
  }, []);

  const fetchSkillsForMap = async () => {
    try {
      setLoading(true);
      const response = await api.get("/github/skills");
      const skillsData = response.data || [];

      // Transform to SkillNode format
      const nodes = skillsData.map((skill: any) => ({
        id: skill._id,
        name: skill.name,
        category: skill.category,
        confidence: skill.confidenceScore,
        color: getCategoryColor(skill.category)
      }));

      setSkills(nodes);
    } catch (error) {
      console.error("Error fetching skills:", error);
      Alert.alert("Error", "Failed to load knowledge map");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      frontend: "#007AFF",
      backend: "#34C759",
      database: "#FF9500",
      devops: "#A2845E",
      language: "#5856D6",
      mobile: "#14B8A6",
      "app-development": "#0EA5E9",
      "ai-ml": "#EC4899",
      "data-science": "#22C55E",
      cybersecurity: "#EF4444",
      tool: "#FF3B30",
      other: "#999"
    };
    return colors[category] || "#999";
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Building your knowledge map...</Text>
      </View>
    );
  }

  if (skills.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Knowledge Map Yet</Text>
        <Text style={styles.emptyText}>
          Connect your GitHub and sync your skills to visualize your technical
          knowledge
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Knowledge Map</Text>
        <Text style={styles.subtitle}>
          {skills.length} skills detected across your repositories
        </Text>
      </View>

      <View style={styles.mapPreview}>
        <Text style={styles.mapPreviewText}>
          📊 3D Knowledge Map Visualization
        </Text>
        <Text style={styles.mapDescription}>
          An interactive 3D force-directed graph will be rendered here in
          Phase 5, showing your skills as interconnected nodes where:
        </Text>

        <View style={styles.featureList}>
          <View style={styles.featureRow}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Node size = confidence score
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Node color = skill category
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Edges = co-occurrence in projects
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Physics simulation = automatic layout
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.skillsPreview}>
        <Text style={styles.previewTitle}>Preview: Your Top Skills</Text>

        {skills.slice(0, 10).map((skill, index) => (
          <View key={skill.id} style={styles.skillPreviewItem}>
            <View style={styles.skillPreviewIndex}>
              <Text style={styles.skillPreviewIndexText}>{index + 1}</Text>
            </View>

            <View style={styles.skillPreviewInfo}>
              <Text style={styles.skillPreviewName}>{skill.name}</Text>
              <View style={styles.skillPreviewBar}>
                <View
                  style={[
                    styles.skillPreviewFill,
                    {
                      width: `${Math.round(skill.confidence * 100)}%`,
                      backgroundColor: skill.color
                    }
                  ]}
                />
              </View>
            </View>

            <View
              style={[
                styles.skillPreviewBadge,
                { backgroundColor: skill.color }
              ]}
            >
              <Text style={styles.skillPreviewBadgeText}>
                {Math.round(skill.confidence * 100)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{skills.length}</Text>
          <Text style={styles.statLabel}>Total Skills</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {Math.round(
              (skills.reduce((sum, s) => sum + s.confidence, 0) / skills.length) *
                100
            )}
            %
          </Text>
          <Text style={styles.statLabel}>Avg. Confidence</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {new Set(skills.map((s) => s.category)).size}
          </Text>
          <Text style={styles.statLabel}>Categories</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa"
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center"
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666"
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: "#666"
  },
  mapPreview: {
    margin: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    borderStyle: "dashed"
  },
  mapPreviewText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 8
  },
  mapDescription: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
    marginBottom: 12
  },
  featureList: {
    marginTop: 8
  },
  featureRow: {
    flexDirection: "row",
    marginBottom: 8
  },
  featureBullet: {
    fontSize: 16,
    color: "#007AFF",
    marginRight: 8
  },
  featureText: {
    fontSize: 12,
    color: "#666",
    flex: 1
  },
  skillsPreview: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 8
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12
  },
  skillPreviewItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0"
  },
  skillPreviewIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },
  skillPreviewIndexText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666"
  },
  skillPreviewInfo: {
    flex: 1
  },
  skillPreviewName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4
  },
  skillPreviewBar: {
    height: 4,
    backgroundColor: "#eee",
    borderRadius: 2,
    overflow: "hidden"
  },
  skillPreviewFill: {
    height: "100%",
    borderRadius: 2
  },
  skillPreviewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 12
  },
  skillPreviewBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff"
  },
  stats: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 20
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 4
  },
  statLabel: {
    fontSize: 12,
    color: "#666"
  }
});
