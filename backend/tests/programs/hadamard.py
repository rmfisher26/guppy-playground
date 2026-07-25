from guppylang import guppy
from guppylang.std.quantum import qubit, h

@guppy
def hadamard(q: qubit) -> qubit:
    h(q)
    return q

pkg = hadamard.compile_function()
