export default class TuringMachine {
  private tape: string[];
  private headPosition: number;
  public q_accept: string;
  public q_reject: string;
  private state: string;
  private gamma: string[];
  private alphabet: string[];
  private transitions: Map<string, Map<string, [string, string, "R" | "L"]>>;
  // <Q, <Symbol, [NewQ, NewSymbol, Direction]>>
  constructor(
    gamma: string[],
    alphabet: string[],
    transitions: Map<string, Map<string, [string, string, "R" | "L"]>>,
    q_start: string,
    q_accept: string,
    q_reject: string
  ) {
    this.tape = [];
    this.headPosition = 0;
    this.state = q_start;
    this.gamma = gamma;
    this.alphabet = alphabet;
    this.transitions = transitions;
    this.q_accept = q_accept;
    this.q_reject = q_reject;
  }

  public setTransitions(
    transitions: Map<string, Map<string, [string, string, "R" | "L"]>>
  ) {
    this.transitions = transitions;
  }

  public getTransitions() {
    return this.transitions;
  }

  public run(tape: string[]): boolean {
    if (!tape.every((Symbol) => this.alphabet.includes(Symbol))) {
      // if any symbol in the input tape is not in the input alphabet, throw error
      throw new Error("Input tape contains symbols not in the input alphabet");
    }

    this.tape = tape;

    // loop over transition function
    this.transitions.forEach((_, state) => {
      // Q accept and Q reject are halting states meaning the TM stops when it reaches either of these states
      while (state !== this.q_accept && state !== this.q_reject) {
        if (state == this.state) {
          // reading current symbol under the head
          const currentSymbol = this.tape[this.headPosition] || "□";
          const stateTransitions = this.transitions.get(state);
          if (stateTransitions && stateTransitions.has(currentSymbol)) {
            // Getting New State, New Symbol to write, and Direction to move
            const [newState, newSymbol, direction] =
              stateTransitions.get(currentSymbol)!;
            if (!this.gamma.includes(newSymbol)) {
              // if newSymbol not in tape alphabet, throw error
              throw new Error(`Symbol ${newSymbol} not in tape alphabet`);
            }
            this.tape[this.headPosition] = newSymbol;
            this.state = newState;
            if (direction === "R") {
              this.headPosition += 1;
            } else if (direction === "L") {
              this.headPosition -= 1;
            }
          }
        }
      }
    });

    if (this.state === this.q_accept) {
      return true;
    } else {
      return false;
    }
  }
}
