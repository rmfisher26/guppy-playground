from guppylang import guppy
from guppylang.std.builtins import owned
from guppylang.std.quantum import qubit, h, cx, measure, x, z

@guppy
def teleport(src: qubit @ owned, tgt: qubit) -> None:
    tmp = qubit()
    h(tmp)
    cx(tmp, tgt)
    cx(src, tmp)
    h(src)
    if measure(src):
        z(tgt)
    if measure(tmp):
        x(tgt)

teleport.check()   # raises GuppyError on type or linearity violations, returns None on success
print("Type-check passed")
