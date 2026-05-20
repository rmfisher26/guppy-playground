from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure

@guppy
def main() -> tuple[bool, bool]:
    q0 = qubit()
    q1 = qubit()
    h(q0)
    cx(q0, q1)
    return measure(q0), measure(q1)

main.check()
