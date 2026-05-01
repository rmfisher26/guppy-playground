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
    id: 'rus',
    title: 'Repeat-Until-Success',
    description: 'Probabilistic gate synthesis using mid-circuit measurement and feedforward.',
    tags: ['feedforward', 'loops', 'advanced'],
    group: 'Algorithms',
    qubit_count: 3,
    default_shots: 256,
    source: `from guppylang import guppy
from guppylang.std.builtins import result
from guppylang.std.quantum import qubit, h, s, z, toffoli, measure
from guppylang.std.quantum.functional import h as hf

@guppy
def repeat_until_success(q: qubit, attempts: int) -> bool:
    """Repeat-until-success circuit for Rz(acos(3/5)).

    From Nielsen & Chuang, Fig. 4.17.
    Demonstrates measurement-dependent control flow —
    essential for fault-tolerant quantum programs.
    Succeeds with probability 5/8 per attempt.
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

@guppy
def main() -> None:
    """Run RUS — automatically uses Statevector simulator (non-Clifford gates)."""
    q = qubit()
    succeeded = repeat_until_success(q, 10)
    result("success", succeeded)
    result("final", measure(q))

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
];
