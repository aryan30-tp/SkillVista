import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../utils/api";

interface ProjectItem {
  id: number;
  name: string;
  description: string;
  repositoryUrl: string;
  updatedAt: string;
  stars: number;
  techStack: string[];
  complexityScore: number;
  complexityLabel: string;
  connectedSkills: Array<{
    name: string;
    category: string;
    confidenceScore: number;
  }>;
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ total: number; projects: ProjectItem[] }>("/github/projects", {
        timeout: 120000
      });
      setProjects(response.data.projects || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProjects();
    }, [fetchProjects])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading projects...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {projects.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No repositories found</Text>
          <Text style={styles.emptyText}>Connect GitHub and push projects to see project cards.</Text>
        </View>
      ) : (
        projects.map((project) => (
          <View key={project.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{project.name}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{project.complexityLabel}</Text>
              </View>
            </View>

            <Text style={styles.metaText}>Complexity Score: {project.complexityScore}</Text>
            <Text style={styles.metaText}>Stars: {project.stars || 0}</Text>
            <Text style={styles.metaText}>
              Last Updated: {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "Unknown"}
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tech Stack</Text>
              <View style={styles.chipRow}>
                {(project.techStack || []).slice(0, 8).map((item, index) => (
                  <View key={`${project.id}-tech-${String(item).toLowerCase()}-${index}`} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connected Skills</Text>
              {(project.connectedSkills || []).length === 0 ? (
                <Text style={styles.metaText}>No mapped skills yet.</Text>
              ) : (
                project.connectedSkills.slice(0, 6).map((skill, index) => (
                  <View key={`${project.id}-skill-${String(skill.name).toLowerCase()}-${index}`} style={styles.skillRow}>
                    <Text style={styles.skillName}>{skill.name}</Text>
                    <Text style={styles.skillScore}>{Math.round(skill.confidenceScore * 100)}%</Text>
                  </View>
                ))
              )}
            </View>

            <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(project.repositoryUrl)}>
              <Text style={styles.linkButtonText}>Open Repository</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
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
    color: "#666"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8
  },
  badge: {
    backgroundColor: "#E9F5DB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  badgeText: {
    color: "#1B4332",
    fontSize: 11,
    fontWeight: "700"
  },
  metaText: {
    color: "#4B5563",
    fontSize: 12,
    marginTop: 2
  },
  section: {
    marginTop: 10
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  chip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6
  },
  chipText: {
    fontSize: 11,
    color: "#334155"
  },
  skillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4
  },
  skillName: {
    fontSize: 13,
    color: "#111827"
  },
  skillScore: {
    fontSize: 12,
    color: "#0F766E",
    fontWeight: "700"
  },
  linkButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#1F2937",
    paddingVertical: 10,
    alignItems: "center"
  },
  linkButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827"
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10
  },
  errorText: {
    color: "#B91C1C"
  }
});
