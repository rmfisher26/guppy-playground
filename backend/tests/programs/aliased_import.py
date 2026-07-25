from guppylang import guppy
from guppylang.std.quantum import qubit, measure
from guppylang.std.builtins import result as guppy_result

@guppy
def test() -> None:
    q = qubit()
    guppy_result("m", measure(q))

test.check()
