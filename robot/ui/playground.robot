*** Settings ***
Documentation     Browser E2E smoke suite — proves the deployed frontend loads, talks to
...               the deployed backend, and drives the core Run/Compile workflow. Not a
...               full UI regression suite: noise sliders, share links, mobile layout,
...               and theming are deliberately out of scope for this pass.
Resource          ../resources/ui.resource
Suite Setup       Open Playground
Suite Teardown    Close Playground

*** Test Cases ***
Playground Loads With Editor And Toolbar Visible
    [Documentation]    Proves the frontend served and successfully fetched /examples and
    ...                /versions from the backend on load.
    Wait For Elements State    ${EDITOR_CONTENT}    visible

Selecting A Sidebar Example Loads It Into The Editor
    Select Sidebar Example    bell
    Wait For Elements State    ${EDITOR_CONTENT}    visible
    ${text} =    Get Text    ${EDITOR_CONTENT}
    Should Contain    ${text}    def main

Running A Program Produces Results
    Select Sidebar Example    bell
    Click Primary Action
    Wait For Run Status    success    timeout=90s
    Wait For Elements State    css=[data-testid="results-tab"]    visible
    Element Should Not Be Visible    css=[data-testid="results-empty"]

Running A Broken Program Reports A Compile Error
    Type Program Into Workspace    this is not valid python @@@@
    Click Primary Action
    Wait For Run Status    compile_error    timeout=90s
    ${output} =    Get Text    css=[data-testid="terminal-output"]
    Should Not Be Empty    ${output}

Compiling A Program Switches To The Hugr Tab
    [Documentation]    compile() reports client-side status "success" on a successful
    ...                compile (the backend's compile_only response still has
    ...                status "ok" — "check_ok" is only for check()) and auto-switches
    ...                the active tab to HUGR.
    ${source} =    Load Program    bell_pair
    Type Program Into Workspace    ${source}
    Select Toolbar Action    compile
    Click Primary Action
    Wait For Run Status    success    timeout=90s
    Wait For Elements State    css=[data-testid="output-tab-hugr"]    visible
