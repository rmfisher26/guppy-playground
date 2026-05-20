from guppylang import guppy
from guppylang.std.builtins import result
from guppylang.std.quantum import qubit, h, measure

@guppy
def coin_flip() -> None:
    q = qubit()
    h(q)
    result("bit", measure(q))

pkg = coin_flip.compile()         # returns hugr.package.Package
print(type(pkg))                  # <class 'hugr.package.Package'>

raw_bytes = pkg.to_bytes()        # serialize to bytes for transport/storage
print(f"HUGR package: {len(raw_bytes)} bytes")
