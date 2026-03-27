export interface SkillGraphNode {
  id: string;
  type: "skill";
  name: string;
  category: string;
  confidenceScore: number;
  repoCount: number;
  color: string;
}

export interface SkillGraphEdge {
  id: string;
  source: string;
  target: string;
  overlapCount: number;
  weight: number;
}

export interface SkillGraphCluster {
  category: string;
  nodeCount: number;
  averageConfidence: number;
  color: string;
}

export interface SkillGraphPayload {
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    repositoryCount: number;
    lastSyncedAt: string | null;
    clusters: SkillGraphCluster[];
  };
}

export interface NodePosition3D {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface ProjectedNode {
  id: string;
  screenX: number;
  screenY: number;
  depth: number;
  radius: number;
}

const hashFromString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return hash;
};

const unitNoise = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const buildGraphLayout = (
  nodes: SkillGraphNode[],
  clusters: SkillGraphCluster[],
  clusterMode: boolean
): NodePosition3D[] => {
  if (nodes.length === 0) {
    return [];
  }

  const radius = 180;

  if (!clusterMode || clusters.length === 0) {
    return nodes.map((node, index) => {
      const seed = hashFromString(node.id);
      const offset = unitNoise(seed) * 0.25;
      const phi = Math.acos(1 - 2 * ((index + 0.5) / nodes.length));
      const theta = Math.PI * (1 + Math.sqrt(5)) * index + offset;

      return {
        id: node.id,
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta)
      };
    });
  }

  const clusterIndex = new Map(clusters.map((cluster, idx) => [cluster.category, idx]));
  const clusterCount = Math.max(1, clusters.length);

  return nodes.map((node, index) => {
    const idx = clusterIndex.get(node.category) ?? (index % clusterCount);
    const angle = (idx / clusterCount) * Math.PI * 2;
    const centerX = Math.cos(angle) * 160;
    const centerZ = Math.sin(angle) * 160;

    const seed = hashFromString(node.id);
    const jitterR = 20 + unitNoise(seed) * 45;
    const jitterA = unitNoise(seed + 11) * Math.PI * 2;
    const jitterY = (unitNoise(seed + 17) - 0.5) * 90;

    return {
      id: node.id,
      x: centerX + Math.cos(jitterA) * jitterR,
      y: jitterY,
      z: centerZ + Math.sin(jitterA) * jitterR
    };
  });
};

export const projectPoint = (
  point: NodePosition3D,
  rotationX: number,
  rotationY: number,
  zoom: number,
  width: number,
  height: number,
  confidenceScore: number
): ProjectedNode => {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);

  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const y1 = point.y * cosX - z1 * sinX;
  const z2 = point.y * sinX + z1 * cosX;

  const focalLength = 420;
  const perspective = focalLength / (focalLength + z2 + 420);
  const graphScale = Math.max(0.65, zoom);

  const screenX = width / 2 + x1 * perspective * graphScale;
  const screenY = height / 2 + y1 * perspective * graphScale;
  const radius = Math.max(7, 10 + confidenceScore * 14) * perspective;

  return {
    id: point.id,
    screenX,
    screenY,
    depth: z2,
    radius
  };
};

export const toEdgeMap = (positions: NodePosition3D[]): Map<string, NodePosition3D> => {
  const map = new Map<string, NodePosition3D>();
  for (const point of positions) {
    map.set(point.id, point);
  }
  return map;
};
