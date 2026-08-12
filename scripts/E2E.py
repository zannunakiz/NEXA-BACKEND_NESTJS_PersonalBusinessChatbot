#!/usr/bin/env python3
import requests
import json
import time
import sys
import os
import base64
from datetime import datetime
from typing import Optional, Dict, List, Tuple

BASE_URL = "http://localhost:3000"
LOG_FILE = "E2E.log"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE1 = os.path.join(SCRIPT_DIR, "image1.png")
IMAGE2 = os.path.join(SCRIPT_DIR, "image2.png")

ts = int(time.time())
CUSTOMER_EMAIL = f"customer_{ts}@nuxa.ai"

USERS = {
    "owner": {"email": f"owner_{ts}@nuxa.ai", "username": f"owner_{ts}", "password": "SecurePass123!"},
    "admin": {"email": f"admin_{ts}@nuxa.ai", "username": f"admin_{ts}", "password": "SecurePass123!"},
    "memberA": {"email": f"membera_{ts}@nuxa.ai", "username": f"membera_{ts}", "password": "SecurePass123!"},
    "memberB": {"email": f"memberb_{ts}@nuxa.ai", "username": f"memberb_{ts}", "password": "SecurePass123!"},
    "outsider": {"email": f"outsider_{ts}@nuxa.ai", "username": f"outsider_{ts}", "password": "SecurePass123!"},
    "guest": {"email": f"guest_{ts}@nuxa.ai", "username": f"guest_{ts}", "password": "SecurePass123!"},
    "higher": {"email": f"higher_{ts}@nuxa.ai", "username": f"higher_{ts}", "password": "SecurePass123!"},
}

state = {
    "current": None,
    "accessToken": None,
    "tokens": {},
    "organizationId": None,
    "adminMemberId": None,
    "memberAMemberId": None,
    "memberBMemberId": None,
    "botAId": None,
    "botBId": None,
    "botCId": None,
    "characteristicAId": None,
    "characteristicBId": None,
    "sessionId": None,
    "memberIds": {},
}

step_results: List[Tuple[int, str, bool, bool, bool]] = []

MINI_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def ensure_image(path: str) -> None:
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(base64.b64decode(MINI_PNG))
        print(f"Created placeholder image: {path}")


class Logger:
    def __init__(self, log_file=LOG_FILE):
        self.log_file = log_file
        with open(self.log_file, "w", encoding="utf-8") as f:
            f.write(f"=== NEXA Ultimate E2E Test Run: {datetime.now().isoformat()} ===\n\n")

    def file(self, msg: str, level: str = "INFO") -> None:
        ts_now = datetime.now().isoformat()
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(f"[{ts_now}] [{level}] {msg}\n")

    def line(self, text: str) -> None:
        print(text)
        self.file(text, "STEP")


logger = Logger()


def switch(name: str) -> None:
    state["current"] = name
    state["accessToken"] = state["tokens"].get(name)


def build_headers(json_content: bool = True) -> Dict:
    full_headers = {"Content-Type": "application/json"} if json_content else {}
    if state.get("accessToken"):
        full_headers["Authorization"] = f"Bearer {state['accessToken']}"
    return full_headers


def req(
    method: str,
    endpoint: str,
    json_body: Optional[Dict] = None,
) -> Tuple[Optional[Dict], int, bool]:
    url = f"{BASE_URL}{endpoint}"
    headers = build_headers()
    logger.file(f"Request: {method} {endpoint} (user={state.get('current')})")
    if json_body:
        logger.file(f"Body: {json.dumps(json_body, indent=2)}")
    try:
        resp = requests.request(method, url, headers=headers, json=json_body, timeout=30)
        status = resp.status_code
        ok = 200 <= status < 300
        logger.file(f"Response Status: {status}")
        try:
            resp_json = resp.json()
            logger.file(f"Response Body: {json.dumps(resp_json, indent=2)}")
        except Exception:
            resp_json = None
            logger.file(f"Response Body (non-JSON): {resp.text[:200]}")
        return resp_json, status, ok
    except Exception as e:
        logger.file(f"Request failed: {str(e)}")
        raise


def req_multipart(
    method: str,
    endpoint: str,
    fields: Optional[Dict] = None,
    file_path: Optional[str] = None,
) -> Tuple[Optional[Dict], int, bool]:
    url = f"{BASE_URL}{endpoint}"
    headers = build_headers(json_content=False)
    logger.file(f"Request (multipart): {method} {endpoint} (user={state.get('current')})")
    if fields:
        logger.file(f"Fields: {json.dumps(fields, indent=2)}")
    if file_path:
        logger.file(f"File: {file_path}")
    try:
        files = {}
        if file_path:
            files["image"] = (os.path.basename(file_path), open(file_path, "rb"), "image/png")
        resp = requests.request(method, url, headers=headers, data=fields, files=files, timeout=60)
        status = resp.status_code
        ok = 200 <= status < 300
        logger.file(f"Response Status: {status}")
        try:
            resp_json = resp.json()
            logger.file(f"Response Body: {json.dumps(resp_json, indent=2)}")
        except Exception:
            resp_json = None
            logger.file(f"Response Body (non-JSON): {resp.text[:200]}")
        return resp_json, status, ok
    except Exception as e:
        logger.file(f"Request failed: {str(e)}")
        raise


def extract_data(resp_json):
    if not resp_json:
        return None
    return resp_json.get("data", resp_json)


def register_user(name: str) -> bool:
    switch(name)
    creds = USERS[name]
    resp_json, status, ok = req(
        "POST",
        "/auth/register",
        json_body={"email": creds["email"], "username": creds["username"], "password": creds["password"]},
    )
    data = extract_data(resp_json)
    if ok and data and data.get("user", {}).get("id") and data.get("accessToken"):
        state["tokens"][name] = data["accessToken"]
        switch(name)
        return True
    return False


def login_user(name: str) -> bool:
    creds = USERS[name]
    switch(name)
    resp_json, status, ok = req(
        "POST",
        "/auth/login",
        json_body={"emailOrUsername": creds["username"], "password": creds["password"]},
    )
    data = extract_data(resp_json)
    if ok and data and data.get("accessToken"):
        state["tokens"][name] = data["accessToken"]
        switch(name)
        return True
    return False


def s(num: int, desc: str, expect: bool, actual: bool) -> bool:
    step_correct = actual == expect
    step_results.append((num, desc, expect, actual, step_correct))
    exp_s = "success" if expect else "fail"
    act_s = "success" if actual else "fail"
    match_s = "true" if step_correct else "false"
    logger.line(f"[step {num}][{desc}][expect: {exp_s}][result: {act_s}][match: {match_s}]")
    return step_correct


def critical(num: int, desc: str) -> None:
    s(num, desc, True, False)
    logger.line("Critical failure - stopping.")
    sys.exit(1)


def member_id(email: str):
    switch("owner")
    resp_json, _, _ = req("GET", f"/organization/{state['organizationId']}/members")
    data = extract_data(resp_json)
    if isinstance(data, list):
        for m in data:
            if m.get("email") == email:
                return m.get("id")
    return None


def main():
    ensure_image(IMAGE1)
    ensure_image(IMAGE2)
    logger.file("Starting NEXA Ultimate E2E test")
    logger.file(f"Customer email: {CUSTOMER_EMAIL}")

    switch("public")
    _, _, ok = req("GET", "/health")
    s(1, "Health check", True, ok)

    for name in ["owner", "admin", "memberA", "memberB", "outsider", "guest", "higher"]:
        num = {"owner": 2, "admin": 3, "memberA": 4, "memberB": 5, "outsider": 6, "guest": 7, "higher": 8}[name]
        ok = register_user(name)
        s(num, f"Register {name}", True, ok)
        if not ok:
            critical(num, f"Register {name}")

    switch("owner")
    creds = USERS["owner"]
    _, _, ok = req("POST", "/auth/register", json_body={"email": creds["email"], "username": creds["username"], "password": creds["password"]})
    s(9, "Register duplicate email blocked", False, ok)

    ok = login_user("owner")
    s(10, "Login owner", True, ok)

    switch("owner")
    _, _, ok = req("POST", "/auth/login", json_body={"emailOrUsername": USERS["owner"]["username"], "password": "WrongPass!"})
    s(11, "Login wrong password blocked", False, ok)

    switch("public")
    _, _, ok = req("POST", "/auth/login", json_body={"emailOrUsername": "ghost_user", "password": "x"})
    s(12, "Login nonexistent user blocked", False, ok)

    switch("owner")
    _, _, ok = req("GET", "/auth/me")
    s(13, "Get my profile", True, ok)

    switch("public")
    _, _, ok = req("POST", "/auth/password-otp", json_body={"email": "notregistered@x.com"})
    s(14, "Password OTP for unknown email blocked", False, ok)

    switch("owner")
    resp_json, _, ok = req("POST", "/organization", json_body={"name": "NEXA E2E Org", "description": "ultimate e2e"})
    data = extract_data(resp_json)
    if ok and data and data.get("id"):
        state["organizationId"] = data["id"]
    s(15, "Owner create organization", True, ok)
    if not state["organizationId"]:
        critical(15, "Owner create organization")

    _, _, ok = req("GET", "/organization")
    s(16, "Owner list organizations", True, ok)

    _, _, ok = req("GET", f"/organization/{state['organizationId']}")
    s(17, "Owner get organization details", True, ok)

    switch("outsider")
    _, _, ok = req("GET", f"/organization/{state['organizationId']}")
    s(18, "Outsider get org details blocked", False, ok)

    switch("memberA")
    _, _, ok = req("GET", f"/organization/{state['organizationId']}")
    s(19, "Non-member get org details blocked", False, ok)

    switch("owner")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}", json_body={"name": "NEXA E2E Org V2"})
    s(20, "Owner update organization", True, ok)

    switch("memberA")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}", json_body={"name": "Hacked"})
    s(21, "Non-member update org blocked", False, ok)

    switch("owner")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["admin"]["email"], "role": "admin"})
    s(22, "Owner invite admin", True, ok)
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["memberA"]["email"], "role": "member"})
    s(23, "Owner invite memberA", True, ok)
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["memberB"]["email"], "role": "member"})
    s(24, "Owner invite memberB", True, ok)
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["guest"]["email"], "role": "owner"})
    s(25, "Invite role owner blocked", False, ok)
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": "ghost@x.com", "role": "member"})
    s(26, "Invite nonexistent email blocked", False, ok)

    switch("admin")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["guest"]["email"], "role": "member"})
    s(27, "Admin invite member", True, ok)
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["higher"]["email"], "role": "admin"})
    s(28, "Admin invite admin blocked", False, ok)
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["higher"]["email"], "role": "owner"})
    s(29, "Admin invite owner blocked", False, ok)

    switch("memberA")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["higher"]["email"], "role": "member"})
    s(30, "Member invite blocked", False, ok)

    switch("owner")
    state["memberIds"]["admin"] = member_id(USERS["admin"]["email"])
    state["memberIds"]["memberA"] = member_id(USERS["memberA"]["email"])
    state["memberIds"]["memberB"] = member_id(USERS["memberB"]["email"])
    _, _, ok = req("GET", f"/organization/{state['organizationId']}/members")
    s(31, "Owner list members", True, ok)

    _, _, ok = req("PUT", f"/organization/{state['organizationId']}/members/{state['memberIds']['memberB']}/role", json_body={"role": "admin"})
    s(32, "Owner promote memberB to admin", True, ok)
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}/members/{state['memberIds']['memberB']}/role", json_body={"role": "member"})
    s(33, "Owner demote memberB to member", True, ok)

    switch("memberA")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}/members/{state['memberIds']['memberB']}/role", json_body={"role": "admin"})
    s(34, "Member update role blocked", False, ok)

    switch("outsider")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}", json_body={"name": "Hack"})
    s(35, "Outsider update org blocked", False, ok)

    switch("memberB")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}", json_body={"name": "Hack"})
    s(36, "Member update org blocked", False, ok)

    switch("admin")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}", json_body={"name": "Hack"})
    s(37, "Admin update org blocked (owner only)", False, ok)

    switch("memberA")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/transfer-ownership", json_body={"newOwnerId": "some-id"})
    s(38, "Member transfer ownership blocked", False, ok)

    switch("outsider")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/leave")
    s(39, "Outsider leave blocked", False, ok)

    switch("memberA")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/leave")
    s(40, "Member leave organization", True, ok)

    switch("owner")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/members/invite", json_body={"email": USERS["memberA"]["email"], "role": "member"})
    s(41, "Owner re-invite memberA", True, ok)
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/leave")
    s(42, "Owner leave while members exist blocked", False, ok)

    switch("owner")
    resp_json, _, ok = req_multipart("POST", "/chatbot", fields={"organizationId": state["organizationId"], "name": "Bot A", "description": "bot a", "systemPrompt": "helpful", "welcomeMessage": "Hi"}, file_path=IMAGE1)
    data = extract_data(resp_json)
    if ok and data and data.get("id"):
        state["botAId"] = data["id"]
    s(43, "Owner create chatbot A with image", True, ok)
    if not state["botAId"]:
        critical(43, "Owner create chatbot A")

    resp_json, _, ok = req_multipart("POST", "/chatbot", fields={"organizationId": state["organizationId"], "name": "Bot B", "description": "bot b"})
    data = extract_data(resp_json)
    if ok and data and data.get("id"):
        state["botBId"] = data["id"]
    s(44, "Owner create chatbot B", True, ok)

    switch("admin")
    resp_json, _, ok = req_multipart("POST", "/chatbot", fields={"organizationId": state["organizationId"], "name": "Bot C", "description": "bot c"})
    data = extract_data(resp_json)
    if ok and data and data.get("id"):
        state["botCId"] = data["id"]
    s(45, "Admin create chatbot C", True, ok)

    _, _, ok = req("GET", f"/chatbot/org/{state['organizationId']}")
    s(46, "Admin list org chatbots", True, ok)

    switch("memberA")
    _, _, ok = req("GET", f"/chatbot/org/{state['organizationId']}")
    s(47, "Member list org chatbots", True, ok)

    _, _, ok = req_multipart("PUT", f"/chatbot/{state['botAId']}", fields={"name": "Bot A renamed by memberA"})
    s(48, "Member update chatbot A", True, ok)

    switch("memberB")
    _, _, ok = req_multipart("PUT", f"/chatbot/{state['botAId']}", fields={"description": "edited by memberB"})
    s(49, "Member update chatbot A picks", True, ok)

    switch("outsider")
    _, _, ok = req_multipart("PUT", f"/chatbot/{state['botAId']}", fields={"name": "Hack"})
    s(50, "Outsider update chatbot blocked", False, ok)

    _, _, ok = req_multipart("POST", "/chatbot", fields={"organizationId": state["organizationId"], "name": "Hack bot"})
    s(51, "Outsider create chatbot blocked", False, ok)

    _, _, ok = req("DELETE", f"/chatbot/{state['botBId']}")
    s(52, "Outsider delete chatbot blocked", False, ok)

    switch("admin")
    _, _, ok = req_multipart("PUT", f"/chatbot/{state['botAId']}", fields={"description": "new image"}, file_path=IMAGE2)
    s(53, "Admin update chatbot A image", True, ok)

    switch("owner")
    _, _, ok = req("GET", f"/chatbot/me/{state['organizationId']}")
    s(54, "Owner list my chatbots", True, ok)

    resp_json, _, ok = req("POST", f"/characteristic/{state['botAId']}", json_body={"type": "data", "title": "Opening hours", "description": "Open 10am-24pm"})
    data = extract_data(resp_json)
    if ok and data and data.get("id"):
        state["characteristicAId"] = data["id"]
    s(55, "Owner create characteristic data", True, ok)

    switch("memberA")
    _, _, ok = req("POST", f"/characteristic/{state['botAId']}", json_body={"type": "restrict", "title": "No pricing", "description": "Pricing is private"})
    s(56, "Member create characteristic restrict", True, ok)

    switch("admin")
    _, _, ok = req("GET", f"/characteristic/{state['botAId']}")
    s(57, "Admin list characteristics", True, ok)
    _, _, ok = req("GET", f"/characteristic/{state['botAId']}/{state['characteristicAId']}")
    s(58, "Admin get characteristic", True, ok)

    switch("outsider")
    _, _, ok = req("GET", f"/characteristic/{state['botAId']}")
    s(59, "Outsider list characteristics blocked", False, ok)
    _, _, ok = req("POST", f"/characteristic/{state['botAId']}", json_body={"type": "data", "title": "Hack"})
    s(60, "Outsider create characteristic blocked", False, ok)
    _, _, ok = req("PUT", f"/characteristic/{state['botAId']}/{state['characteristicAId']}", json_body={"description": "Hack"})
    s(61, "Outsider update characteristic blocked", False, ok)

    switch("memberB")
    _, _, ok = req("PUT", f"/characteristic/{state['botAId']}/{state['characteristicAId']}", json_body={"description": "Open 9am-24pm"})
    s(62, "Member update characteristic", True, ok)
    _, _, ok = req("PUT", f"/characteristic/{state['botAId']}/{state['characteristicAId']}", json_body={})
    s(63, "Empty characteristic update blocked", False, ok)

    switch("outsider")
    _, _, ok = req("DELETE", f"/characteristic/{state['botAId']}")
    s(64, "Outsider delete all characteristics blocked", False, ok)

    switch("memberB")
    _, _, ok = req("DELETE", f"/characteristic/{state['botAId']}/{state['characteristicAId']}")
    s(65, "Member delete characteristic", True, ok)

    switch("public")
    resp_json, _, ok = req("POST", f"/session/{state['botAId']}", json_body={"email": CUSTOMER_EMAIL})
    data = extract_data(resp_json)
    if ok and data and data.get("session", {}).get("id"):
        state["sessionId"] = data["session"]["id"]
    s(66, "Customer create session (new)", True, ok)

    resp_json, _, ok = req("POST", f"/session/{state['botAId']}", json_body={"email": CUSTOMER_EMAIL})
    data = extract_data(resp_json)
    resumed = bool(data and data.get("resumed") is True)
    s(67, "Customer resume session", True, ok and resumed)

    _, _, ok = req("POST", f"/chat/{state['sessionId']}", json_body={"email": CUSTOMER_EMAIL, "customer_chat": "What are your opening hours?"})
    s(68, "Customer send chat message", True, ok)

    _, _, ok = req("POST", f"/chat/{state['sessionId']}", json_body={"email": "wrong@x.com", "customer_chat": "hi"})
    s(69, "Chat with wrong email blocked", False, ok)

    _, _, ok = req("DELETE", f"/chat/{state['sessionId']}", json_body={"email": "wrong@x.com"})
    s(70, "Delete chats wrong email blocked", False, ok)

    _, _, ok = req("DELETE", f"/chat/{state['sessionId']}", json_body={"email": CUSTOMER_EMAIL})
    s(71, "Customer delete own chats", True, ok)

    switch("memberA")
    _, _, ok = req("DELETE", f"/session/remove/{state['sessionId']}")
    s(72, "Member delete session", True, ok)

    switch("public")
    resp_json, _, ok = req("POST", f"/session/{state['botAId']}", json_body={"email": CUSTOMER_EMAIL})
    data = extract_data(resp_json)
    if ok and data and data.get("session", {}).get("id"):
        state["sessionId"] = data["session"]["id"]

    switch("outsider")
    _, _, ok = req("DELETE", f"/session/remove/{state['sessionId']}")
    s(74, "Outsider delete session blocked", False, ok)

    switch("memberA")
    _, _, ok = req("DELETE", f"/session/remove/{state['sessionId']}")
    s(75, "Member delete session again", True, ok)

    switch("public")
    _, _, ok = req("POST", "/master/getallusers", json_body={"masterKey": "wrong-key"})
    s(76, "Master all users wrong key blocked", False, ok)
    _, _, ok = req("POST", "/master/getallusers", json_body={"masterKey": "master-key"})
    s(77, "Master all users correct key", True, ok)

    switch("memberA")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/transfer-ownership", json_body={"newOwnerId": "some-id"})
    s(78, "Member transfer ownership blocked", False, ok)

    switch("admin")
    me_json, _, _ = req("GET", "/auth/me")
    admin_id = extract_data(me_json).get("id") if extract_data(me_json) else None

    switch("owner")
    me_json, _, _ = req("GET", "/auth/me")
    owner_id = extract_data(me_json).get("id") if extract_data(me_json) else None

    switch("owner")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/transfer-ownership", json_body={"newOwnerId": admin_id})
    s(79, "Owner transfer ownership to admin", True, ok)

    switch("admin")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}", json_body={"name": "NEXA E2E Org V3"})
    s(80, "New owner (admin) update org", True, ok)

    switch("owner")
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}", json_body={"name": "Hack"})
    s(81, "Old owner (now member) update org blocked", False, ok)
    _, _, ok = req("PUT", f"/organization/{state['organizationId']}/members/{state['memberIds']['memberB']}/role", json_body={"role": "admin"})
    s(82, "Old owner (now member) update role blocked", False, ok)

    switch("admin")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/transfer-ownership", json_body={"newOwnerId": owner_id})
    s(83, "Transfer ownership back to old owner", True, ok)

    switch("owner")
    _, _, ok = req("POST", f"/organization/{state['organizationId']}/transfer-ownership", json_body={"newOwnerId": owner_id})
    s(84, "Transfer ownership to self blocked", False, ok)

    switch("owner")
    _, _, ok = req("DELETE", f"/chatbot/{state['botBId']}")
    s(85, "Owner delete chatbot B", True, ok)
    _, _, ok = req("DELETE", f"/chatbot/{state['botCId']}")
    s(86, "Owner delete chatbot C", True, ok)

    switch("outsider")
    _, _, ok = req("DELETE", f"/chatbot/{state['botAId']}")
    s(87, "Outsider delete chatbot A blocked", False, ok)

    switch("memberA")
    _, _, ok = req("DELETE", f"/chatbot/{state['botAId']}")
    s(88, "Member delete chatbot A", True, ok)

    switch("memberA")
    _, _, ok = req("DELETE", f"/organization/{state['organizationId']}/members/{state['memberIds']['memberB']}")
    s(89, "Member remove member blocked", False, ok)

    switch("owner")
    _, _, ok = req("DELETE", f"/organization/{state['organizationId']}/members/{state['memberIds']['memberB']}")
    s(90, "Owner remove memberB", True, ok)
    _, _, ok = req("DELETE", f"/organization/{state['organizationId']}/members/{state['memberIds']['admin']}")
    s(91, "Owner remove admin", True, ok)

    state["memberIds"]["memberA"] = member_id(USERS["memberA"]["email"])
    _, _, ok = req("DELETE", f"/organization/{state['organizationId']}/members/{state['memberIds']['memberA']}")
    s(92, "Owner remove memberA", True, ok)

    state["memberIds"]["guest"] = member_id(USERS["guest"]["email"])
    if state["memberIds"]["guest"]:
        _, _, ok = req("DELETE", f"/organization/{state['organizationId']}/members/{state['memberIds']['guest']}")
        s(93, "Owner remove guest", True, ok)
    else:
        s(93, "Owner remove guest", True, False)

    _, _, ok = req("DELETE", f"/organization/{state['organizationId']}")
    s(94, "Owner delete organization", True, ok)

    switch("outsider")
    _, _, ok = req("GET", f"/organization/{state['organizationId']}")
    s(95, "Access deleted org fails", False, ok)

    matched = sum(1 for r in step_results if r[4])
    total = len(step_results)

    logger.line("")
    logger.line("================ SUMMARY TABLE ================")
    for num, desc, exp, act, corr in step_results:
        logger.line(
            f"[{num}][{desc}][expect {'success' if exp else 'fail'}][result {'success' if act else 'fail'}][match {'true' if corr else 'false'}]"
        )
    logger.line("===============================================")
    logger.line(f"[match rate][{matched}/{total}][full log: {LOG_FILE}]")

    logger.file("\n================ DETAILED SUMMARY ================")
    for num, desc, exp, act, corr in step_results:
        logger.file(
            f"Step {num}: {desc} | expected {'success' if exp else 'fail'} | actual {'success' if act else 'fail'} | match {'true' if corr else 'false'}"
        )
    logger.file(f"Match Rate: {matched}/{total}")
    logger.file(f"Full log written to: {LOG_FILE}")

    sys.exit(0 if matched == total else 1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.line("[interrupted][user]")
        sys.exit(130)
    except Exception as e:
        logger.file(f"Unhandled exception: {str(e)}")
        logger.line(f"[error][{e}]")
        sys.exit(1)






