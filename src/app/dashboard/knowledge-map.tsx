import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextInput, FlatList, TouchableOpacity } from "react-native";
import { Animated } from "react-native";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../utils/api";
// ...existing code...
import {
  buildGraphLayout,
  projectPoint,
  SkillGraphEdge,
  SkillGraphNode,
  SkillGraphPayload
} from "../../utils/knowledgeGraph";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRAPH_HEIGHT = 460;

interface CameraState {
  rotationX: number;
  rotationY: number;
  zoom: number;
}

const CAMERA_DEFAULT: CameraState = {
  rotationX: -0.2,
  rotationY: 0.35,
  zoom: 3.25 // Set initial zoom for largest graph size
};

const EDGE_MIN_ALPHA = 0.15;
const EDGE_MAX_ALPHA = 0.55;

export default function KnowledgeMapScreen() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SkillGraphNode[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const [nodes, setNodes] = useState<SkillGraphNode[]>([]);
  const [edges, setEdges] = useState<SkillGraphEdge[]>([]);
  const [clusters, setClusters] = useState<SkillGraphPayload["metadata"]["clusters"]>([]);
  const [loading, setLoading] = useState(true);
  const [clusterMode, setClusterMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [localSelectedNode, setLocalSelectedNode] = useState<SkillGraphNode | null>(null);
  const [camera, setCamera] = useState<CameraState>(CAMERA_DEFAULT);

  // Search logic
  useEffect(() => {
    if (search.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const lower = search.trim().toLowerCase();
    setSearchResults(
      nodes.filter((n) => n.name.toLowerCase().includes(lower))
        .slice(0, 8)
    );
  }, [search, nodes]);

  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(CAMERA_DEFAULT.zoom);
  const panDeltaRef = useRef({ dx: 0, dy: 0 });

  // Decouple node selection from data reload
  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<SkillGraphPayload>("/github/skill-graph");
      const payload = response.data;

      setNodes(payload.nodes || []);
      setEdges(payload.edges || []);
      setClusters(payload.metadata?.clusters || []);
      // Do not reset selectedNodeId on data reload
    } catch (error) {
      console.error("Error fetching skill graph:", error);
      Alert.alert("Error", "Failed to load your knowledge graph.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  useFocusEffect(
    useCallback(() => {
      fetchGraph();
    }, [fetchGraph])
  );

  const nodePositions = useMemo(() => {
    return buildGraphLayout(nodes, clusters, clusterMode);
  }, [nodes, clusters, clusterMode]);

  const projectedNodes = useMemo(() => {
    const mapped = nodePositions
      .map((position) => {
        const node = nodes.find((entry) => entry.id === position.id);
        if (!node) {
          return null;
        }

        const projection = projectPoint(
          position,
          camera.rotationX,
          camera.rotationY,
          camera.zoom,
          SCREEN_WIDTH - 32,
          GRAPH_HEIGHT,
          node.confidenceScore
        );

        return {
          ...projection,
          node
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return mapped.sort((a, b) => a.depth - b.depth);
  }, [nodePositions, nodes, camera]);

  const projectedNodeMap = useMemo(() => {
    const map = new Map<string, (typeof projectedNodes)[number]>();
    for (const entry of projectedNodes) {
      map.set(entry.id, entry);
    }
    return map;
  }, [projectedNodes]);

  const visibleEdges = useMemo(() => {
    return edges
      .map((edge) => {
        const source = projectedNodeMap.get(edge.source);
        const target = projectedNodeMap.get(edge.target);
        if (!source || !target) {
          return null;
        }

        const dx = target.screenX - source.screenX;
        const dy = target.screenY - source.screenY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const centerX = (source.screenX + target.screenX) / 2;
        const centerY = (source.screenY + target.screenY) / 2;
        const depth = (source.depth + target.depth) / 2;

        return {
          edge,
          length,
          angle,
          centerX,
          centerY,
          depth
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.depth - b.depth);
  }, [edges, projectedNodeMap]);

  // Use local state for selected node for smoother transitions
  useEffect(() => {
    if (selectedNodeId) {
      setLocalSelectedNode(nodes.find((node) => node.id === selectedNodeId) || null);
      setDrawerOpen(true);
      Animated.spring(drawerAnim, { toValue: 1, useNativeDriver: true }).start();
    } else {
      Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true }).start(() => setDrawerOpen(false));
    }
  }, [selectedNodeId, nodes]);

  const relatedSkills = useMemo(() => {
    if (!localSelectedNode) {
      return [];
    }

    return edges
      .filter((edge) => edge.source === localSelectedNode.id || edge.target === localSelectedNode.id)
      .map((edge) => {
        const relatedId = edge.source === localSelectedNode.id ? edge.target : edge.source;
        const relatedNode = nodes.find((node) => node.id === relatedId);
        if (!relatedNode) {
          return null;
        }

        return {
          id: relatedNode.id,
          name: relatedNode.name,
          weight: edge.weight,
          color: relatedNode.color
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  }, [localSelectedNode, edges, nodes]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, gestureState) => {
          panDeltaRef.current = { dx: 0, dy: 0 };
          if (gestureState.numberActiveTouches < 2) {
            initialTouchDistanceRef.current = null;
            initialZoomRef.current = camera.zoom;
          }
        },
        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const t1 = touches[0];
            const t2 = touches[1];
            const dx = t1.pageX - t2.pageX;
            const dy = t1.pageY - t2.pageY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (!initialTouchDistanceRef.current) {
              initialTouchDistanceRef.current = distance;
              initialZoomRef.current = camera.zoom;
              return;
            }

            const delta = distance / Math.max(initialTouchDistanceRef.current, 1);
            const nextZoom = Math.max(0.6, Math.min(2.1, initialZoomRef.current * delta));

            setCamera((prev) => ({
              ...prev,
              zoom: nextZoom
            }));
            panDeltaRef.current = { dx: gestureState.dx, dy: gestureState.dy };
            return;
          }

          initialTouchDistanceRef.current = null;
          const deltaX = gestureState.dx - panDeltaRef.current.dx;
          const deltaY = gestureState.dy - panDeltaRef.current.dy;
          panDeltaRef.current = { dx: gestureState.dx, dy: gestureState.dy };

          setCamera((prev) => ({
            ...prev,
            rotationY: prev.rotationY + deltaX * 0.008,
            rotationX: Math.max(-1.1, Math.min(1.1, prev.rotationX - deltaY * 0.006))
          }));
        },
        onPanResponderRelease: () => {
          initialTouchDistanceRef.current = null;
          initialZoomRef.current = camera.zoom;
          panDeltaRef.current = { dx: 0, dy: 0 };
        },
        onPanResponderTerminate: () => {
          initialTouchDistanceRef.current = null;
          panDeltaRef.current = { dx: 0, dy: 0 };
        }
      }),
    [camera.zoom]
  );

  const resetCamera = () => {
    setCamera(CAMERA_DEFAULT);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2A9D8F" />
        <Text style={styles.loadingText}>Building your graph...</Text>
      </View>
    );
  }

  if (nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Graph Data Yet</Text>
        <Text style={styles.emptyText}>
          Sync your GitHub skills first in the Skills tab to generate your knowledge map.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search skill..."
          placeholderTextColor="#7B6F4B"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchResults.length > 0 && (
          <View style={styles.searchResultsBox}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => {
                    setSelectedNodeId(item.id);
                    setSearch("");
                    setSearchResults([]);
                  }}
                >
                  <Text style={styles.searchResultText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
      <View style={styles.mapFrame} {...panResponder.panHandlers}>
        <View style={styles.graphPlaneCentered}>
          {visibleEdges.map(({ edge, length, angle, centerX, centerY }) => {
            const alpha = Math.max(
              EDGE_MIN_ALPHA,
              Math.min(EDGE_MAX_ALPHA, EDGE_MIN_ALPHA + edge.weight * EDGE_MAX_ALPHA)
            );
            return (
              <View
                key={edge.id}
                style={[
                  styles.edge,
                  {
                    width: Math.max(1, length),
                    left: centerX - length / 2,
                    top: centerY,
                    opacity: alpha,
                    backgroundColor: "#7A7A7A",
                    transform: [{ rotateZ: `${angle}rad` }]
                  }
                ]}
              />
            );
          })}
          {projectedNodes.map(({ node, screenX, screenY, radius }) => {
            const isSelected = localSelectedNode && localSelectedNode.id === node.id;
            return (
              <Pressable
                key={node.id}
                onPress={() => setSelectedNodeId(node.id)}
                style={[
                  styles.node,
                  {
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    left: screenX - radius,
                    top: screenY - radius,
                    backgroundColor: node.color,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: "#102A43"
                  }
                ]}
              >
                <Text numberOfLines={1} style={styles.nodeLabel}>
                  {node.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.mapHintBar}>
          <Text style={styles.mapHintText}>Drag to orbit • Pinch to zoom • Tap node for details</Text>
        </View>
      </View>
      {/* Collapsible Drawer for Stats, Clusters, and Node Details */}
      <Animated.View
        style={[
          styles.drawer,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateY: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
            opacity: drawerAnim
          }
        ]}
        pointerEvents={drawerOpen ? 'auto' : 'none'}
      >
        {localSelectedNode ? (
          <>
            <View style={styles.drawerHeader}>
              <View style={[styles.drawerColor, { backgroundColor: localSelectedNode.color }]} />
              <View style={styles.drawerHeaderTextWrap}>
                <Text style={styles.drawerTitle}>{localSelectedNode.name}</Text>
                <Text style={styles.drawerSubtitle}>{localSelectedNode.category}</Text>
              </View>
              <Pressable onPress={() => setSelectedNodeId(null)}>
                <Text style={styles.drawerClose}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.drawerMetrics}>
              <Text style={styles.drawerMetricLabel}>
                Confidence: {Math.round(localSelectedNode.confidenceScore * 100)}%
              </Text>
              <Text style={styles.drawerMetricLabel}>Detected In: {localSelectedNode.repoCount} repos</Text>
            </View>
            <Text style={styles.drawerSectionTitle}>Top Related Skills</Text>
            {relatedSkills.length === 0 ? (
              <Text style={styles.noRelationText}>No strong relationships yet. Sync more repositories.</Text>
            ) : (
              relatedSkills.map((related) => (
                <View key={related.id} style={styles.relatedRow}>
                  <View style={[styles.relatedDot, { backgroundColor: related.color }]} />
                  <Text style={styles.relatedName}>{related.name}</Text>
                  <Text style={styles.relatedWeight}>{Math.round(related.weight * 100)}%</Text>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Category Clusters</Text>
              <Pressable onPress={() => setDrawerOpen(false)}><Text style={styles.drawerClose}>Hide</Text></Pressable>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{nodes.length}</Text>
                <Text style={styles.statLabel}>Skills</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{edges.length}</Text>
                <Text style={styles.statLabel}>Edges</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{clusters.length}</Text>
                <Text style={styles.statLabel}>Clusters</Text>
              </View>
            </View>
            <View style={styles.clusterWrap}>
              {clusters.map((cluster) => (
                <View key={cluster.category} style={[styles.clusterChip, { borderColor: cluster.color }]}> 
                  <View style={[styles.clusterDot, { backgroundColor: cluster.color }]} />
                  <Text style={styles.clusterText}>
                    {cluster.category} ({cluster.nodeCount})
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBarWrap: {
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 18,
    backgroundColor: '#F5F3E7',
    zIndex: 10
  },
  searchBar: {
    width: '100%',
    backgroundColor: '#EFE9D7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#3A3A29',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#D6D1B1',
    marginBottom: 2
  },
  searchResultsBox: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6D1B1',
    shadowColor: '#B5A77A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 20,
    maxHeight: 180
  },
  searchResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#F0EAD6'
  },
  searchResultText: {
    color: '#1E4B42',
    fontWeight: '700',
    fontSize: 15
  },
  container: {
    flex: 1,
    backgroundColor: "#E6E4D9", // earthy background
    padding: 0,
    margin: 0,
    width: '100%',
    height: '100%'
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF3EF"
  },
  loadingText: {
    marginTop: 10,
    color: "#36544F",
    fontSize: 14,
    fontWeight: "600"
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF3EF",
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 10
  },
  emptyText: {
    textAlign: "center",
    color: "#375A58"
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingTop: 24,
    paddingHorizontal: 18,
    backgroundColor: "#F5F3E7",
    borderBottomWidth: 1,
    borderColor: "#D6D1B1",
    shadowColor: "#B5A77A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#3A3A29",
    letterSpacing: 0.5
  },
  subtitle: {
    marginTop: 2,
    color: "#7B6F4B",
    fontSize: 13,
    fontWeight: "600"
  },
  refreshButton: {
    backgroundColor: "#2A9D8F",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12
  },
  toolbarRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 18
  },
  toolbarButton: {
    backgroundColor: "#F5F3E7",
    borderWidth: 1,
    borderColor: "#B5A77A",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#B5A77A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1
  },
  toolbarButtonActive: {
    backgroundColor: "#E6E4D9",
    borderColor: "#7B6F4B"
  },
  toolbarText: {
    color: "#3A3A29",
    fontSize: 13,
    fontWeight: "800"
  },
  toolbarTextActive: {
    color: "#7B6F4B"
  },
  mapFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: "#F6FAF7",
    borderRadius: 0,
    borderWidth: 0,
    overflow: "hidden"
  },
  graphPlane: {
    position: "relative",
    width: "100%",
    height: GRAPH_HEIGHT
  },
  graphPlaneCentered: {
    position: "relative",
    width: "100%",
    height: GRAPH_HEIGHT,
    justifyContent: 'flex-start',
    alignItems: 'center',
    display: 'flex',
    marginTop: 60, // push map further down
    marginBottom: 0,
    flex: 0
  },
  edge: {
    position: "absolute",
    height: 1.5
  },
  node: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4
  },
  nodeLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  },
  mapHintBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16, 42, 34, 0.65)"
  },
  mapHintText: {
    color: "#EAF7F1",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600"
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBE6E2"
  },
  statValue: {
    color: "#1F5449",
    fontSize: 18,
    fontWeight: "800"
  },
  statLabel: {
    marginTop: 2,
    color: "#4D6861",
    fontSize: 11,
    fontWeight: "600"
  },
  clusterSection: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DBE6E2"
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: "#1E4B42",
    marginBottom: 8
  },
  clusterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  clusterChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: "#F5F3E7",
    marginBottom: 6,
    shadowColor: "#B5A77A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1
  },
  clusterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  clusterText: {
    color: "#2E5A52",
    fontSize: 12,
    fontWeight: "600"
  },
  drawer: {
    marginTop: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#F5F3E7",
    borderWidth: 1.5,
    borderColor: "#B5A77A",
    shadowColor: "#B5A77A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center"
  },
  drawerColor: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8
  },
  drawerHeaderTextWrap: {
    flex: 1
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1D3C34"
  },
  drawerSubtitle: {
    fontSize: 12,
    color: "#44635B",
    fontWeight: "600",
    marginTop: 1
  },
  drawerClose: {
    color: "#1E7A6D",
    fontWeight: "700"
  },
  drawerMetrics: {
    marginTop: 10,
    marginBottom: 10,
    gap: 4
  },
  drawerMetricLabel: {
    color: "#365851",
    fontWeight: "600",
    fontSize: 13
  },
  drawerSectionTitle: {
    marginBottom: 8,
    color: "#23453E",
    fontWeight: "700"
  },
  noRelationText: {
    color: "#5C7770",
    fontSize: 12
  },
  relatedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#E6E4D9",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  relatedDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8
  },
  relatedName: {
    flex: 1,
    color: "#274A42",
    fontWeight: "600"
  },
  relatedWeight: {
    color: "#1F7468",
    fontWeight: "700"
  }
});
