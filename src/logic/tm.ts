export default class TuringMachine {
  private transitions: Map<string, Map<string, [string, string, "R" | "L"]>>;
  private alphabet: string[];
  private q_accept: string;
  private q_reject: string;

  constructor(
    alphabet: string[],
    transitions: Map<string, Map<string, [string, string, "R" | "L"]>>,
    q_start: string,
    q_accept: string,
    q_reject: string
  ) {
    this.alphabet = alphabet;
    this.transitions = transitions;
    this.q_accept = q_accept;
    this.q_reject = q_reject;
  }

  // Compute the next step given tape/head/state
  public step(
    tape: string[],
    headPosition: number,
    state: string
  ): { newTape: string[] | null; newHead: number; newState: string } | null {
    const currentSymbol = tape[headPosition] || "□";
    const stateTransitions = this.transitions.get(state);
    if (!stateTransitions || !stateTransitions.has(currentSymbol)) return null;

    const [newState, newSymbol, direction] =
      stateTransitions.get(currentSymbol)!;
    let newTape: string[] | null = [...tape];
    console.log(
      newSymbol !== undefined || newSymbol !== null || newSymbol !== "□"
    );
    if (newSymbol !== "-") {
      newTape[headPosition] = newSymbol;
    } else {
      newTape = null;
    }

    console.log(newTape);
    const newHead = direction === "R" ? headPosition + 1 : headPosition - 1;

    return { newTape, newHead, newState };
  }

  public isAcceptState(state: string) {
    return state === this.q_accept;
  }

  public isRejectState(state: string) {
    return state === this.q_reject;
  }
}
