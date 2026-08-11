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
LOG_FILE = "runChatbotChar.log"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE1 = os.path.join(SCRIPT_DIR, "image1.png")
IMAGE2 = os.path.join(SCRIPT_DIR, "image2.png")

USER1 = {
    "email": f"user1_{int(time.time())}@nuxa.ai",
    "username": f"user1_{int(time.time())}",
    "password": "SecurePass123!",
}
USER2 = {
    "email": f"user2_{int(time.time())}@nuxa.ai",
    "username": f"user2_{int(time.time())}",
    "password": "SecurePass123!",
}
USER3 = {
    "email": f"user3_{int(time.time())}@nuxa.ai",
    "username": f"user3_{int(time.time())}",
    "password": "SecurePass123!",
}

state = {
    "accessToken": None,
    "organizationId": None,
    "chatbot1Id": None,
    "chatbot2Id": None,
    "characteristicAId": None,
    "characteristicBId": None,
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
            f.write(
                f"=== NEXA API Chatbot Characteristic Test Run: {datetime.now().isoformat()} ===\n\n"
            )

    def file(self, msg: str, level: str = "INFO") -> None:
        ts = datetime.now().isoformat()
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] [{level}] {msg}\n")

    def line(self, text: str) -> None:
        print(text)
        self.file(text, "STEP")


logger = Logger()


def build_headers(json_content: bool = True) -> Dict:
    full_headers = {"Content-Type": "application/json"} if json_content else {}
    if state.get("accessToken"):
        full_headers["Authorization"] = f"Bearer {state['accessToken']}"
    return full_headers


def request(
    method: str,
    endpoint: str,
    json_body: Optional[Dict] = None,
) -> Tuple[Optional[Dict], int, bool]:
    url = f"{BASE_URL}{endpoint}"
    full_headers = build_headers()
    logger.file(f"Request: {method} {endpoint}")
    if json_body:
        logger.file(f"Body: {json.dumps(json_body, indent=2)}")
    try:
        resp = requests.request(method, url, headers=full_headers, json=json_body, timeout=15)
        status = resp.status_code
        api_success = 200 <= status < 300
        logger.file(f"Response Status: {status}")
        try:
            resp_json = resp.json()
            logger.file(f"Response Body: {json.dumps(resp_json, indent=2)}")
        except Exception:
            resp_json = None
            logger.file(f"Response Body (non-JSON): {resp.text[:200]}")
        return resp_json, status, api_success
    except Exception as e:
        logger.file(f"Request failed: {str(e)}")
        raise


def request_multipart(
    method: str,
    endpoint: str,
    fields: Optional[Dict] = None,
    file_path: Optional[str] = None,
    file_field: str = "image",
) -> Tuple[Optional[Dict], int, bool]:
    url = f"{BASE_URL}{endpoint}"
    full_headers = build_headers(json_content=False)
    logger.file(f"Request (multipart): {method} {endpoint}")
    if fields:
        logger.file(f"Fields: {json.dumps(fields, indent=2)}")
    if file_path:
        logger.file(f"File: {file_path}")
    try:
        files = {}
        if file_path:
            files[file_field] = (os.path.basename(file_path), open(file_path, "rb"), "image/png")
        resp = requests.request(method, url, headers=full_headers, data=fields, files=files, timeout=30)
        status = resp.status_code
        api_success = 200 <= status < 300
        logger.file(f"Response Status: {status}")
        try:
            resp_json = resp.json()
            logger.file(f"Response Body: {json.dumps(resp_json, indent=2)}")
        except Exception:
            resp_json = None
            logger.file(f"Response Body (non-JSON): {resp.text[:200]}")
        return resp_json, status, api_success
    except Exception as e:
        logger.file(f"Request failed: {str(e)}")
        raise


def extract_data(resp_json):
    if not resp_json:
        return None
    return resp_json.get("data", resp_json)


def ensure_login(username: str, password: str) -> bool:
    resp_json, status, api_success = request(
        "POST",
        "/auth/login",
        json_body={"emailOrUsername": username, "password": password},
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("accessToken"):
        state["accessToken"] = data["accessToken"]
        return True
    return False


def report_step(num: int, desc: str, expected: bool, actual: bool) -> None:
    step_correct = actual == expected
    step_results.append((num, desc, expected, actual, step_correct))
    exp_s = "success" if expected else "fail"
    act_s = "success" if actual else "fail"
    match_s = "true" if step_correct else "false"
    logger.line(
        f"[step {num}][{desc}][expect: {exp_s}][result: {act_s}][match: {match_s}]"
    )
    return step_correct


def main():
    logger.file("Starting NEXA API Chatbot Characteristic test script")
    logger.file(f"User1: {USER1['email']} / {USER1['username']}")
    logger.file(f"User2: {USER2['email']} / {USER2['username']}")
    logger.file(f"User3: {USER3['email']} / {USER3['username']}")
    ensure_image(IMAGE1)
    ensure_image(IMAGE2)

    def critical(num, desc):
        logger.line("Critical failure - stopping.")
        sys.exit(1)

    logger.file("STEP 1: Register User 1")
    resp_json, status, api_success = request(
        "POST",
        "/auth/register",
        json_body={
            "email": USER1["email"],
            "username": USER1["username"],
            "password": USER1["password"],
        },
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("user", {}).get("id") and data.get("accessToken"):
        state["accessToken"] = data["accessToken"]
    if not report_step(1, "Register User 1", True, api_success):
        critical(1, "Register User 1")

    logger.file("STEP 2: Create Organization as User 1")
    if not ensure_login(USER1["username"], USER1["password"]):
        critical(2, "Create Organization as User 1")
    resp_json, status, api_success = request(
        "POST",
        "/organization",
        json_body={"name": "Chatbot Char Test Org", "description": "Org for characteristic automation"},
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("id"):
        state["organizationId"] = data["id"]
    if not report_step(2, "Create Organization as User 1", True, api_success):
        critical(2, "Create Organization as User 1")

    logger.file("STEP 3: Create chatbot with image1 as User 1")
    resp_json, status, api_success = request_multipart(
        "POST",
        "/chatbot",
        fields={
            "organizationId": state["organizationId"],
            "name": "Chatbot One",
            "description": "First chatbot",
            "systemPrompt": "You are Chatbot One",
            "welcomeMessage": "Hello from Chatbot One",
        },
        file_path=IMAGE1,
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("id"):
        state["chatbot1Id"] = data["id"]
    if not report_step(3, "Create chatbot with image1", True, api_success):
        critical(3, "Create chatbot with image1")

    logger.file("STEP 4: Update chatbot with empty image field as User 1")
    resp_json, status, api_success = request_multipart(
        "PUT",
        f"/chatbot/{state['chatbot1Id']}",
        fields={"name": "Chatbot One Updated"},
    )
    if not report_step(4, "Update chatbot with empty image field", True, api_success):
        critical(4, "Update chatbot with empty image field")

    logger.file("STEP 5: Update chatbot image to image2 as User 1")
    resp_json, status, api_success = request_multipart(
        "PUT",
        f"/chatbot/{state['chatbot1Id']}",
        fields={"description": "Chatbot with new image"},
        file_path=IMAGE2,
    )
    if not report_step(5, "Update chatbot image to image2", True, api_success):
        critical(5, "Update chatbot image to image2")

    logger.file("STEP 6: Register User 2")
    resp_json, status, api_success = request(
        "POST",
        "/auth/register",
        json_body={
            "email": USER2["email"],
            "username": USER2["username"],
            "password": USER2["password"],
        },
    )
    if not report_step(6, "Register User 2", True, api_success):
        critical(6, "Register User 2")

    logger.file("STEP 7: Invite User 2 to organization as User 1")
    if not ensure_login(USER1["username"], USER1["password"]):
        critical(7, "Invite User 2 to organization")
    resp_json, status, api_success = request(
        "POST",
        f"/organization/{state['organizationId']}/members/invite",
        json_body={"email": USER2["email"], "role": "member"},
    )
    if not report_step(7, "Invite User 2 to organization", True, api_success):
        critical(7, "Invite User 2 to organization")

    logger.file("STEP 8: Create chatbot without image as User 2")
    if not ensure_login(USER2["username"], USER2["password"]):
        critical(8, "Create chatbot without image")
    resp_json, status, api_success = request_multipart(
        "POST",
        "/chatbot",
        fields={
            "organizationId": state["organizationId"],
            "name": "Chatbot Two",
            "description": "Second chatbot",
        },
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("id"):
        state["chatbot2Id"] = data["id"]
    if not report_step(8, "Create chatbot without image", True, api_success):
        critical(8, "Create chatbot without image")

    logger.file("STEP 9: Get list of chatbots in organization as User 2")
    resp_json, status, api_success = request(
        "GET", f"/chatbot/org/{state['organizationId']}"
    )
    if not report_step(9, "Get list of chatbots in organization", True, api_success):
        critical(9, "Get list of chatbots in organization")

    logger.file("STEP 10: Update chatbot1 image to image1 as User 2")
    resp_json, status, api_success = request_multipart(
        "PUT",
        f"/chatbot/{state['chatbot1Id']}",
        fields={"name": "Chatbot One Edited By User2"},
        file_path=IMAGE1,
    )
    if not report_step(10, "User2 edit chatbot1 image", True, api_success):
        critical(10, "User2 edit chatbot1 image")

    logger.file("STEP 11: Delete chatbot1 as User 2")
    resp_json, status, api_success = request(
        "DELETE", f"/chatbot/{state['chatbot1Id']}"
    )
    if not report_step(11, "User2 delete chatbot1", True, api_success):
        critical(11, "User2 delete chatbot1")

    logger.file("STEP 12: Create characteristic A on chatbot2 as User 2")
    resp_json, status, api_success = request(
        "POST",
        f"/characteristic/{state['chatbot2Id']}",
        json_body={
            "type": "data",
            "title": "Company hours",
            "description": "Company opens at 10am-24pm",
        },
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("id"):
        state["characteristicAId"] = data["id"]
    if not report_step(12, "Create characteristic A", True, api_success):
        critical(12, "Create characteristic A")

    logger.file("STEP 13: Update characteristic A as User 2")
    resp_json, status, api_success = request(
        "PUT",
        f"/characteristic/{state['chatbot2Id']}/{state['characteristicAId']}",
        json_body={"description": "Company opens 10am-12pm"},
    )
    if not report_step(13, "Update characteristic A", True, api_success):
        critical(13, "Update characteristic A")

    logger.file("STEP 14: Delete characteristic A as User 2")
    resp_json, status, api_success = request(
        "DELETE",
        f"/characteristic/{state['chatbot2Id']}/{state['characteristicAId']}",
    )
    if not report_step(14, "Delete characteristic A", True, api_success):
        critical(14, "Delete characteristic A")

    logger.file("STEP 15: User1 login and create characteristic B")
    if not ensure_login(USER1["username"], USER1["password"]):
        critical(15, "User1 login and create characteristic B")
    resp_json, status, api_success = request(
        "POST",
        f"/characteristic/{state['chatbot2Id']}",
        json_body={
            "type": "restrict",
            "title": "Do not share pricing",
            "description": "Pricing is confidential",
        },
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("id"):
        state["characteristicBId"] = data["id"]
    if not report_step(15, "User1 create characteristic B", True, api_success):
        critical(15, "User1 create characteristic B")

    logger.file("STEP 16: User2 login and update characteristic B")
    if not ensure_login(USER2["username"], USER2["password"]):
        critical(16, "User2 update characteristic B")
    resp_json, status, api_success = request(
        "PUT",
        f"/characteristic/{state['chatbot2Id']}/{state['characteristicBId']}",
        json_body={"description": "Pricing updated"},
    )
    if not report_step(16, "User2 update characteristic B", True, api_success):
        critical(16, "User2 update characteristic B")

    logger.file("STEP 17: User3 tries update and delete characteristic B (expect fail)")
    resp_json, status, api_success = request(
        "POST",
        "/auth/register",
        json_body={
            "email": USER3["email"],
            "username": USER3["username"],
            "password": USER3["password"],
        },
    )
    data = extract_data(resp_json)
    if api_success and data and data.get("accessToken"):
        state["accessToken"] = data["accessToken"]
    _, _, up_ok = request(
        "PUT",
        f"/characteristic/{state['chatbot2Id']}/{state['characteristicBId']}",
        json_body={"description": "User3 hack attempt"},
    )
    _, _, del_ok = request(
        "DELETE",
        f"/characteristic/{state['chatbot2Id']}/{state['characteristicBId']}",
    )
    all_blocked = (not up_ok) and (not del_ok)
    if not report_step(17, "User3 blocked from characteristic B", False, not all_blocked):
        critical(17, "User3 blocked from characteristic B")

    logger.file("STEP 18: User3 tries update and delete chatbot2 (expect fail)")
    _, _, up_ok = request_multipart(
        "PUT",
        f"/chatbot/{state['chatbot2Id']}",
        fields={"name": "User3 hack"},
    )
    _, _, del_ok = request(
        "DELETE", f"/chatbot/{state['chatbot2Id']}"
    )
    all_blocked = (not up_ok) and (not del_ok)
    if not report_step(18, "User3 blocked from chatbot2", False, not all_blocked):
        critical(18, "User3 blocked from chatbot2")

    logger.file("STEP 19: User2 login and delete chatbot2")
    if not ensure_login(USER2["username"], USER2["password"]):
        critical(19, "User2 delete chatbot2")
    resp_json, status, api_success = request(
        "DELETE", f"/chatbot/{state['chatbot2Id']}"
    )
    if not report_step(19, "User2 delete chatbot2", True, api_success):
        critical(19, "User2 delete chatbot2")

    logger.file("STEP 20: Final note")
    logger.line(
        "[step 20][no operation] All operation done, check your characteristic table, it supposed to be empty, since deleting chatbot also deletes its characteristic"
    )

    matched = sum(1 for r in step_results if r[4])
    total = len(step_results)
    logger.file("\n" + "=" * 80)
    logger.file("DETAILED STEP SUMMARY")
    for step_num, desc, exp_success, api_success, step_correct in step_results:
        logger.file(
            f"Step {step_num}: {desc} | expected {'success' if exp_success else 'fail'} | actual {'success' if api_success else 'fail'} | match {'true' if step_correct else 'false'}"
        )
    logger.file("=" * 80)
    logger.file(f"Match Rate: {matched}/{total}")
    logger.file(f"Full log written to: {LOG_FILE}")

    print(f"[match rate][{matched}/{total}][all operation done] Full log: {LOG_FILE}")
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
