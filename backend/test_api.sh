#!/usr/bin/env bash
# Quick manual API test script
# Usage: bash backend/test_api.sh [host]
# Default host: http://localhost:8000

HOST="${1:-http://localhost:8000}"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); }
header() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

# ── Health ─────────────────────────────────────────────────────────────────
header "GET /health"
HEALTH=$(curl -sf "$HOST/health")
if [ $? -eq 0 ]; then
  echo "$HEALTH" | python3 -m json.tool
  GUPPY_VER=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['guppylang_version'])")
  pass "health OK — guppylang $GUPPY_VER"
else
  fail "health endpoint unreachable — is the backend running?"
  echo "  Try: docker compose up backend"
  exit 1
fi

# ── Examples ───────────────────────────────────────────────────────────────
header "GET /examples"
EXAMPLES=$(curl -sf "$HOST/examples")
COUNT=$(echo "$EXAMPLES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['examples']))")
pass "examples OK — $COUNT examples returned"

# ── Run: Bell pair (stabilizer) ────────────────────────────────────────────
header "POST /run — Bell pair (stabilizer)"
BELL_SOURCE='from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure
from guppylang.std.builtins import result as guppy_result

@guppy
def bell() -> None:
    q0 = qubit()
    q1 = qubit()
    h(q0)
    cx(q0, q1)
    guppy_result("m0", measure(q0))
    guppy_result("m1", measure(q1))

bell.check()
'

BELL_RESP=$(curl -sf -X POST "$HOST/run" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "
import json, sys
print(json.dumps({
  'source': open('/dev/stdin').read(),
  'shots': 256,
  'simulator': 'stabilizer',
  'seed': 42
}))
" <<< "$BELL_SOURCE")")

STATUS=$(echo "$BELL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [ "$STATUS" = "ok" ]; then
  COUNTS=$(echo "$BELL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['results']['counts'])")
  NODES=$(echo "$BELL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['compile']['node_count'])")
  pass "Bell pair OK — counts=$COUNTS  nodes=$NODES"
else
  ERRORS=$(echo "$BELL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errors') or d.get('message'))")
  fail "Bell pair FAILED — status=$STATUS  errors=$ERRORS"
fi

# ── Run: Bell pair (statevector) ───────────────────────────────────────────
header "POST /run — Bell pair (statevector)"
SV_RESP=$(curl -sf -X POST "$HOST/run" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "
import json
print(json.dumps({
  'source': '''from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure
from guppylang.std.builtins import result as guppy_result

@guppy
def bell() -> None:
    q0 = qubit()
    q1 = qubit()
    h(q0)
    cx(q0, q1)
    guppy_result(\"m0\", measure(q0))
    guppy_result(\"m1\", measure(q1))

bell.check()
''',
  'shots': 128,
  'simulator': 'statevector',
  'seed': 7
}))
")")

SV_STATUS=$(echo "$SV_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [ "$SV_STATUS" = "ok" ]; then
  SV_COUNTS=$(echo "$SV_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['results']['counts'])")
  pass "statevector OK — counts=$SV_COUNTS"
else
  SV_ERR=$(echo "$SV_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errors') or d.get('message'))")
  fail "statevector FAILED — $SV_ERR"
fi

# ── Run: compile error ─────────────────────────────────────────────────────
header "POST /run — syntax error (should return compile_error)"
ERR_RESP=$(curl -sf -X POST "$HOST/run" \
  -H "Content-Type: application/json" \
  -d '{"source": "this is not valid python @@@", "shots": 64, "simulator": "stabilizer"}')

ERR_STATUS=$(echo "$ERR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [ "$ERR_STATUS" = "compile_error" ]; then
  ERR_MSG=$(echo "$ERR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['errors'][0]['message'])")
  pass "compile_error OK — \"$ERR_MSG\""
else
  fail "expected compile_error, got $ERR_STATUS"
fi

# ── Run: linearity error ───────────────────────────────────────────────────
header "POST /run — linearity error (double-measure)"
LIN_RESP=$(curl -sf -X POST "$HOST/run" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "
import json
print(json.dumps({
  'source': '''from guppylang import guppy
from guppylang.std.quantum import qubit, measure

@guppy
def bad() -> None:
    q = qubit()
    measure(q)
    measure(q)

bad.check()
''',
  'shots': 64,
  'simulator': 'stabilizer'
}))
")")

LIN_STATUS=$(echo "$LIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [ "$LIN_STATUS" = "compile_error" ]; then
  LIN_KIND=$(echo "$LIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['errors'][0]['kind'])")
  LIN_MSG=$(echo "$LIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['errors'][0]['message'])")
  pass "linearity_error OK — kind=$LIN_KIND  \"$LIN_MSG\""
else
  fail "expected compile_error, got $LIN_STATUS"
fi

# ── Validation: shots > 8192 ───────────────────────────────────────────────
header "POST /run — shots=99999 (should return HTTP 422)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HOST/run" \
  -H "Content-Type: application/json" \
  -d '{"source": "x", "shots": 99999, "simulator": "stabilizer"}')

if [ "$HTTP_CODE" = "422" ]; then
  pass "validation OK — HTTP 422 for shots=99999"
else
  fail "expected HTTP 422, got $HTTP_CODE"
fi

# ── OpenAPI docs ───────────────────────────────────────────────────────────
header "GET /docs (OpenAPI)"
DOCS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HOST/docs")
if [ "$DOCS_CODE" = "200" ]; then
  pass "docs OK — visit $HOST/docs in your browser"
else
  fail "docs returned HTTP $DOCS_CODE"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All $TOTAL tests passed${NC}"
else
  echo -e "${RED}$FAIL/$TOTAL tests failed${NC}"
  exit 1
fi
