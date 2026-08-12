*** Settings ***
Documentation     Shared setup for the backend API acceptance suite.
...
...               Deliberately uses RequestsLibrary against a real running server
...               (${API_URL}) rather than FastAPI's in-process TestClient (which is what
...               backend/tests/ uses). That's the point of this suite: it exercises the
...               deployed container over real HTTP — container startup, CORS, networking,
...               wire serialization — not just the route handler logic. Do not "fix" this
...               by swapping in TestClient.
Library           RequestsLibrary
Library           Collections
Resource          programs.resource
Variables         ../variables/common.yaml

*** Keywords ***
Create Backend Session
    RequestsLibrary.Create Session    backend    ${API_URL}
