import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../utils/api";

interface Skill {
  _id: string;
  name: string;
  category: string;
  confidenceScore: number;
  detectedInRepos: string[];
}

interface SkillOption {
  name: string;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
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

export default function SkillsScreen() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [optionSearch, setOptionSearch] = useState("");
  const [selectedOption, setSelectedOption] = useState<SkillOption | null>(null);

  useEffect(() => {
    fetchSkills();
    fetchSkillOptions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSkills();
    }, [])
  );

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

  const fetchSkillOptions = async () => {
    try {
      setOptionsLoading(true);
      const response = await api.get("/github/skill-options");
      setSkillOptions(response.data || []);
    } catch (error) {
      console.error("Error fetching skill options:", error);
      setSkillOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  };

  const handleAddManualSkill = async () => {
    if (!selectedOption) {
      Alert.alert("Select a skill", "Choose a skill from the dropdown first.");
      return;
    }

    try {
      setAddingManual(true);
      const response = await api.post("/github/manual-skill", {
        name: selectedOption.name,
        category: selectedOption.category
      });

      await fetchSkills();
      Alert.alert("Success", response.data?.message || "Skill added successfully");
      setSelectedOption(null);
      setOptionSearch("");
      setShowOptions(false);
    } catch (error: any) {
      Alert.alert("Failed", error?.response?.data?.error || "Failed to add manual skill");
    } finally {
      setAddingManual(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    filterSkills(skills, text, selectedCategory);
  };

  const handleCategoryFilter = (category: string | null) => {
    setSelectedCategory(category);
    filterSkills(skills, searchText, category);
  };

  const categoryOrder = [
    "language",
    "frontend",
    "backend",
    "mobile",
    "app-development",
    "database",
    "data-science",
    "ai-ml",
    "cybersecurity",
    "devops",
    "tool",
    "other"
  ];

  const categories = Array.from(new Set(skills.map((skill) => skill.category))).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);

    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b);
    }
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }
    return aIndex - bIndex;
  });

  const visibleOptions = skillOptions
    .filter((option) => {
      if (!optionSearch.trim()) {
        return true;
      }
      const query = optionSearch.toLowerCase();
      return (
        option.name.toLowerCase().includes(query) ||
        option.category.toLowerCase().includes(query)
      );
    })
    .slice(0, 60);

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

      <View style={styles.manualCard}>
        <Text style={styles.manualTitle}>Add Skill Manually</Text>
        <Text style={styles.manualSubtitle}>
          For tools like Git, Postman, Figma, Linux, and more.
        </Text>

        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowOptions((prev) => !prev)}
        >
          <Text style={styles.dropdownButtonText}>
            {selectedOption
              ? `${selectedOption.name} (${selectedOption.category})`
              : "Select skill"}
          </Text>
        </TouchableOpacity>

        {showOptions && (
          <View style={styles.dropdownListContainer}>
            <TextInput
              style={styles.optionSearchInput}
              placeholder="Search skills..."
              placeholderTextColor="#999"
              value={optionSearch}
              onChangeText={setOptionSearch}
            />

            <ScrollView style={styles.dropdownList} nestedScrollEnabled>
              {optionsLoading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : visibleOptions.length === 0 ? (
                <Text style={styles.noOptionsText}>No skills found</Text>
              ) : (
                visibleOptions.map((option) => (
                  <TouchableOpacity
                    key={`${option.name}:${option.category}`}
                    style={styles.optionItem}
                    onPress={() => {
                      setSelectedOption(option);
                      setShowOptions(false);
                    }}
                  >
                    <Text style={styles.optionName}>{option.name}</Text>
                    <Text style={styles.optionCategory}>{option.category}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addManualButton, addingManual && styles.addManualButtonDisabled]}
          disabled={addingManual}
          onPress={handleAddManualSkill}
        >
          {addingManual ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.addManualButtonText}>Add Skill</Text>
          )}
        </TouchableOpacity>
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
  manualCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e8edf5"
  },
  manualTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111"
  },
  manualSubtitle: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: "#666"
  },
  dropdownButton: {
    height: 44,
    borderWidth: 1,
    borderColor: "#d9dfe8",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#fff"
  },
  dropdownButtonText: {
    fontSize: 13,
    color: "#222"
  },
  dropdownListContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d9dfe8",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  optionSearchInput: {
    height: 40,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f5",
    fontSize: 13,
    color: "#000"
  },
  dropdownList: {
    maxHeight: 220
  },
  noOptionsText: {
    padding: 12,
    fontSize: 12,
    color: "#666"
  },
  optionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f6"
  },
  optionName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111"
  },
  optionCategory: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
    textTransform: "capitalize"
  },
  addManualButton: {
    marginTop: 10,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#2c7be5",
    justifyContent: "center",
    alignItems: "center"
  },
  addManualButtonDisabled: {
    opacity: 0.65
  },
  addManualButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13
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
