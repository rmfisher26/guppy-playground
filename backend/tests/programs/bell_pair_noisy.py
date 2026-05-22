import selene_sim
from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure
from guppylang.std.builtins import result

@guppy
def main() -> None:
    q0, q1 = qubit(), qubit()
    h(q0)
    cx(q0, q1)
    result("m0", measure(q0))
    result("m1", measure(q1))

# Ideal — only |00⟩ and |11⟩ appear
r_ideal = (main.emulator(n_qubits=2)
    .with_shots(512)
    .with_seed(42)
    .stabilizer_sim()
    .run())

# Noisy — error outcomes |01⟩ and |10⟩ appear
noise = selene_sim.DepolarizingErrorModel(
    p_2q=0.05,    # 5% two-qubit gate error
    p_meas=0.02,  # 2% measurement error
)
r_noisy = (main.emulator(n_qubits=2)
    .with_shots(512)
    .with_seed(42)
    .with_error_model(noise)
    .stabilizer_sim()
    .run())
