from guppylang import guppy
from guppylang.std.builtins import result
from guppylang.std.quantum import qubit, h, cx, measure

@guppy
def main() -> None:
    q0 = qubit()
    q1 = qubit()
    h(q0)
    cx(q0, q1)
    result("m0", measure(q0))
    result("m1", measure(q1))

main.check()
