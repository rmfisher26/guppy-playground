*** Settings ***
Documentation     Deliberately not a full port of backend/tests/test_routes.py's matrix
...               (noise models, all error kinds, seed reproducibility, versioning stay
...               pytest's job) — this proves the deployed container serves correct
...               real-HTTP responses for the primary happy/error paths.
Resource          ../resources/api.resource
Suite Setup       Create Backend Session

*** Test Cases ***
Run Bell Pair On Stabilizer Simulator Returns Ok
    ${source} =    Load Program    bell_pair
    &{payload} =    Create Dictionary    source=${source}    shots=${256}    simulator=stabilizer    seed=${42}
    ${resp} =    POST On Session    backend    /run    json=${payload}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${data} =    Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${data}[status]    ok
    ${total} =    Evaluate    sum($data['results']['counts'].values())
    Should Be Equal As Integers    ${total}    256

Check Only Returns Check Ok Without Simulating
    ${source} =    Load Program    bell_pair
    &{payload} =    Create Dictionary    source=${source}    shots=${64}    simulator=stabilizer    check_only=${True}
    ${resp} =    POST On Session    backend    /run    json=${payload}
    Should Be Equal As Integers    ${resp.status_code}    200
    Should Be Equal As Strings    ${resp.json()}[status]    check_ok

Compile Only Returns Compile Output Without Results
    ${source} =    Load Program    bell_pair
    &{payload} =    Create Dictionary    source=${source}    shots=${64}    simulator=stabilizer    compile_only=${True}
    ${resp} =    POST On Session    backend    /run    json=${payload}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${data} =    Set Variable    ${resp.json()}
    Should Not Be Equal    ${data}[compile]    ${None}
    Should Be Equal    ${data}[results]    ${None}

Syntactically Invalid Source Returns Compile Error
    &{payload} =    Create Dictionary    source=this is not valid python @@@@    shots=${64}    simulator=stabilizer
    ${resp} =    POST On Session    backend    /run    json=${payload}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${data} =    Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${data}[status]    compile_error
    Should Not Be Empty    ${data}[errors]

Run Ghz On Statevector Simulator Returns Ok
    [Documentation]    Exercises the second simulator backend (QuEST) over real HTTP —
    ...                catches container/dependency issues the in-process pytest suite
    ...                wouldn't need to, but this deployed-stack suite should.
    ${source} =    Load Program    ghz
    &{payload} =    Create Dictionary    source=${source}    shots=${64}    simulator=statevector    seed=${1}
    ${resp} =    POST On Session    backend    /run    json=${payload}
    Should Be Equal As Integers    ${resp.status_code}    200
    Should Be Equal As Strings    ${resp.json()}[status]    ok
