// Default source shown when the playground first loads (no share link, no example selected).
// Gives developers a clean, runnable starting point without needing to pick an example.
export const DEFAULT_SOURCE = `from guppylang import guppy
from guppylang.std.quantum import qubit, measure
from guppylang.std.builtins import result

@guppy
def main() -> None:
    # Allocate a qubit and measure
    q = qubit()
    result("m", measure(q))
`;
