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

# Realistic H-series approximate values
noise = selene_sim.DepolarizingErrorModel(
    p_1q=0.001,   # 0.1% single-qubit gate error
    p_2q=0.005,   # 0.5% two-qubit gate error
    p_meas=0.005, # 0.5% measurement error
    p_init=0.001, # 0.1% state preparation error
)

r = (main.emulator(n_qubits=2)
    .with_shots(1024)
    .with_seed(42)
    .with_error_model(noise)
    .statevector_sim()
    .run())
