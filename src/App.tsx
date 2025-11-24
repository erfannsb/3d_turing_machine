import React, {
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useEffect,
  useCallback,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, useGLTF } from "@react-three/drei";
import "reactflow/dist/style.css";
import TuringMachineDFA from "./CU";
import { useTMStore } from "./storage";
import { Bot } from "lucide-react";

type TuringMachineProps = {
  controlsRef: React.RefObject<any>;
  devMode: boolean;
};

const TuringMachineUI: React.FC<TuringMachineProps> = ({
  controlsRef,
  devMode,
}) => {
  const { tapeArray, headPosition, setHeadPosition } = useTMStore();
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
        if (symbol === "_") symbol = "□"; // blank symbol
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

  const headPositionRef = useRef<number>(headPosition);
  useEffect(() => {
    headPositionRef.current = headPosition;
  }, [headPosition]);

  const moveHeadRight = useCallback(() => {
    if (!devMode) return;
    const currentTape = useTMStore.getState().tapeArray;
    const headPosition = useTMStore.getState().headPosition;
    const newVal = (headPosition + 1) % currentTape.length;
    setHeadPosition(newVal);
  }, [devMode]);

  const moveHeadLeft = useCallback(() => {
    if (!devMode) return;
    const currentTape = useTMStore.getState().tapeArray;
    const headPosition = useTMStore.getState().headPosition;
    const newVal =
      headPosition === 0 ? currentTape.length - 1 : headPosition - 1;
    setHeadPosition(newVal);
  }, [devMode]);

  const writeMode = useCallback(
    (symbol: string) => {
      if (!devMode) return;
      setTapeHeadMode("writing");
      const currentTape = useTMStore.getState().tapeArray;
      const idx = headPositionRef.current;
      const newInput = [...currentTape];
      newInput[idx] = symbol;
      useTMStore.getState().setTapeArray(newInput);
      setTimeout(() => setTapeHeadMode("reading"), 150);
    },
    [devMode]
  );

  useEffect(() => {
    function handleKey(e: any) {
      if (e.key === "ArrowRight") moveHeadRight();
      if (e.key === "ArrowLeft") moveHeadLeft();
      if (e.key === "0") writeMode("0");
      if (e.key === "1") writeMode("1");
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [moveHeadRight, moveHeadLeft, writeMode]);

  useEffect(() => {
    console.log("hellooooo");
    setTapeHeadMode("writing");
    const timeout = setTimeout(() => setTapeHeadMode("reading"), 150);
    return () => clearTimeout(timeout);
  }, [tapeArray]);

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
  const [developmentMode, setDevelopmentMode] = useState<boolean>(false);
  const controlsRef = useRef<any>(null);
  return (
    <div className="font-[Roboto_Mono] flex h-screen bg-slate-200">
      <div className="h-full flex-1 ml-3 flex flex-col gap-3 py-4">
        <div className="h-full border border-slate-400 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-500 bg-slate-400/20 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              3D Model Turing Machine
            </h3>
            <h1
              className={` cursor-pointer ${
                developmentMode ? "text-blue-600" : "text-slate-900"
              }`}
              onClick={() => setDevelopmentMode(!developmentMode)}
            >
              <Bot />
            </h1>
          </div>
          <Canvas
            dpr={[2, 3]}
            camera={{ position: [4, 4, 4], fov: 50 }}
            gl={{ antialias: true }}
            style={{ flexGrow: 1 }}
          >
            <ambientLight intensity={0.2} />
            <directionalLight position={[5, 5, 5]} />
            <TuringMachineUI
              controlsRef={controlsRef}
              devMode={developmentMode}
            />
            <OrbitControls ref={controlsRef} enablePan enableRotate />
          </Canvas>
        </div>
      </div>
      <TuringMachineDFA />
    </div>
  );
}
