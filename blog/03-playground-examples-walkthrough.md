# Walking Through the Playground Examples

*Posted on guppyfisher.dev*

---

The sidebar in [pond.guppyfisher.dev](https://pond.guppyfisher.dev) ships with a set of built-in examples. This post walks through each one, explains what it demonstrates, and tells you what to look for when you run it.

All of these are runnable right now — no setup needed. Open the playground, select an example from the sidebar, and hit `Ctrl+Enter`.

---

## Bell Pair

**Tags:** entanglement, beginner · **Qubits:** 2

```python
@guppy
def main() -> None:
    q0 = qubit()
    q1 = qubit()
    h(q0)
    cx(q0, q1)
    guppy_result("m0", measure(q0))
    guppy_result("m1", measure(q1))
```

This is the canonical quantum hello world. The Hadamard gate puts `q0` into superposition, then the CNOT entangles `q1` to it.

**What to look for:** Two bars in the histogram — `00` and `11` — each around 50%. You should almost never see `01` or `10`. If you do, they're statistical noise, and they disappear as you increase the shot count.

**Try this:** Change `h(q0)` to `x(q0)` — a NOT gate instead of a Hadamard. Now q0 starts in state `|1⟩` instead of superposition. The CNOT flips q1 unconditionally, so you'll get `11` 100% of the time.

---

## Quantum Teleportation

**Tags:** teleportation, feedforward, intermediate · **Qubits:** 3

```python
@guppy
def teleport(src: qubit @ owned, tgt: qubit) -> None:
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
    src = qubit()
    tgt = qubit()
    h(src)
    teleport(src, tgt)
    guppy_result("tgt", measure(tgt))
```

Teleportation is the protocol that transmits a quantum state using an entangled pair and two classical bits of feedforward. `src` is prepared in `|+⟩` (a 50/50 superposition) and teleported to `tgt`. No qubit physically moves — the state does.

The `@ owned` annotation on `src` enforces the no-cloning theorem at compile time. You're giving up ownership of `src` when you call `teleport`, and inside the function it gets consumed by measurement.

The `if measure(...)` branches are classical feedforward corrections. Depending on what the intermediate measurements yield, we apply `z` or `x` to restore the target state.

**What to look for:** `tgt` should measure 0 and 1 with roughly equal probability — because we teleported a `|+⟩` state, which is a 50/50 superposition.

**Try this:** Remove the `h(src)` line so `src` starts in `|0⟩`. Now the teleported state is just `|0⟩` and `tgt` should always measure 0.

---

## What the Simulator Backends Mean

Each example can be run with either of two simulators, selectable in the toolbar:

**Stabilizer (default):** Fast Clifford simulator. Works with any circuit built from H, CNOT, S, and Pauli gates. All the examples above use only Clifford gates, so stabilizer is the right choice.

**Statevector:** Exact simulation that tracks the full amplitude vector. Scales exponentially with qubit count — capped at 20 qubits in the playground. Use this when you want exact probabilities or when your circuit includes non-Clifford gates like T.

---

## Noise Models

The playground supports a **depolarizing noise model** — accessible via the toolbar. With noise enabled, each gate has a small probability (default 0.1%) of randomly applying one of the Pauli operators `X`, `Y`, or `Z` to a qubit.

On the Bell Pair with 1024 shots and noise enabled, you'll start to see `01` and `10` outcomes appearing in the histogram. Crank the error rate up to 5% and the entanglement degrades visibly — the four bars converge toward 25% each, which is what a fully random (maximally mixed) state looks like.

This is useful for building intuition about error rates in real quantum hardware.

---

## Using the Share Button

Every time you modify the code in the editor you can share it via the **Share** button in the toolbar. It encodes the full source as a base64 URL hash — no server involved, the state lives entirely in the URL. Paste it in Slack, a GitHub issue, or a blog post, and the recipient opens the playground with your exact program loaded.

---

## Next Post

The next post goes under the hood: how the playground actually compiles and runs your code, the sandboxed subprocess architecture, and why memory limits are tricky when numpy is involved.
