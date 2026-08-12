*** Settings ***
Documentation     Shared Guppy source fixtures, reused by both the API and UI suites.
...               These read from backend/tests/programs/ rather than duplicating source
...               strings here — that directory is also used by the pytest suite
...               (see backend/tests/conftest.py's `load_program` fixture). If it moves,
...               update PROGRAMS_DIR below.
Library           OperatingSystem

*** Variables ***
${PROGRAMS_DIR}    ${CURDIR}/../../backend/tests/programs

*** Keywords ***
Load Program
    [Documentation]    Read a Guppy source file by stem name, e.g. "bell_pair" -> bell_pair.py
    [Arguments]    ${name}
    ${source} =    OperatingSystem.Get File    ${PROGRAMS_DIR}/${name}.py
    RETURN    ${source}
