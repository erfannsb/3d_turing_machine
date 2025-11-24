import { create } from "zustand";
import TuringMachine from "./logic/tm";

interface StorageData {
  input: string[];
  setInput: (e: string[]) => void;
  turing_object: TuringMachine | null;
  setTuringObject: (tm: TuringMachine) => void;
}

export const useUIStore = create<StorageData>((set) => ({
  input: [""],
  setInput: (e) => set(() => ({ input: e })),
  turing_object: null,
  setTuringObject: (tm) => set(() => ({ turing_object: tm })),
}));

interface TMState {
  tapeArray: string[];
  headPosition: number;
  currentState: string;
  setTapeArray: (tape: string[]) => void;
  setHeadPosition: (pos: number) => void;
  setState: (state: string) => void;
}

export const useTMStore = create<TMState>((set) => ({
  tapeArray: ["_", "_", "_", "_", "_"], // initial blank tape
  headPosition: 0,
  currentState: "q0",
  setTapeArray: (tape) => set({ tapeArray: tape }),
  setHeadPosition: (headPosition) => set({ headPosition }),
  setState: (state) => set({ currentState: state }),
}));
