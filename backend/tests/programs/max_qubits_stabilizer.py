from guppylang import guppy
from guppylang.std.builtins import array, result
from guppylang.std.quantum import qubit, h, measure_array

@guppy
def main() -> None:
    qs = array(qubit() for _ in range(50))
    for i in range(50):
        h(qs[i])
    ms = measure_array(qs)
    result("q", ms)
