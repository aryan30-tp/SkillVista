import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { GLView } from "expo-gl";
// @ts-ignore: expo-three types are incomplete
import { Renderer as ExpoThreeRenderer } from "expo-three";
import * as THREE from "three";
import { SkillGraphNode, SkillGraphEdge } from "../utils/knowledgeGraph";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRAPH_HEIGHT = 420;

interface SkillGraph3DViewProps {
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
  clusterMode: boolean;
  cameraState: {
    rotationX: number;
    rotationY: number;
    zoom: number;
  };
  onNodeSelect?: (id: string) => void;
  selectedNodeId?: string | null;
}

export default function SkillGraph3DView({
  nodes,
  edges,
  clusterMode,
  cameraState,
  onNodeSelect,
  selectedNodeId
}: SkillGraph3DViewProps) {
  const requestRef = useRef<number | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  // Use 'any' to suppress linter errors for expo-three Renderer
  const rendererRef = useRef<any>(null);
  const nodeMeshMap = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      nodeMeshMap.current.clear();
    };
  }, []);

  const onContextCreate = async (gl: any) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F6FAF7");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 320);
    cameraRef.current = camera;

    // @ts-ignore: expo-three Renderer type is incomplete
    const renderer = new ExpoThreeRenderer({ gl });
    rendererRef.current = renderer;

    // Add ambient and directional light
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(0, 0, 1);
    scene.add(dirLight);

    // Build node spheres
    nodeMeshMap.current.clear();
    for (const node of nodes) {
      const geometry = new THREE.SphereGeometry(10 + node.confidenceScore * 14, 24, 24);
      const material = new THREE.MeshStandardMaterial({ color: node.color });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        Math.random() * 180 - 90,
        Math.random() * 120 - 60,
        Math.random() * 180 - 90
      );
      mesh.userData = { id: node.id };
      scene.add(mesh);
      nodeMeshMap.current.set(node.id, mesh);
    }

    // Build edge lines
    for (const edge of edges) {
      const source = nodeMeshMap.current.get(edge.source);
      const target = nodeMeshMap.current.get(edge.target);
      if (!source || !target) continue;
      const material = new THREE.LineBasicMaterial({
        color: 0x7a7a7a,
        transparent: true,
        opacity: Math.max(0.15, Math.min(0.55, 0.15 + edge.weight * 0.55))
      });
      const points = [source.position, target.position];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      scene.add(line);
    }

    // Animation loop
    const animate = () => {
      // Camera orbit
      if (cameraRef.current) {
        const { rotationX, rotationY, zoom } = cameraState;
        cameraRef.current.position.x = Math.sin(rotationY) * 320 * zoom;
        cameraRef.current.position.y = Math.sin(rotationX) * 180 * zoom;
        cameraRef.current.position.z = Math.cos(rotationY) * 320 * zoom;
        cameraRef.current.lookAt(0, 0, 0);
      }
      // @ts-ignore: expo-three Renderer type is incomplete
      renderer.render(scene, camera);
      gl.endFrameEXP();
      requestRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  return (
    <View style={styles.container}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: GRAPH_HEIGHT,
    backgroundColor: "#F6FAF7",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8E6E1",
    overflow: "hidden"
  },
  glView: {
    flex: 1,
    width: "100%",
    height: "100%"
  }
});
