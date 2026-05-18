# Quantum Computing for Developers: What You Need to Know to Use Guppy

*Posted on guppyfisher.dev*

---

You don't need a physics degree to write quantum programs. You do need to rewire a few intuitions. This post covers exactly the concepts that matter for writing and understanding Guppy code — nothing more, nothing less.

If you've already seen `|0⟩` and `|1⟩` in a tutorial and immediately closed the tab, this one is for you.

## The Core Idea in One Sentence

A qubit is a value that exists in a superposition of 0 and 1 simultaneously — until you measure it, at which point it collapses to a definite 0 or 1.

That's it. Everything else — entanglement, interference, teleportation — is a consequence of that.

## Qubits vs Bits

A classical bit holds either 0 or 1. A qubit holds a probability distribution over 0 and 1, encoded as a pair of complex numbers (called amplitudes). When you measure the qubit you get a 0 or a 1 with probabilities determined by those amplitudes, and the qubit is consumed by the measurement — you can't peek and put it back.

This is why measurement in Guppy is a consuming operation:

```python
result = measure(q)  # q is gone after this
```

## The Gates

Quantum operations are called gates. They're analogous to logic gates (AND, OR, NOT) except they're reversible — every gate has an inverse. The most common ones you'll see in Guppy:

| Gate | What it does |
|------|-------------|
| `h(q)` | Hadamard — puts q into equal superposition of 0 and 1 |
| `x(q)` | Pauli-X — the quantum NOT gate, flips 0↔1 |
| `z(q)` | Pauli-Z — flips the phase (invisible to measurement, but matters for interference) |
| `cx(control, target)` | CNOT — flips target if and only if control is 1 |

The Hadamard gate is the one that creates superposition. The CNOT gate is the one that creates entanglement. You only need these two to understand every example in the playground.

## Entanglement

Two qubits are entangled when their states are correlated in a way that can't be explained by each qubit independently carrying some hidden value. The Bell pair from the playground is the simplest example:

```python
h(q0)        # q0 is now |+⟩ = (|0⟩ + |1⟩)/√2
cx(q0, q1)   # if q0 is 1, flip q1
```

After this, measuring q0 and q1 always gives the same result: both 0 or both 1, with 50% probability each. The histogram in the playground shows exactly this — two bars, one at `00` and one at `11`.

## Shots

Quantum computation is probabilistic. A single run gives you one sample from the output distribution. To estimate the full distribution you run the same circuit many times — these are called *shots*. The playground default is 1024 shots. The resulting measurement counts are what get plotted in the results histogram.

## Linear Types: Why You Can't Clone a Qubit

Guppy enforces the *no-cloning theorem* at compile time using a type system feature called linear types. A qubit must be used exactly once — you can't copy it, and you can't drop it without measuring it.

This is why the `owned` annotation appears in the teleportation example:

```python
def teleport(src: qubit @ owned, tgt: qubit) -> None:
```

The `@ owned` means this function takes full ownership of `src`. Once inside the function, `src` must be consumed (measured or passed to another owned function). Try deleting the measurement and the compiler catches it as a linearity error — the playground highlights the exact line.

This compile-time enforcement is one of the things that makes Guppy interesting as a language design: quantum correctness constraints that are usually checked by hand are caught automatically.

## What's HUGR?

When Guppy compiles your `@guppy` function, the output is a HUGR — a Higher-order Unified Graph Representation. It's a directed graph where nodes are quantum operations (gates, measurements, function calls) and edges are the qubit and classical data flows between them.

The HUGR tab in the playground shows you this graph flattened into a node list after a successful run. It's mostly useful for debugging or understanding what the compiler produced, but it also gives a sense of the operation count and circuit depth before the circuit ever touches a simulator.

## Next Steps

The best way to build intuition is to experiment. Open [pond.guppyfisher.dev](https://pond.guppyfisher.dev), load the Bell Pair example, and change `h(q0)` to `x(q0)`. Re-run it. What happens to the histogram and why?

The next post walks through the examples in the playground one by one — Bell pair, quantum teleportation, and more — explaining what each one demonstrates and what to look for in the output.
