import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  zoom: 1
};

const EDGE_MIN_ALPHA = 0.15;
const EDGE_MAX_ALPHA = 0.55;

export default function KnowledgeMapScreen() {
  const [nodes, setNodes] = useState<SkillGraphNode[]>([]);
  const [edges, setEdges] = useState<SkillGraphEdge[]>([]);
  const [clusters, setClusters] = useState<SkillGraphPayload["metadata"]["clusters"]>([]);
  const [loading, setLoading] = useState(true);
  const [clusterMode, setClusterMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraState>(CAMERA_DEFAULT);

  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(CAMERA_DEFAULT.zoom);
  const panDeltaRef = useRef({ dx: 0, dy: 0 });

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<SkillGraphPayload>("/github/skill-graph");
      const payload = response.data;

      setNodes(payload.nodes || []);
      setEdges(payload.edges || []);
      setClusters(payload.metadata?.clusters || []);
      if (selectedNodeId && !(payload.nodes || []).some((node) => node.id === selectedNodeId)) {
        setSelectedNodeId(null);
      }
    } catch (error) {
      console.error("Error fetching skill graph:", error);
      Alert.alert("Error", "Failed to load your knowledge graph.");
    } finally {
      setLoading(false);
    }
  }, [selectedNodeId]);

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

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    return nodes.find((node) => node.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const relatedSkills = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    return edges
      .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
      .map((edge) => {
        const relatedId = edge.source === selectedNode.id ? edge.target : edge.source;
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
  }, [selectedNode, edges, nodes]);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>3D Knowledge Graph</Text>
          <Text style={styles.subtitle}>
            {nodes.length} skills • {edges.length} relationships
          </Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={fetchGraph}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.toolbarRow}>
        <Pressable
          onPress={() => setClusterMode((prev) => !prev)}
          style={[styles.toolbarButton, clusterMode && styles.toolbarButtonActive]}
        >
          <Text style={[styles.toolbarText, clusterMode && styles.toolbarTextActive]}>
            Cluster View
          </Text>
        </Pressable>

        <Pressable onPress={resetCamera} style={styles.toolbarButton}>
          <Text style={styles.toolbarText}>Reset Camera</Text>
        </Pressable>
      </View>

      <View style={styles.mapFrame} {...panResponder.panHandlers}>
        <View style={styles.graphPlane}>
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
            const isSelected = selectedNodeId === node.id;

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

      <View style={styles.clusterSection}>
        <Text style={styles.sectionTitle}>Category Clusters</Text>
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
      </View>

      {selectedNode ? (
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <View style={[styles.drawerColor, { backgroundColor: selectedNode.color }]} />
            <View style={styles.drawerHeaderTextWrap}>
              <Text style={styles.drawerTitle}>{selectedNode.name}</Text>
              <Text style={styles.drawerSubtitle}>{selectedNode.category}</Text>
            </View>
            <Pressable onPress={() => setSelectedNodeId(null)}>
              <Text style={styles.drawerClose}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.drawerMetrics}>
            <Text style={styles.drawerMetricLabel}>
              Confidence: {Math.round(selectedNode.confidenceScore * 100)}%
            </Text>
            <Text style={styles.drawerMetricLabel}>Detected In: {selectedNode.repoCount} repos</Text>
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
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEF3EF"
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28
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
    marginBottom: 14
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1D3C34"
  },
  subtitle: {
    marginTop: 2,
    color: "#45625C",
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
    gap: 10,
    marginBottom: 12
  },
  toolbarButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D2DDD8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  toolbarButtonActive: {
    backgroundColor: "#CFEDE6",
    borderColor: "#2A9D8F"
  },
  toolbarText: {
    color: "#244B43",
    fontSize: 12,
    fontWeight: "700"
  },
  toolbarTextActive: {
    color: "#1B7167"
  },
  mapFrame: {
    width: "100%",
    height: GRAPH_HEIGHT,
    backgroundColor: "#F6FAF7",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8E6E1",
    overflow: "hidden"
  },
  graphPlane: {
    position: "relative",
    width: "100%",
    height: GRAPH_HEIGHT
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
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F7FCF9"
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
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D3E1DD"
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
    marginBottom: 8
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
