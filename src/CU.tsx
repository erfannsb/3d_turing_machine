import { useState, useMemo, useId, useRef, useEffect } from "react";
import { ChevronRight, Info, RotateCcw } from "lucide-react";
import { useTMStore, useUIStore } from "./storage";
import TuringMachine from "./logic/tm";

// TYPES
type Direction = "R" | "L";
type Transition = [string, string, Direction]; // [TargetState, WriteChar, MoveDirection]
type TransitionDetail = {
  from: string;
  to: string;
  input: string;
  write: string;
  dir: Direction;
  index: number;
  isSelfLoop: boolean;
};

// Helper component for SVG labels
function Label({
  x,
  y,
  text,
  active,
}: {
  x: number;
  y: number;
  text: string;
  active: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x="-40"
        y="-12"
        width="80"
        height="24"
        rx="4"
        className={`${
          active ? "fill-blue-500" : "fill-slate-300"
        } transition-colors duration-300 stroke-slate-600`}
        strokeWidth="1"
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        className={`text-xs font-mono pointer-events-none select-none font-bold ${
          active ? "fill-white" : "fill-slate-600"
        }`}
      >
        {text}
      </text>
    </g>
  );
}

export default function TuringMachineDFA() {
  const [selectedTransition, setSelectedTransition] = useState<string | null>(
    null
  );

  const [transition, setTransition] = useState<string>("Unary Incrementer");
  const transitionRef = useRef<HTMLSelectElement>(null);
  const setTuringMachine = useUIStore((state) => state.setTuringObject);
  const turing_object = useUIStore((state) => state.turing_object);
  const [start, setStart] = useState(false);
  const textRef = useRef<HTMLInputElement>(null);
  const {
    tapeArray,
    headPosition,
    currentState,
    setTapeArray,
    setHeadPosition,
    setState,
    currentSymbol,
    setCurrentSymbol,
  } = useTMStore();
  const tmRef = useRef({
    tape: tapeArray,
    head: headPosition,
    state: currentState,
  });

  useEffect(() => {
    tmRef.current.tape = tapeArray;
  }, [tapeArray]);
  useEffect(() => {
    tmRef.current.head = headPosition;
  }, [headPosition]);
  useEffect(() => {
    tmRef.current.state = currentState;
  }, [currentState]);

  // Generate a unique prefix for SVG IDs to prevent conflicts if multiple components exist
  const idPrefix = useId().replace(/:/g, "");

  const transitions = useMemo(() => {
    const t = new Map<string, Map<string, Transition>>();

    let accept_state = "q_accept";

    if (transition === "Unary Incrementer") {
      t.set(
        "q0",
        new Map([
          ["1", ["q0", "-", "R"]],
          ["0", ["q0", "-", "R"]],
          ["□", ["q1", "1", "L"]],
        ])
      );
      t.set(
        "q1",
        new Map([
          ["1", ["q_accept", "-", "R"]],
          ["0", ["q_accept", "-", "R"]],
        ])
      );
      t.set("q_accept", new Map());

      accept_state = "q_accept";
    } else if (transition === "Binary Complement") {
      t.set(
        "q0",
        new Map([
          ["0", ["q0", "1", "R"]],
          ["1", ["q0", "0", "R"]],
          ["□", ["q_accept", "-", "L"]],
        ])
      );
      t.set("q_accept", new Map());

      accept_state = "q_accept";
    } else if (transition === "Even Length Checker") {
      // Accepts if string has even length
      t.set(
        "q0",
        new Map([
          ["0", ["q1", "X", "R"]],
          ["1", ["q1", "X", "R"]],
          ["□", ["q_accept", "□", "L"]],
        ])
      );
      t.set(
        "q1",
        new Map([
          ["0", ["q0", "X", "R"]],
          ["1", ["q0", "X", "R"]],
          ["X", ["q1", "X", "R"]],
          ["□", ["q_reject", "□", "L"]],
        ])
      );
      t.set("q_accept", new Map());
      t.set("q_reject", new Map());
      accept_state = "q_accept";
    }

    setTuringMachine(
      new TuringMachine(["1", "0", "_"], t, "q0", accept_state, "q_reject")
    );

    return t;
  }, [transition]);
  const states = Array.from(transitions.keys());
  const acceptStates = new Set(["q_accept"]);
  const NODE_RADIUS = 30;

  // LAYOUT CALCULATION
  const { positions } = useMemo(() => {
    const radius = 180;
    const centerX = 400;
    const centerY = 300;
    const angleSlice = (2 * Math.PI) / states.length;

    const pos = states.reduce((acc, state, i) => {
      // Start from -90deg (top)
      const angle = i * angleSlice - Math.PI / 2;
      acc[state] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        angle: angle, // Store angle for loop calculations
      };
      return acc;
    }, {} as Record<string, { x: number; y: number; angle: number }>);

    return { positions: pos, center: { x: centerX, y: centerY } };
  }, [states]);

  const getTransitionKey = (from: string, input: string) => `${from}-${input}`;

  useEffect(() => {
    let key = getTransitionKey(currentState, currentSymbol);
    console.log({ currentState, currentSymbol });
    setSelectedTransition(key);
  }, [tapeArray, headPosition, currentState]);

  // Pre-process transitions to group self-loops and inter-node for indexed calculations
  const transitionsData: TransitionDetail[] = useMemo(() => {
    return states.flatMap((from) => {
      const fromTrans = transitions.get(from);
      if (!fromTrans) return [];

      const selfLoops = Array.from(fromTrans.entries())
        .filter(([_, [to]]) => from === to)
        .map(([input, [to, write, dir]], index) => ({
          from,
          to,
          input,
          write,
          dir,
          index, // Index within self-loops for this state
          isSelfLoop: true,
        }));

      const interNode = Array.from(fromTrans.entries())
        .filter(([_, [to]]) => from !== to)
        .map(([input, [to, write, dir]], index) => ({
          from,
          to,
          input,
          write,
          dir,
          index, // Index within inter-node transitions for this state
          isSelfLoop: false,
        }));

      return [...selfLoops, ...interNode];
    });
  }, [transitions, states]);

  // Function to calculate path and label geometry
  const calculateGeometry = (detail: TransitionDetail) => {
    const { from, to, input, write, dir, index, isSelfLoop } = detail;
    const fromPos = positions[from];
    const toPos = positions[to];
    const key = getTransitionKey(from, input);

    if (!fromPos || !toPos) return null;

    if (isSelfLoop) {
      // --- SELF LOOP GEOMETRY ---
      const baseAngle = fromPos.angle;
      const loopSpread = 0.7;
      const angleOffset = (index - 0.5) * loopSpread;

      const adjustedAngle = baseAngle + angleOffset;

      const nodeR = NODE_RADIUS;
      const ctrlDist = 50 + index * 30;

      const startAngle = adjustedAngle - 0.5;
      const endAngle = adjustedAngle + 0.5;

      const startX = fromPos.x + nodeR * Math.cos(startAngle);
      const startY = fromPos.y + nodeR * Math.sin(startAngle);

      const endPathX = fromPos.x + nodeR * Math.cos(endAngle);
      const endPathY = fromPos.y + nodeR * Math.sin(endAngle);

      const cp1x = fromPos.x + ctrlDist * Math.cos(startAngle);
      const cp1y = fromPos.y + ctrlDist * Math.sin(startAngle);
      const cp2x = fromPos.x + ctrlDist * Math.cos(endAngle);
      const cp2y = fromPos.y + ctrlDist * Math.sin(endAngle);

      const labelDist = ctrlDist + 10 + index * 10;
      const labelX = fromPos.x + labelDist * Math.cos(adjustedAngle);
      const labelY = fromPos.y + labelDist * Math.sin(adjustedAngle);

      const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endPathX} ${endPathY}`;
      const labelText = `${input} → ${write}, ${dir}`;

      return { key, pathD, labelX, labelY, labelText };
    } else {
      // --- INTER-NODE ARC GEOMETRY ---
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Curve amount (indexed by transition pair)
      const curveOffset = -40 + index * 40;

      // Perpendicular vector for curve
      const perpX = -dy / dist;
      const perpY = dx / dist;

      const midX = (fromPos.x + toPos.x) / 2;
      const midY = (fromPos.y + toPos.y) / 2;

      // Calculate control point for the curve
      const cpX = midX + perpX * curveOffset;
      const cpY = midY + perpY * curveOffset;

      // Calculate the label position: slightly further out than the control point.
      // This is the key change to prevent overlap with the path and other potential labels.
      const labelOffset = curveOffset + 0; // +10px margin from the control point
      const labelX = midX + perpX * labelOffset;
      const labelY = midY + perpY * labelOffset;

      // Calculate the true start and end points on the circumference (NODE_RADIUS = 30)
      const angleToTarget = Math.atan2(dy, dx);

      // Start point: Offset from center of 'from' state
      const startX = fromPos.x + NODE_RADIUS * Math.cos(angleToTarget);
      const startY = fromPos.y + NODE_RADIUS * Math.sin(angleToTarget);

      // End point: Offset from center of 'to' state (moves back 30px from target center)
      const angleFromTarget = Math.atan2(-dy, -dx);
      const endX = toPos.x + NODE_RADIUS * Math.cos(angleFromTarget);
      const endY = toPos.y + NODE_RADIUS * Math.sin(angleFromTarget);

      const pathD = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
      const labelText = `${input} → ${write}, ${dir}`;

      return { key, pathD, labelX, labelY, labelText };
    }
  };

  // Memoize all geometry calculations once
  const geometries = useMemo(() => {
    return transitionsData
      .map(calculateGeometry)
      .filter((g) => g !== null) as NonNullable<
      ReturnType<typeof calculateGeometry>
    >[];
  }, [transitionsData, positions]);

  const onStepClick = () => {
    if (!start) {
      alert("You Haven't setup the tape");
      return;
    }
    if (turing_object) {
      console.log({ turing_object });
      let obj = turing_object.step(tapeArray, headPosition, currentState);
      if (!obj) return;
      if (obj!.newTape != null) setTapeArray(obj.newTape);
      setHeadPosition(obj.newHead);
      setState(obj.newState);
      // set current symbol
      setCurrentSymbol(tapeArray[obj.newHead]);
    }
  };
  const onRunClick = async () => {
    if (!start) return;
    if (!turing_object) return;

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    while (
      tmRef.current.state != "q_accept" &&
      tmRef.current.state != "q_reject"
    ) {
      console.log({ tmRef });

      const obj = turing_object.step(
        tmRef.current.tape,
        tmRef.current.head,
        tmRef.current.state
      );

      if (!obj) return;
      if (obj!.newTape != null) tmRef.current.tape = obj.newTape;
      tmRef.current.head = obj.newHead;
      tmRef.current.state = obj.newState;

      console.log("new ref");
      console.log({ tmRef });

      if (obj!.newTape != null) setTapeArray(obj.newTape);
      setHeadPosition(obj.newHead);
      setState(obj.newState);

      await sleep(300);
    }
  };

  const onResetClick = () => {
    setHeadPosition(0);
    setTapeArray(["□", "□", "□", "□", "□"]);
    setState("q0");
    setCurrentSymbol("□");
    setStart(false);
  };

  return (
    <div className="min-w-fit max-w-6xl mx-auto p-4 h-full">
      <div className="flex flex-col lg:flex-row gap-3 h-full">
        <div className="flex flex-col gap-2">
          {/* 1. SVG DIAGRAM AREA */}
          <div className="flex-1 rounded-lg overflow-hidden relative flex flex-col bg-slate-200 border border-slate-400">
            <div className="p-3 border-b border-slate-500 bg-slate-400/20">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Turing Machine Control Unit
              </h3>
            </div>

            <svg
              width="700"
              height="100%"
              viewBox="0 0 800 600"
              className="w-full h-auto"
            >
              <defs>
                {/* Markers with unique IDs */}
                <marker
                  id={`${idPrefix}-arrow`}
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 5 3, 0 6" fill="#60a5fa" />
                </marker>
                <marker
                  id={`${idPrefix}-arrow-active`}
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 5 3, 0 6" fill="#2b7fff" />
                </marker>
              </defs>

              {/* PASS 1: TRANSITION PATHS (Drawn first/underneath) */}
              <g>
                {geometries.map((g) => {
                  const isSelected = selectedTransition === g.key;
                  return (
                    <path
                      key={g.key}
                      // onClick={() =>
                      //   setSelectedTransition(isSelected ? null : g.key)
                      // }
                      d={g.pathD}
                      stroke={isSelected ? "#2b7fff" : "#60a5fa"}
                      strokeWidth={isSelected ? 3 : 2}
                      fill="none"
                      markerEnd={`url(#${idPrefix}-arrow${
                        isSelected ? "-active" : ""
                      })`}
                      opacity={isSelected ? 1 : 0.4}
                      className="transition-all duration-300 cursor-pointer"
                    />
                  );
                })}
              </g>

              {/* PASS 2: TRANSITION LABELS (Drawn second/on top) */}
              <g>
                {geometries.map((g) => {
                  const isSelected = selectedTransition === g.key;
                  return (
                    <Label
                      key={`label-${g.key}`}
                      x={g.labelX}
                      y={g.labelY}
                      text={g.labelText}
                      active={isSelected}
                    />
                  );
                })}
              </g>

              {/* PASS 3: STATES (NODES) (Drawn last/on very top) */}
              {states.map((state) => {
                const pos = positions[state];
                const isAccept = acceptStates.has(state);

                return (
                  <g key={state} transform={`translate(${pos.x}, ${pos.y})`}>
                    {/* Node Circle */}
                    <circle
                      r={NODE_RADIUS}
                      className={`${
                        currentState == state
                          ? "stroke-blue-500 stroke-3"
                          : isAccept
                          ? "stroke-emerald-400"
                          : "stroke-slate-400"
                      }  ${
                        currentState == state
                          ? "fill-blue-300"
                          : "fill-slate-300"
                      } transition-colors duration-300`}
                      strokeWidth={isAccept ? 3 : 2}
                    />
                    {isAccept && (
                      <circle
                        r={NODE_RADIUS - 6}
                        className="stroke-emerald-400 fill-none stroke-2"
                        strokeWidth="1"
                      />
                    )}

                    {/* Start State Indicator */}
                    {state === "q0" && (
                      <path
                        d={`M -50 0 L -${NODE_RADIUS} 0 L -${
                          NODE_RADIUS + 5
                        } -4 M -${NODE_RADIUS} 0 L -${NODE_RADIUS + 5} 4`}
                        stroke="#60a5fa"
                        strokeWidth="2"
                        fill="none"
                      />
                    )}

                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-slate-600 font-bold text-sm pointer-events-none select-none"
                    >
                      {state}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* input */}
          <div className="border border-slate-400 rounded-lg p-3 flex items-center justify-between">
            <div>
              <label htmlFor="ads" className="mr-1 font-bold text-sm">
                Choose Delta Function:
              </label>
              <select
                name="delta"
                id="ads"
                className=" text-blue-900/80"
                ref={transitionRef}
                onChange={(e) => setTransition(e.target.value)}
              >
                <option value="Unary Incrementer">Unary Incrementer</option>
                <option value="Binary Complement">Binary Complement</option>
                <option value="Even Length Checker">Even Length Checker</option>
              </select>
            </div>

            <button
              className="flex items-center gap-2 rounded-lg hover:text-slate-800 transition py-1 px-2 text-sm font-semibold cursor-pointer"
              onClick={onResetClick}
            >
              <h2>RESET</h2> <RotateCcw size={16} />
            </button>
          </div>
          <div className="border  border-slate-400 rounded-lg p-2 px-4 flex justify-between items-center">
            <label htmlFor="ddd" className="mr-1 font-bold text-sm">
              Input:
            </label>
            <input
              type="text"
              name="something"
              id="ddd"
              placeholder="Enter Your String"
              className="border-none outline-none bg-slate-200 flex-1 text-blue-900/80"
              ref={textRef}
              onChange={() => {
                if (
                  ["1", "0", "_"].some(
                    (char) =>
                      !textRef.current!.value.split("").every((c) => c === char)
                  )
                ) {
                  textRef.current!.value = textRef
                    .current!.value.split("")
                    .filter((c) => c === "1" || c === "0" || c === "_")
                    .join("");
                }
              }}
            />
            <button
              className="bg-slate-900 text-white rounded-lg ml-4 hover:bg-slate-800 transition py-1 px-2 text-sm font-semibold cursor-pointer"
              onClick={() => {
                if (textRef.current) {
                  if (textRef.current.value === "") {
                    alert("Input cannot be empty");
                    return;
                  }
                  setStart(true);
                  setHeadPosition(0);
                  setState("q0");
                  if (
                    textRef.current.value
                      .split("")
                      .some((c) => ["1", "0"].includes(c) === false)
                  ) {
                    alert(
                      "Input contains invalid characters for the selected transition function."
                    );
                    return;
                  }
                  setTapeArray(
                    [
                      ...textRef.current.value.split(""),
                      Array(10).fill("□"),
                    ].flat()
                  );
                  setCurrentSymbol(textRef.current.value[0]);
                }
              }}
            >
              SUBMIT
            </button>
            <button
              className="bg-slate-900 text-white rounded-lg ml-1 hover:bg-slate-800 transition py-1 px-2 text-sm font-semibold cursor-pointer"
              onClick={onStepClick}
            >
              STEP
            </button>
            <button
              className="bg-indigo-800/80 text-white rounded-lg ml-1 hover:bg-slate-800 transition py-1 px-2 text-sm font-semibold cursor-pointer"
              onClick={onRunClick}
            >
              RUN
            </button>
          </div>
        </div>

        {/* 2. INTERACTIVE TABLE AREA */}
        <div className="w-full lg:w-80 flex flex-1 flex-col gap-4">
          <div className="bg-slate-200 rounded-lg border border-slate-500 flex flex-col flex-1 overflow-hidden">
            <div className="p-3 border-b border-slate-500 bg-slate-400/20">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Transition Function
              </h3>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {states.map((from) => {
                const fromTrans = transitions.get(from);
                if (!fromTrans || fromTrans.size === 0) return null;

                return (
                  <div
                    key={from}
                    className=" rounded-md overflow-hidden border border-slate-500/50"
                  >
                    <div className="px-3 py-1.5 bg-slate-400/20 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      State: {from}
                    </div>
                    {Array.from(fromTrans.entries()).map(
                      ([input, [to, write, dir]]) => {
                        const key = getTransitionKey(from, input);
                        const isSelected = selectedTransition === key;

                        return (
                          <div
                            key={key}
                            // onClick={() =>
                            //   setSelectedTransition(isSelected ? null : key)
                            // }
                            className={`
                                    px-3 py-2 cursor-pointer flex items-center justify-between text-sm border-l-2 transition-colors
                                    ${
                                      isSelected
                                        ? "bg-blue-500/10 border-blue-500"
                                        : "border-transparent hover:bg-slate-300"
                                    }
                                `}
                          >
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-slate-700 bg-slate-300 px-1.5 rounded text-xs">
                                {input === " " ? "SPACE" : input}
                              </span>
                              <ChevronRight
                                size={14}
                                className="text-slate-500"
                              />
                              <span className="text-slate-800/90">{to}</span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              <span className="text-blue-500">{write}</span>,
                              <span className="text-violet-500 ml-1">
                                {dir}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* LEGEND */}
          <div className="bg-slate-200 border border-slate-400 rounded-lg p-4 text-xs text-slate-800">
            <div className="flex items-center gap-2 mb-2 font-bold text-slate-800">
              <Info size={14} /> Legend
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400"></div> State
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full border-2 border-emerald-400"></div>{" "}
                Accept State
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-blue-400"></div> Selected
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-blue-400 opacity-40"></div>{" "}
                Transition
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
