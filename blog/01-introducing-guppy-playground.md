# Introducing Guppy Playground: A Browser-Based Quantum IDE

*Posted on guppyfisher.dev*

---

I built a thing. You can try it right now at [pond.guppyfisher.dev](https://pond.guppyfisher.dev) — no install, no account, just open a browser and write quantum programs.

## What Is It?

Guppy Playground is a browser-based IDE for writing and running [Guppy](https://github.com/Quantinuum/guppylang) quantum programs. You write Python-style code in the editor on the left, hit `Ctrl+Enter` (or the Run button), and within a second or two you see your measurement results, a histogram of shot outcomes, and even a visualization of the compiled quantum graph.

It's the fastest way to get hands-on with Guppy without setting up a local Python environment.

## What Is Guppy?

Guppy is a quantum programming language from Quantinuum that embeds directly into Python. You decorate ordinary Python functions with `@guppy` and the library compiles them to a low-level quantum intermediate representation called [HUGR](https://github.com/CQCL/hugr) (Higher-order Unified Graph Representation). From there a simulator — in our case [Selene](https://github.com/Quantinuum/selene) — can execute your circuit.

Here's a classic example, the Bell pair:

```python
from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure
from guppylang.std.builtins import result as guppy_result

@guppy
def main() -> None:
    q0 = qubit()
    q1 = qubit()
    h(q0)        # Superposition
    cx(q0, q1)   # Entangle
    guppy_result("m0", measure(q0))
    guppy_result("m1", measure(q1))

main.check()
```

Run this with 1024 shots and you'll see `00` and `11` split roughly 50/50 — the hallmark of an entangled Bell state. No environment setup needed; just open the playground and click Bell Pair from the sidebar.

## Why I Built It

I wanted a zero-friction way to experiment with Guppy and share examples without asking anyone to `pip install` anything. A playground lowers the barrier to entry: you can link someone to a specific program via the Share button and they can run it immediately in their browser.

It's also a project I genuinely wanted to exist. Quantum SDKs are often hard to install, depend on specific Python versions, and have opaque error messages. The playground surfaces compile errors inline in the editor with exact line numbers, shows you the HUGR graph structure, and lets you tweak simulator settings (shots, noise model, random seed) without touching any config files.

## What You Can Do Today

- **Write and run** Guppy programs entirely in the browser
- **Choose your simulator** — stabilizer (fast, any circuit) or statevector (exact amplitudes, up to 20 qubits)
- **Add noise** — apply a depolarizing noise model with a configurable per-gate error rate
- **Browse examples** — Bell pair, quantum teleportation, and more in the sidebar
- **Share programs** — the Share button encodes your source as a URL hash; paste it anywhere
- **See the HUGR** — inspect the compiled quantum graph node-by-node after a successful run
- **Pick a Guppy version** — the playground supports multiple pinned guppylang releases

## What's Coming

More examples, better HUGR visualization, and eventually a state-vector display showing you the full quantum amplitude distribution mid-circuit. I'll cover each of these in future posts.

For now, the best way to get a feel for it is to just open [pond.guppyfisher.dev](https://pond.guppyfisher.dev) and try changing a gate or two. The next post in this series is a gentle introduction to the quantum computing concepts behind the examples.
