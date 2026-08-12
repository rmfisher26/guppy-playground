*** Settings ***
Documentation     Smoke test — also acts as the "is the stack even up" canary for the
...               rest of the API suite.
Resource          ../resources/api.resource
Suite Setup       Create Backend Session

*** Test Cases ***
Health Endpoint Reports Ok
    ${resp} =    GET On Session    backend    /health
    Should Be Equal As Integers    ${resp.status_code}    200
    ${data} =    Set Variable    ${resp.json()}
    Should Contain    ${{['ok', 'degraded']}}    ${data}[status]
    Should Not Be Empty    ${data}[guppylang_version]
    Should Not Be Empty    ${data}[selene_version]
    Should Be True    ${data}[uptime_seconds] >= 0
