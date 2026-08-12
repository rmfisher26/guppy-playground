*** Settings ***
Resource          ../resources/api.resource
Suite Setup       Create Backend Session

*** Test Cases ***
Examples List Is Non Empty And Well Formed
    ${resp} =    GET On Session    backend    /examples
    Should Be Equal As Integers    ${resp.status_code}    200
    ${examples} =    Set Variable    ${resp.json()}[examples]
    Should Not Be Empty    ${examples}
    ${first} =    Set Variable    ${examples}[0]
    Dictionary Should Contain Key    ${first}    id
    Dictionary Should Contain Key    ${first}    title
    Dictionary Should Contain Key    ${first}    source

Versions Lists A Default That Is Actually Available
    ${resp} =    GET On Session    backend    /versions
    Should Be Equal As Integers    ${resp.status_code}    200
    ${data} =    Set Variable    ${resp.json()}
    List Should Contain Value    ${data}[versions]    ${data}[default_version]
