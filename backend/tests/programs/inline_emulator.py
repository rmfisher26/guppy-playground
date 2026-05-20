from guppylang import guppy
from guppylang.std.builtins import result
from guppylang.std.quantum import qubit, measure

@guppy
def main() -> None:
    result("c", measure(qubit()))

res = main.emulator(n_qubits=1).with_shots(256).with_seed(7).run()
