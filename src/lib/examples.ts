import type { Example } from './types';

// Static fallback examples — used when API is unavailable (dev / cold start)
export const FALLBACK_EXAMPLES: Example[] = [
  {
    id: 'bell',
    title: 'Bell Pair',
    description: 'Entangle two qubits using H + CNOT. Demonstrates superposition and entanglement.',
    tags: ['entanglement', 'beginner'],
    group: 'Fundamentals',
    qubit_count: 2,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure

@guppy
def bell_pair() -> tuple[bool, bool]:
    """Creates a Bell state and measures both qubits.

    Expected: |00⟩ and |11⟩ each with ~50% probability.
    """
    q0 = qubit()
    q1 = qubit()

    h(q0)       # Superposition
    cx(q0, q1)  # Entangle

    return measure(q0), measure(q1)

bell_pair.check()`,
  },
  {
    id: 'teleport',
    title: 'Quantum Teleportation',
    description: 'Teleport a qubit state using entanglement and classical feedforward.',
    tags: ['teleportation', 'feedforward', 'intermediate'],
    group: 'Fundamentals',
    qubit_count: 3,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.builtins import owned
from guppylang.std.quantum import cx, h, measure, qubit, x, z

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

teleport.check()`,
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
from guppylang.std.quantum import qubit, h, cx, x, measure

@guppy
def deutsch_balanced(q: qubit, anc: qubit) -> tuple[qubit, qubit]:
    """Balanced oracle: f(x) = x."""
    cx(q, anc)
    return q, anc

@guppy
def deutsch(balanced: bool) -> bool:
    """Deutsch algorithm — single query determines oracle type.
    Returns True if balanced, False if constant.
    """
    q   = qubit()
    anc = qubit()

    h(q)
    x(anc)
    h(anc)

    if balanced:
        q, anc = deutsch_balanced(q, anc)

    h(q)
    result = measure(q)
    _ = measure(anc)
    return result

deutsch.check()`,
  },
  {
    id: 'ghz',
    title: 'GHZ State',
    description: 'Prepare an n-qubit GHZ state: all qubits perfectly correlated.',
    tags: ['entanglement', 'arrays', 'intermediate'],
    group: 'Fundamentals',
    qubit_count: 5,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.builtins import array, result
from guppylang.std.quantum import qubit, h, cx, measure_array

@guppy
def ghz() -> None:
    """Prepares a 5-qubit GHZ state: (|00000⟩ + |11111⟩)/√2

    All qubits are perfectly correlated — either all 0 or all 1.
    """
    qubits = array(qubit() for _ in range(5))

    h(qubits[0])
    for i in range(4):
        cx(qubits[i], qubits[i + 1])

    ms = measure_array(qubits)
    result("measurements", ms)

ghz.check()`,
  },
  {
    id: 'rus',
    title: 'Repeat-Until-Success',
    description: 'Probabilistic gate synthesis using mid-circuit measurement and feedforward.',
    tags: ['feedforward', 'loops', 'advanced'],
    group: 'Algorithms',
    qubit_count: 3,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.builtins import result
from guppylang.std.quantum import qubit, h, s, z, toffoli, measure
from guppylang.std.quantum.functional import h as hf

@guppy
def repeat_until_success(q: qubit, attempts: int) -> bool:
    """Repeat-until-success circuit for Rz(acos(3/5)).

    From Nielsen & Chuang, Fig. 4.17.
    Demonstrates Guppy's measurement-dependent control flow —
    essential for fault-tolerant quantum programs.
    """
    for i in range(attempts):
        a = hf(qubit())
        b = hf(qubit())
        toffoli(a, b, q)
        s(q)
        toffoli(a, b, q)
        if not (measure(a) | measure(b)):
            result("attempts", i + 1)
            return True
        z(q)
    result("attempts", attempts)
    return False

repeat_until_success.check()`,
  },
  {
    id: 'qec',
    title: 'Bit Flip Code',
    description: 'Three-qubit repetition code with syndrome measurement and correction.',
    tags: ['error-correction', 'syndromes', 'advanced'],
    group: 'Error Correction',
    qubit_count: 5,
    default_shots: 1024,
    source: `from guppylang import guppy
from guppylang.std.quantum import qubit, cx, x, measure

@guppy
def encode(logical: qubit) -> tuple[qubit, qubit, qubit]:
    """Encode one logical qubit into three physical qubits."""
    a = qubit()
    b = qubit()
    cx(logical, a)
    cx(logical, b)
    return logical, a, b

@guppy
def syndrome_measure(q0: qubit, q1: qubit, q2: qubit) -> tuple[bool, bool]:
    """Measure syndromes without disturbing logical information."""
    anc0, anc1 = qubit(), qubit()
    cx(q0, anc0); cx(q1, anc0)
    cx(q1, anc1); cx(q2, anc1)
    return measure(anc0), measure(anc1)

@guppy
def correct(q0: qubit, q1: qubit, q2: qubit) -> None:
    """Detect and correct single bit-flip errors."""
    s0, s1 = syndrome_measure(q0, q1, q2)
    if s0 and not s1:
        x(q0)
    if s0 and s1:
        x(q1)
    if not s0 and s1:
        x(q2)

correct.check()`,
  },
];
