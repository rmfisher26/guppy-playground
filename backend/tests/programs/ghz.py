from guppylang import guppy
from guppylang.std.builtins import array, result
from guppylang.std.quantum import qubit, h, cx, measure_array

@guppy
def main() -> None:
    qubits = array(qubit() for _ in range(5))
    h(qubits[0])
    for i in range(4):
        cx(qubits[i], qubits[i + 1])
    ms = measure_array(qubits)
    result("q", ms)

main.check()
