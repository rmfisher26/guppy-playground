import selene_sim
from guppylang import guppy
from guppylang.std.quantum import qubit, h, measure
from guppylang.std.builtins import result

@guppy
def main() -> None:
    q = qubit()
    h(q)
    result("m", measure(q))

# Leakage: qubit can escape to a third |2⟩ state on single-qubit gates
leakage = selene_sim.SimpleLeakageErrorModel(
    p_leak=0.01,               # 1% chance of leaking on any 1Q gate
    leak_measurement_bias=0.5, # leaked qubit reads as 0 or 1 with this bias
)

r = (main.emulator(n_qubits=1)
    .with_shots(512)
    .with_seed(1)
    .with_error_model(leakage)
    .stabilizer_sim()
    .run())
