import React, {
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useEffect,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, useGLTF } from "@react-three/drei";
import ReactFlow, { Controls, Background } from "reactflow";
import TuringMachine from "./logic/tm";
import { makeDFADiagram } from "./logic/DFAhelper";
import "reactflow/dist/style.css";
import TuringMachineDFA from "./CU";

function ControlUnitDiagram() {
  const gamma = ["0", "1", "□"];
  const alphabet = ["0", "1"];
  const transitions = new Map<
    string,
    Map<string, [string, string, "R" | "L"]>
  >();
  const q0 = "q0";
  const qAccept = "qa";
  const qReject = "qr";

  transitions.set(
    "q0",
    new Map([
      ["0", ["q0", "1", "R"]],
      ["1", ["q0", "0", "R"]],
      ["□", ["qa", "□", "R"]],
    ])
  );

  const tm = new TuringMachine(
    gamma,
    alphabet,
    transitions,
    q0,
    qAccept,
    qReject
  );

  const { nodes, edges } = makeDFADiagram(tm);
  console.log({ nodes, edges });

  const [activeState, setActiveState] = useState("q0");

  const highlightedNodes = nodes.map((n) => ({
    ...n,
    style: {
      ...n.style,
      border:
        n.id === activeState
          ? "3px solid #ffff00"
          : `2px solid ${n.style?.border || "#888"}`,
      boxShadow: n.id === activeState ? "0 0 30px #ffff00" : n.style?.boxShadow,
      width: 70,
      height: 70,
      borderRadius: "50%",
      padding: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      fontWeight: "bold",
    },
  }));

  return (
    <div style={{ width: "100%", height: "600px", background: "#1a1a1a" }}>
      <ReactFlow
        nodes={highlightedNodes}
        edges={edges}
        fitView
        nodesDraggable={true}
      >
        <Controls />
        <Background gap={20} color="#333" />
      </ReactFlow>
    </div>
  );
}

type TuringMachineProps = {
  controlsRef: React.RefObject<any>;
};

const TuringMachineUI: React.FC<TuringMachineProps> = ({ controlsRef }) => {
  let [tapeArray, setTapeArray] = useState<string[]>([
    "0",
    "1",
    "0",
    "1",
    "0",
    "0",
    "1",
    "0",
    "1",
    "0",
    "1",
    "0",
    "0",
    "1",
    "0",
    "1",
    "0",
    "1",
    "0",
    "0",
    "1",
    "0",
    "1",
    "0",
    "1",
    "0",
    "0",
    "1",
  ]);
  const [headPosition, setHeadPosition] = useState<number>(0);
  const headRef = useRef<THREE.Mesh>(null!);
  const headLightRef = useRef<THREE.SpotLight>(null!);
  const tapeHead = useGLTF("/newtape.glb");
  const [tapeHeadMode, setTapeHeadMode] = useState<"writing" | "reading">(
    "reading"
  );

  // Generate textures for tape symbols
  const tapeTextures = useMemo(
    () =>
      tapeArray.map((symbol) => {
        const size = 1024;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "black";
        ctx.font = "bold 700px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(symbol, size / 2, size / 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
      }),
    [tapeArray]
  );

  useLayoutEffect(() => {
    if (!headRef.current) return;

    headRef.current.rotation.set(0, -Math.PI / 2, 0);
  }, []);

  // Smooth head movement & light target
  useFrame(({ camera }) => {
    if (headRef.current && headLightRef.current && controlsRef.current) {
      // Smooth head movement
      const targetX = headPosition - tapeArray.length / 2;
      headRef.current.position.x = THREE.MathUtils.lerp(
        headRef.current.position.x,
        targetX,
        0.08 // smaller = smoother/slower
      );
      // Make spotlight point at current tape cell
      headLightRef.current.target.position.set(targetX, 0, 0);
      headLightRef.current.target.updateMatrixWorld();

      // Camera follow with smooth lerp
      const desiredPos = new THREE.Vector3(
        headRef.current.position.x - 3, // behind head
        headRef.current.position.y + 3, // above head
        headRef.current.position.z + 3 // side offset
      );
      camera.position.lerp(desiredPos, 0.05);

      // Camera looks at the head
      controlsRef.current.target.lerp(headRef.current.position, 0.1);
      controlsRef.current.update();
    }
  });

  const moveHeadRight = () => {
    setHeadPosition((prev) => (prev + 1) % tapeArray.length);
  };

  const moveHeadLeft = () => {
    setHeadPosition((prev) => (prev === 0 ? tapeArray.length - 1 : prev - 1));
  };

  const headPositionRef = useRef<number>(headPosition);
  useEffect(() => {
    headPositionRef.current = headPosition;
  }, [headPosition]);

  const writeMode = (symbol: string) => {
    setTapeHeadMode("writing");

    setTapeArray((prev) => {
      const newArray = [...prev];
      const idx = headPositionRef.current; // always up-to-date
      newArray[idx] = symbol;
      return newArray;
    });

    setTimeout(() => setTapeHeadMode("reading"), 150);
  };

  useEffect(() => {
    function handleKey(e: any) {
      if (e.key === "ArrowRight") moveHeadRight();
      if (e.key === "ArrowLeft") moveHeadLeft();
      if (e.key === "0") writeMode("0");
      if (e.key === "1") writeMode("1");
    }

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <>
      {/* Tape */}
      <group position={[-tapeArray.length / 2, 0, 0]}>
        {tapeArray.map((_, index) => (
          <mesh
            key={index}
            position={[index, 0, 0]}
            material={[
              new THREE.MeshStandardMaterial({ color: "white" }), // right
              new THREE.MeshStandardMaterial({ color: "white" }), // left
              new THREE.MeshStandardMaterial({
                map: tapeTextures[index], // top highlight
              }),
              new THREE.MeshStandardMaterial({ color: "white" }), // bottom
              new THREE.MeshStandardMaterial({ color: "white" }), // front
              new THREE.MeshStandardMaterial({ color: "white" }), // back
            ]}
          >
            <boxGeometry args={[1, 0.1, 1]} />
          </mesh>
        ))}
      </group>

      {/* Tape Head */}
      <mesh
        ref={headRef}
        position={[headPosition - tapeArray.length / 2, 0.7, 0]}
      >
        <boxGeometry args={[0, 0.3, 0]} />
        <meshStandardMaterial color="black" />

        {/* Spotlight cone from head */}
        <spotLight
          ref={headLightRef}
          color={0x00ffff}
          intensity={10}
          distance={5}
          angle={Math.PI / 2.9}
          penumbra={1}
          castShadow
          position={[0, -0.1, 0]} // slightly under the head
        />
      </mesh>
      <directionalLight intensity={10} position={[2, 5, 10]} />
      <group
        position={[headPosition - tapeArray.length / 2 - 0.1, 0.8, 0]}
        rotation={[0, 0, 0]}
        scale={0.2}
      >
        {/* Your tape head model */}
        <primitive object={tapeHead.scene} />

        {/* Glow cone underneath */}
        <mesh position={[0, -0.3, 0]}>
          <coneGeometry args={[2, 6, 32]} />
          <meshBasicMaterial
            key={tapeHeadMode}
            color={tapeHeadMode === "writing" ? "red" : "cyan"}
            transparent
            opacity={0.4}
          />
        </mesh>
      </group>
    </>
  );
};

export default function App() {
  const controlsRef = useRef<any>(null);
  return (
    <div className="font-[Roboto_Mono] flex h-screen bg-slate-200">
      <div className="h-full flex-1 ml-3 flex flex-col gap-3 py-4">
        <div className="h-full border border-slate-400 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-500 bg-slate-400/20">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              3D Model Turing Machine
            </h3>
          </div>
          <Canvas
            dpr={[2, 3]}
            camera={{ position: [4, 4, 4], fov: 50 }}
            gl={{ antialias: true }}
            style={{ flexGrow: 1 }}
          >
            <ambientLight intensity={0.2} />
            <directionalLight position={[5, 5, 5]} />
            <TuringMachineUI controlsRef={controlsRef} />
            <OrbitControls ref={controlsRef} enablePan enableRotate />
          </Canvas>
        </div>
      </div>
      <TuringMachineDFA />
    </div>
  );
}
