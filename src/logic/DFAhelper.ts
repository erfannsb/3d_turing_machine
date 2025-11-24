import type { Node, Edge } from "reactflow";
import TuringMachine from "./tm.ts";

export type DFANode = Node & {
  id: string;
  data: { label: string };
};

export type DFAEdge = Edge & { source: string; target: string; label: string };

export function makeDFADiagram(tm: TuringMachine): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const nodeColors = [
    { gradient: ["#6b0f1a", "#b91372"], border: "#00ffff", shadow: "#00ffff" },
    { gradient: ["#1a0f6b", "#7213b9"], border: "#ff00ff", shadow: "#ff00ff" },
    { gradient: ["#0f6b1a", "#13b972"], border: "#00ff00", shadow: "#00ff00" },
    { gradient: ["#6b6b0f", "#b9b913"], border: "#ffff00", shadow: "#ffff00" },
    { gradient: ["#6b1a0f", "#b93713"], border: "#ff6600", shadow: "#ff6600" },
    { gradient: ["#1a6b6b", "#13b9b9"], border: "#00ffff", shadow: "#00ffff" },
  ];

  const visited = new Set<string>();
  const statePositions = new Map<string, { x: number; y: number }>();
  let colorIndex = 0;

  // BFS to find all states and their connections
  const allStates = new Set<string>();
  const stateGraph = new Map<string, Set<string>>();

  tm.getTransitions().forEach((stateTransitions, state) => {
    allStates.add(state);
    if (!stateGraph.has(state)) stateGraph.set(state, new Set());

    stateTransitions.forEach((transition) => {
      const [newState] = transition;
      allStates.add(newState);
      if (!stateGraph.has(newState)) stateGraph.set(newState, new Set());
      stateGraph.get(state)!.add(newState);
    });
  });

  allStates.add(tm.q_accept);
  allStates.add(tm.q_reject);

  // Layered layout: BFS from start state
  const layers = new Map<string, number>();
  const queue: string[] = [tm.q_accept, tm.q_reject]; // Start with terminal states
  layers.set(tm.q_accept, 0);
  layers.set(tm.q_reject, 0);

  const visitedBFS = new Set<string>();
  visitedBFS.add(tm.q_accept);
  visitedBFS.add(tm.q_reject);

  // Find which states lead to accept/reject
  let layer = 1;
  while (queue.length > 0 && layer < 10) {
    const nextQueue: string[] = [];
    for (const state of queue) {
      stateGraph.forEach((targets, source) => {
        if (targets.has(state) && !visitedBFS.has(source)) {
          layers.set(source, layer);
          visitedBFS.add(source);
          nextQueue.push(source);
        }
      });
    }
    queue.length = 0;
    queue.push(...nextQueue);
    layer++;
  }

  // Assign unvisited states to layers based on distance
  allStates.forEach((state) => {
    if (!layers.has(state)) {
      layers.set(state, Math.floor(Math.random() * 3) + 1);
    }
  });

  // Group states by layer
  const layerGroups = new Map<number, string[]>();
  layers.forEach((layer, state) => {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(state);
  });

  // Calculate positions using circular/layered layout
  const centerX = 400;
  const centerY = 300;
  const maxRadius = 300;

  layerGroups.forEach((states, layer) => {
    const radius = (layer / Math.max(...layerGroups.keys())) * maxRadius;
    const angleSlice = (2 * Math.PI) / Math.max(states.length, 1);

    states.forEach((state, index) => {
      const angle = angleSlice * index;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      statePositions.set(state, { x, y });
    });
  });

  function addNode(state: string) {
    if (!visited.has(state)) {
      visited.add(state);
      const color = nodeColors[colorIndex % nodeColors.length];
      colorIndex++;

      const pos = statePositions.get(state) || { x: 0, y: 0 };

      nodes.push({
        id: state,
        data: { label: state },
        position: pos,
        style: {
          background: `linear-gradient(135deg, ${color.gradient[0]}, ${color.gradient[1]})`,
          color: "white",
          border: `2px solid ${color.border}`,
          width: 70,
          height: 70,
          textAlign: "center",
          boxShadow: `0 0 20px ${color.shadow}`,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: "bold",
        },
      });
    }
  }

  tm.getTransitions().forEach((stateTransitions, state) => {
    addNode(state);
    stateTransitions.forEach((transition, readSymbol) => {
      const [newState, writeSymbol, dir] = transition;
      addNode(newState);
      edges.push({
        id: `${state}-${newState}-${readSymbol}`,
        source: state,
        target: newState,
        label: `${readSymbol} → ${writeSymbol}, ${dir}`,
        animated: true,
        style: { stroke: "#00ffff", strokeWidth: 2 },
        labelStyle: { fill: "#00ffff", fontWeight: "bold", fontSize: "11px" },
        markerEnd: { type: "arrowclosed", color: "#00ffff" } as any,
      });
    });
  });

  addNode(tm.q_accept);
  addNode(tm.q_reject);

  return { nodes, edges };
}
