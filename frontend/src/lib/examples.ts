import type { Example } from './types';

// Static fallback examples — used when API is unavailable (dev / cold start).
// Keep in sync with backend/app/examples_data.py.
// All examples must have a @guppy def main() -> None entry point.
export const FALLBACK_EXAMPLES: Example[] = [
  {
    id: 'bell',
    title: 'Bell Pair',
    description: 'Entangle two qubits using H + CNOT. The canonical demonstration of superposition and entanglement.',
    tags: ['entanglement', 'beginner'],
    group: 'Fundamentals',
    qubit_count: 2,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure
from guppylang.std.builtins import result as guppy_result

@guppy
def main() -> None:
    """Creates a Bell state and measures both qubits.

    Expected: |00⟩ and |11⟩ each with ~50% probability.
    """
    q0 = qubit()
    q1 = qubit()
    h(q0)       # Superposition
    cx(q0, q1)  # Entangle
    guppy_result("m0", measure(q0))
    guppy_result("m1", measure(q1))

main.check()`,
  },
  {
    id: 'teleport',
    title: 'Quantum Teleportation',
    description: 'Teleport a qubit state using entanglement and classical feedforward corrections.',
    tags: ['teleportation', 'feedforward', 'intermediate'],
    group: 'Fundamentals',
    qubit_count: 3,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.builtins import owned
from guppylang.std.quantum import cx, h, measure, qubit, x, z
from guppylang.std.builtins import result as guppy_result

@guppy
def teleport(src: qubit @ owned, tgt: qubit) -> None:
    """Teleports the quantum state from src to tgt.

    The no-cloning theorem ensures src is consumed after teleport.
    Classical feedforward corrections restore the state on tgt.
    """
    tmp = qubit()
    h(tmp)
    cx(tmp, tgt)
    cx(src, tmp)
    h(src)
    if measure(src):
        z(tgt)
    if measure(tmp):
        x(tgt)

@guppy
def main() -> None:
    """Prepare src in |+⟩ and teleport to tgt. Result should be ~50/50."""
    src = qubit()
    tgt = qubit()
    h(src)              # Prepare src in |+⟩ — non-trivial state to teleport
    teleport(src, tgt)
    guppy_result("tgt", measure(tgt))

main.check()`,
  },
  {
    id: 'deutsch',
    title: 'Deutsch Algorithm',
    description: 'Determine if a boolean function is constant or balanced in a single query.',
    tags: ['algorithm', 'oracle', 'intermediate'],
    group: 'Algorithms',
    qubit_count: 2,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.builtins import owned
from guppylang.std.quantum import qubit, h, cx, x, measure
from guppylang.std.builtins import result as guppy_result

@guppy
def deutsch_balanced(q: qubit @ owned, anc: qubit @ owned) -> tuple[bool, bool]:
    """Balanced oracle f(x)=x, then measure both qubits."""
    cx(q, anc)
    h(q)
    return measure(q), measure(anc)

@guppy
def main() -> None:
    """Deutsch algorithm with balanced oracle.

    result=1 always — a single query distinguishes balanced from constant.
    """
    q   = qubit()
    anc = qubit()
    h(q)
    x(anc)
    h(anc)
    res, anc_bit = deutsch_balanced(q, anc)
    guppy_result("result", res)     # always 1 for balanced oracle
    guppy_result("anc",    anc_bit)

main.check()`,
  },
  {
    id: 'ghz',
    title: 'GHZ State',
    description: 'Prepare a 5-qubit GHZ state — all qubits perfectly correlated.',
    tags: ['entanglement', 'arrays', 'intermediate'],
    group: 'Fundamentals',
    qubit_count: 5,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.builtins import array, result
from guppylang.std.quantum import qubit, h, cx, measure_array

@guppy
def main() -> None:
    """Prepares a 5-qubit GHZ state: (|00000⟩ + |11111⟩)/√2

    All qubits are perfectly correlated — either all 0 or all 1.
    """
    qubits = array(qubit() for _ in range(5))
    h(qubits[0])
    for i in range(4):
        cx(qubits[i], qubits[i + 1])
    ms = measure_array(qubits)
    result("q", ms)

main.check()`,
  },
  {
    id: 'qec',
    title: 'Bit Flip Code',
    description: 'Three-qubit repetition code: encode, measure syndromes, and correct a single bit-flip error.',
    tags: ['error-correction', 'syndromes', 'advanced'],
    group: 'Error Correction',
    qubit_count: 5,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, cx, x, measure
from guppylang.std.builtins import result as guppy_result

@guppy
def main() -> None:
    """3-qubit bit-flip code.

    Encodes logical |0⟩ = |000⟩, measures error syndromes using ancilla
    qubits, corrects any single-qubit error, then measures the logical qubit.
    Without injected errors all three qubits should read 0.
    """
    # Encode logical |0⟩ into three physical qubits
    q0 = qubit()
    q1 = qubit()
    q2 = qubit()
    cx(q0, q1)
    cx(q0, q2)

    # Syndrome measurement (non-destructive via ancilla)
    anc0 = qubit()
    anc1 = qubit()
    cx(q0, anc0); cx(q1, anc0)
    cx(q1, anc1); cx(q2, anc1)
    s0 = measure(anc0)
    s1 = measure(anc1)

    # Single-qubit error correction
    if s0 and not s1:
        x(q0)           # Error on qubit 0
    if s0 and s1:
        x(q1)           # Error on qubit 1
    if not s0 and s1:
        x(q2)           # Error on qubit 2

    guppy_result("q0", measure(q0))
    guppy_result("q1", measure(q1))
    guppy_result("q2", measure(q2))

main.check()`,
  },
  {
    id: 'state-debug',
    title: 'Bell Pair Inspection',
    description: "Use state_result() to inspect the quantum state mid-circuit. Guppy's equivalent of print() debugging.",
    tags: ['debugging', 'statevector'],
    group: 'Debugging',
    qubit_count: 2,
    default_shots: 256,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure
from guppylang.std.debug import state_result
from guppylang.std.builtins import result as guppy_result

@guppy
def main() -> None:
    """Bell pair preparation with state snapshots.

    Walks through the two-gate sequence that creates a Bell state,
    capturing the wavefunction after each step so you can see superposition
    and entanglement appear one gate at a time.

    Switch to Statevector simulator to see the State tab.
    """
    q0 = qubit()
    q1 = qubit()

    state_result("1. initial", q0, q1)       # |00⟩ — both qubits in ground state

    # H puts q0 into equal superposition
    h(q0)
    state_result("2. after H", q0, q1)       # (|00⟩ + |10⟩)/√2 — q0 in |+⟩, q1 still |0⟩

    # CNOT entangles q0 and q1 — creates the Bell state
    cx(q0, q1)
    state_result("3. Bell state", q0, q1)    # (|00⟩ + |11⟩)/√2 — maximally entangled

    guppy_result("m0", measure(q0))
    guppy_result("m1", measure(q1))

main.check()`,
  },
  {
    id: 'teleport-debug',
    title: 'Quantum Teleportation Inspection',
    description: 'Watch entanglement build and collapse during quantum teleportation using state_result() snapshots at each stage.',
    tags: ['debugging', 'teleportation', 'statevector', 'intermediate'],
    group: 'Debugging',
    qubit_count: 3,
    default_shots: 256,
    source: `from guppylang import guppy
from guppylang.std.builtins import owned, result
from guppylang.std.quantum import cx, h, measure, qubit, x, z
from guppylang.std.debug import state_result

@guppy
def main() -> None:
    """Quantum teleportation with state inspection.

    Teleports src (prepared in |+>) to tgt using an entangled ancilla tmp.
    state_result() snapshots the full 3-qubit wavefunction at each stage,
    letting you watch entanglement build and collapse through the protocol.

    Switch to Statevector simulator to see the State tab.
    """
    src = qubit()   # qubit to teleport — prepared in |+>
    tmp = qubit()   # ancilla — entangled with tgt to form the Bell channel
    tgt = qubit()   # destination qubit

    # Prepare src in |+> = (|0> + |1>)/sqrt(2)
    h(src)
    state_result("1. src in |+>", src, tmp, tgt)

    # Entangle tmp and tgt — creates the Bell channel
    h(tmp)
    cx(tmp, tgt)
    state_result("2. Bell channel ready", src, tmp, tgt)

    # Joint Bell measurement on src and tmp
    cx(src, tmp)
    h(src)
    state_result("3. Before measurement", src, tmp, tgt)

    # Mid-circuit measurement — wavefunction collapses here
    m_src = measure(src)
    m_tmp = measure(tmp)

    # Classical feedforward corrections on tgt
    if m_tmp:
        x(tgt)
    if m_src:
        z(tgt)

    # tgt now holds the teleported |+> state
    state_result("4. After correction (tgt only)", tgt)
    result("tgt", measure(tgt))

main.check()`,
  },
  {
    id: 'ghz-debug',
    title: 'GHZ State Inspection',
    description: 'Watch 3-qubit GHZ entanglement spread step by step using state_result() as each CNOT is applied.',
    tags: ['debugging', 'entanglement', 'statevector', 'intermediate'],
    group: 'Debugging',
    qubit_count: 3,
    default_shots: 256,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure
from guppylang.std.debug import state_result
from guppylang.std.builtins import result

@guppy
def main() -> None:
    """GHZ state preparation with state snapshots.

    Watch entanglement spread qubit by qubit as each CNOT is applied,
    building the 3-qubit GHZ state (|000> + |111>)/sqrt(2).

    Switch to Statevector simulator to see the State tab.
    """
    q0 = qubit()
    q1 = qubit()
    q2 = qubit()

    state_result("1. initial", q0, q1, q2)            # |000>

    h(q0)
    state_result("2. after H on q0", q0, q1, q2)      # (|000> + |100>)/sqrt(2)

    cx(q0, q1)
    state_result("3. after cx(q0,q1)", q0, q1, q2)    # (|000> + |110>)/sqrt(2)

    cx(q1, q2)
    state_result("4. GHZ ready", q0, q1, q2)          # (|000> + |111>)/sqrt(2)

    result("q0", measure(q0))
    result("q1", measure(q1))
    result("q2", measure(q2))

main.check()`,
  },
  {
    id: 'deutsch-debug',
    title: 'Deutsch Algorithm Inspection',
    description: 'See phase kickback in action — watch how the oracle encodes f(x) as a global phase and the final H converts it to a measurable bit.',
    tags: ['debugging', 'algorithm', 'statevector', 'intermediate'],
    group: 'Debugging',
    qubit_count: 2,
    default_shots: 256,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, x, measure
from guppylang.std.debug import state_result
from guppylang.std.builtins import result

@guppy
def main() -> None:
    """Deutsch algorithm with state snapshots.

    Watch how the balanced oracle encodes f(x) as a global phase via
    kickback, and how the final Hadamard converts that into a measurable bit.

    Switch to Statevector simulator to see the State tab.
    """
    q   = qubit()
    anc = qubit()

    state_result("1. initial", q, anc)           # |00>

    h(q)
    x(anc)
    h(anc)
    state_result("2. |+-> prepared", q, anc)     # query register in |+->

    # Balanced oracle: f(x) = x
    cx(q, anc)
    state_result("3. after oracle", q, anc)      # phase kickback applied

    h(q)
    state_result("4. after final H", q, anc)     # q collapses to |1> — balanced

    result("result", measure(q))
    result("anc", measure(anc))

main.check()`,
  },
  {
    id: 'qec-debug',
    title: 'Bit Flip Code Inspection',
    description: 'Watch the QEC cycle: encode a logical qubit, inject an error, measure syndromes, and verify the corrected state with state_result().',
    tags: ['debugging', 'error-correction', 'statevector', 'advanced'],
    group: 'Debugging',
    qubit_count: 5,
    default_shots: 256,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, cx, x, measure
from guppylang.std.debug import state_result
from guppylang.std.builtins import result

@guppy
def main() -> None:
    """3-qubit bit-flip code with state snapshots.

    Watch the logical |0> get encoded across three physical qubits,
    a bit-flip error get injected, syndromes measured, and the state restored.

    Switch to Statevector simulator to see the State tab.
    """
    q0 = qubit()
    q1 = qubit()
    q2 = qubit()

    state_result("1. initial |000>", q0, q1, q2)

    # Encode logical |0> -> |000>
    cx(q0, q1)
    cx(q0, q2)
    state_result("2. encoded |000>", q0, q1, q2)

    # Inject a bit-flip error on q1
    x(q1)
    state_result("3. after error on q1", q0, q1, q2)

    # Syndrome measurement via ancilla qubits
    anc0 = qubit()
    anc1 = qubit()
    cx(q0, anc0); cx(q1, anc0)
    cx(q1, anc1); cx(q2, anc1)
    s0 = measure(anc0)
    s1 = measure(anc1)

    # Correction
    if s0 and not s1:
        x(q0)
    if s0 and s1:
        x(q1)
    if not s0 and s1:
        x(q2)

    state_result("4. after correction", q0, q1, q2)

    result("q0", measure(q0))
    result("q1", measure(q1))
    result("q2", measure(q2))

main.check()`,
  },
];
