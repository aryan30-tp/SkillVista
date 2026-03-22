import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity
} from "react-native";
import api from "../../utils/api";

interface Skill {
  _id: string;
  name: string;
  category: string;
  confidenceScore: number;
  detectedInRepos: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  frontend: "#007AFF",
  backend: "#34C759",
  database: "#FF9500",
  devops: "#A2845E",
  language: "#5856D6",
  tool: "#FF3B30",
  other: "#999"
};

export default function SkillsScreen() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await api.get("/github/skills");
      setSkills(response.data || []);
      filterSkills(response.data || [], searchText, selectedCategory);
    } catch (error) {
      console.error("Error fetching skills:", error);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const filterSkills = (
    allSkills: Skill[],
    search: string,
    category: string | null
  ) => {
    let filtered = allSkills;

    if (search) {
      filtered = filtered.filter((skill) =>
        skill.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (category) {
      filtered = filtered.filter((skill) => skill.category === category);
    }

    filtered.sort((a, b) => b.confidenceScore - a.confidenceScore);
    setFilteredSkills(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    filterSkills(skills, text, selectedCategory);
  };

  const handleCategoryFilter = (category: string | null) => {
    setSelectedCategory(category);
    filterSkills(skills, searchText, category);
  };

  const categories = [
    "frontend",
    "backend",
    "database",
    "devops",
    "language",
    "tool"
  ];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading skills...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search skills..."
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={handleSearch}
        />
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedCategory === null && styles.filterButtonActive
          ]}
          onPress={() => handleCategoryFilter(null)}
        >
          <Text
            style={[
              styles.filterButtonText,
              selectedCategory === null && styles.filterButtonTextActive
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.filterButton,
              selectedCategory === category && styles.filterButtonActive,
              {
                borderColor:
                  selectedCategory === category
                    ? CATEGORY_COLORS[category]
                    : "#ddd"
              }
            ]}
            onPress={() => handleCategoryFilter(category)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedCategory === category && {
                  color: CATEGORY_COLORS[category]
                }
              ]}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.skillsContainer}>
        {filteredSkills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No skills found</Text>
            <Text style={styles.emptyStateSubtext}>
              Connect your GitHub and sync skills to get started
            </Text>
          </View>
        ) : (
          filteredSkills.map((skill) => (
            <View
              key={skill._id}
              style={[
                styles.skillCard,
                {
                  borderLeftColor: CATEGORY_COLORS[skill.category] || "#999"
                }
              ]}
            >
              <View style={styles.skillHeader}>
                <Text style={styles.skillName}>{skill.name}</Text>
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor: CATEGORY_COLORS[skill.category] || "#999"
                    }
                  ]}
                >
                  <Text style={styles.categoryText}>
                    {skill.category.substring(0, 3).toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${Math.round(skill.confidenceScore * 100)}%`,
                      backgroundColor: CATEGORY_COLORS[skill.category] || "#999"
                    }
                  ]}
                />
              </View>

              <Text style={styles.confidenceText}>
                Confidence: {Math.round(skill.confidenceScore * 100)}%
              </Text>

              {skill.detectedInRepos.length > 0 && (
                <View style={styles.reposContainer}>
                  <Text style={styles.reposLabel}>Detected in repositories:</Text>
                  <Text style={styles.reposText}>
                    {skill.detectedInRepos.slice(0, 3).join(", ")}
                    {skill.detectedInRepos.length > 3 && "..."}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666"
  },
  searchContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#000"
  },
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    marginBottom: 8,
    flexWrap: "wrap"
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8
  },
  filterButtonActive: {
    backgroundColor: "#f0f0f0"
  },
  filterButtonText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500"
  },
  filterButtonTextActive: {
    color: "#000",
    fontWeight: "600"
  },
  skillsContainer: {
    paddingHorizontal: 8
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000"
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    textAlign: "center"
  },
  skillCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    borderLeftWidth: 4
  },
  skillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  skillName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    flex: 1
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff"
  },
  confidenceBar: {
    height: 6,
    backgroundColor: "#eee",
    borderRadius: 3,
    marginBottom: 4,
    overflow: "hidden"
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 3
  },
  confidenceText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8
  },
  reposContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee"
  },
  reposLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#999",
    marginBottom: 4
  },
  reposText: {
    fontSize: 11,
    color: "#666"
  }
});
