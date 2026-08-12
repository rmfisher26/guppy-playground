*** Settings ***
Documentation     Shared setup and Playground page-object-style keywords for the browser
...               E2E suite. Uses the Browser library (Playwright-based) against a real
...               running frontend (${BASE_URL}), talking to a real backend (${API_URL}).
Library           Browser
Resource          programs.resource
Variables         ../variables/common.yaml

*** Variables ***
${EDITOR_CONTENT}    css=[data-testid="guppy-editor"] .cm-content

*** Keywords ***
Open Playground
    New Browser    chromium    headless=True
    New Context
    New Page    ${BASE_URL}
    Wait For Elements State    css=[data-testid="guppy-editor"]    visible
    Wait For Elements State    css=[data-testid="toolbar-primary-action"]    visible

Close Playground
    Close Browser

Select Sidebar Example
    [Documentation]    ${example_id} must match an id from backend/app/examples_data.py
    ...                (e.g. "bell"), not a backend/tests/programs/ filename stem.
    [Arguments]    ${example_id}
    Click    css=[data-testid="example-item-${example_id}"]

Select Workspace
    Click    css=[data-testid="sidebar-workspace-item"]

Type Program Into Workspace
    [Documentation]    Replaces the editor's full contents with ${source}. CodeMirror is a
    ...                contenteditable, not an <input>, so this can't use Fill Text.
    [Arguments]    ${source}
    Select Workspace
    Click    ${EDITOR_CONTENT}
    Press Keys    ${EDITOR_CONTENT}    Control+a
    Press Keys    ${EDITOR_CONTENT}    Delete
    Type Text    ${EDITOR_CONTENT}    ${source}

Select Toolbar Action
    [Documentation]    Switches the toolbar's primary split-button mode without running it.
    ...                ${action} is one of: run, compile, check.
    [Arguments]    ${action}
    Click    css=[data-testid="toolbar-action-menu-toggle"]
    Click    css=[data-testid="toolbar-action-${action}"]

Click Primary Action
    Click    css=[data-testid="toolbar-primary-action"]

Wait For Run Status
    [Arguments]    ${status}    ${timeout}=60s
    Wait For Elements State
    ...    css=[data-testid="run-status"][data-status="${status}"]
    ...    visible
    ...    timeout=${timeout}
