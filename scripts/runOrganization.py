#!/usr/bin/env python3
import requests
import json
import time
import sys
import os
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

BASE_URL = "http://localhost:3000"
LOG_FILE = "runOrganization.log"

# User credentials – auto‑generated with timestamp
USER1 = {
    "email": f"user1_{int(time.time())}@nuxa.ai",
    "username": f"user1_{int(time.time())}",
    "password": "SecurePass123!"
}
USER2 = {
    "email": f"user2_{int(time.time())}@nuxa.ai",
    "username": f"user2_{int(time.time())}",
    "password": "SecurePass123!"
}

# Shared state between steps
state = {
    "accessToken": None,
    "refreshToken": None,
    "userId1": None,
    "userId2": None,
    "organizationId": None,
    "memberIdUser1": None,
    "memberIdUser2": None,
}

# Track step results: (step_number, description, expected_success, api_success, step_correct)
step_results: List[Tuple[int, str, bool, bool, bool]] = []

# Logger
class Logger:
    def __init__(self, log_file=LOG_FILE):
        self.log_file = log_file
        self._init_file()

    def _init_file(self):
        with open(self.log_file, 'w') as f:
            f.write(f"=== NEXA API Organization Test Run: {datetime.now().isoformat()} ===\n\n")

    def log(self, msg, level="INFO"):
        timestamp = datetime.now().isoformat()
        line = f"[{timestamp}] [{level}] {msg}"
        print(line)
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(line + '\n')

    def info(self, msg): self.log(msg, "INFO")
    def success(self, msg): self.log(msg, "SUCCESS")
    def error(self, msg): self.log(msg, "ERROR")
    def warn(self, msg): self.log(msg, "WARN")
    def step(self, num, desc): self.log(f"=== STEP {num}: {desc} ===", "STEP")

logger = Logger()

def request(method: str, endpoint: str, headers: Optional[Dict] = None,
            json_body: Optional[Dict] = None, expected_status: int = None,
            allow_fail: bool = False) -> Tuple[Optional[Dict], int, bool]:
    """
    Make HTTP request and log details.
    Returns (parsed_json, status_code, api_success)
    api_success is True if status_code is 2xx.
    """
    url = f"{BASE_URL}{endpoint}"
    full_headers = {"Content-Type": "application/json"}
    if headers:
        full_headers.update(headers)
    # Add Bearer token for protected endpoints
    if state.get("accessToken") and not endpoint.startswith("/auth/register") and not endpoint.startswith("/auth/login") and not endpoint.startswith("/auth/refresh"):
        full_headers["Authorization"] = f"Bearer {state['accessToken']}"

    logger.info(f"Request: {method} {endpoint}")
    if json_body:
        logger.info(f"Body: {json.dumps(json_body, indent=2)}")

    try:
        resp = requests.request(method, url, headers=full_headers, json=json_body, timeout=10)
        status = resp.status_code
        api_success = 200 <= status < 300
        logger.info(f"Response Status: {status}")
        try:
            resp_json = resp.json()
            logger.info(f"Response Body: {json.dumps(resp_json, indent=2)}")
        except:
            resp_json = None
            logger.info(f"Response Body (non-JSON): {resp.text[:200]}")

        if expected_status is not None and status != expected_status:
            if not allow_fail:
                logger.error(f"Expected status {expected_status} but got {status}")
            else:
                logger.warn(f"Expected status {expected_status} but got {status} (allowed)")
        return resp_json, status, api_success
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        if not allow_fail:
            raise
        return None, 0, False

def extract_data(resp_json):
    if not resp_json:
        return None
    if "data" in resp_json:
        return resp_json["data"]
    return resp_json

def switch_token(new_token):
    """Switch the global access token to a new one and return the old one."""
    old = state["accessToken"]
    state["accessToken"] = new_token
    return old

def main():
    logger.info("🚀 Starting NEXA API Organization test script")
    logger.info(f"User1: {USER1['email']} / {USER1['username']}")
    logger.info(f"User2: {USER2['email']} / {USER2['username']}")

    # Helper to record step
    def record_step(num, desc, expected_success, api_success):
        step_correct = (api_success == expected_success)
        step_results.append((num, desc, expected_success, api_success, step_correct))
        return step_correct

    # ------------------------------------------------------------
    # STEP 1: Health Check (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(1, "Health Check")
    resp_json, status, api_success = request("GET", "/health")
    data = extract_data(resp_json)
    if data and data.get("status") == "ok" and api_success:
        logger.success("Health check passed")
    else:
        logger.error("Health check failed")
    correct = record_step(1, "Health Check", True, api_success)
    if not correct:
        logger.error("Critical failure – stopping.")
        sys.exit(1)

    # ------------------------------------------------------------
    # STEP 2: Register User 2 (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(2, "Register User 2")
    resp_json, status, api_success = request("POST", "/auth/register", json_body={
        "email": USER2["email"],
        "username": USER2["username"],
        "password": USER2["password"]
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("user", {}).get("id"):
        state["userId2"] = data["user"]["id"]
        logger.success(f"User2 registered with ID {state['userId2']}")
    else:
        logger.error("User2 registration failed")
    correct = record_step(2, "Register User 2", True, api_success)
    if not correct:
        logger.error("Critical failure – stopping.")
        sys.exit(1)

    # ------------------------------------------------------------
    # STEP 3: Register User 1 (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(3, "Register User 1")
    resp_json, status, api_success = request("POST", "/auth/register", json_body={
        "email": USER1["email"],
        "username": USER1["username"],
        "password": USER1["password"]
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("user", {}).get("id"):
        state["userId1"] = data["user"]["id"]
        logger.success(f"User1 registered with ID {state['userId1']}")
    else:
        logger.error("User1 registration failed")
    correct = record_step(3, "Register User 1", True, api_success)
    if not correct:
        logger.error("Critical failure – stopping.")
        sys.exit(1)

    # ------------------------------------------------------------
    # STEP 4: Login User 1 (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(4, "Login User 1")
    resp_json, status, api_success = request("POST", "/auth/login", json_body={
        "emailOrUsername": USER1["username"],
        "password": USER1["password"]
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("accessToken"):
        state["accessToken"] = data["accessToken"]
        state["refreshToken"] = data["refreshToken"]
        logger.success("User1 logged in, accessToken stored")
    else:
        logger.error("User1 login failed")
    correct = record_step(4, "Login User 1", True, api_success)
    if not correct:
        logger.error("Critical failure – stopping.")
        sys.exit(1)

    # ------------------------------------------------------------
    # STEP 5: Create Organization (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(5, "Create Organization")
    resp_json, status, api_success = request("POST", "/organization", json_body={
        "name": "Test Org",
        "description": "Test organization for automation"
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("id"):
        state["organizationId"] = data["id"]
        logger.success(f"Organization created with ID {state['organizationId']}")
    else:
        logger.error("Organization creation failed")
    correct = record_step(5, "Create Organization", True, api_success)
    if not correct:
        logger.error("Critical failure – stopping.")
        sys.exit(1)

    # ------------------------------------------------------------
    # STEP 6: List My Organizations (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(6, "List My Organizations")
    resp_json, status, api_success = request("GET", "/organization")
    data = extract_data(resp_json)
    if api_success and isinstance(data, list) and len(data) > 0:
        found = any(org.get("id") == state["organizationId"] for org in data)
        if found:
            logger.success("Organization found in list")
        else:
            logger.error("Organization not found in list")
    else:
        logger.error("Failed to list organizations")
    record_step(6, "List My Organizations", True, api_success)

    # ------------------------------------------------------------
    # STEP 7: Invite User 2 as Member (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(7, "Invite User 2 as Member")
    resp_json, status, api_success = request("POST", f"/organization/{state['organizationId']}/members/invite", json_body={
        "email": USER2["email"],
        "role": "member"
    })
    data = extract_data(resp_json)
    if api_success and isinstance(data, list):
        for member in data:
            if member.get("email") == USER2["email"]:
                state["memberIdUser2"] = member["id"]
                logger.success(f"User2 invited, member ID {state['memberIdUser2']}")
                break
        else:
            logger.warn("User2 not found in members list")
    else:
        logger.error("Invite failed")
    record_step(7, "Invite User 2 as Member", True, api_success)

    # ------------------------------------------------------------
    # STEP 8: Login as User2, try to update org (expected FAILURE)
    # ------------------------------------------------------------
    logger.step(8, "Login as User2, try to update org (expected fail)")
    # Login as user2
    resp_json, status, api_success = request("POST", "/auth/login", json_body={
        "emailOrUsername": USER2["username"],
        "password": USER2["password"]
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("accessToken"):
        user2_token = data["accessToken"]
        # Save current token (user1)
        old_token = state["accessToken"]
        # Switch to user2 token
        state["accessToken"] = user2_token
        # Try to update org – expected to fail (403)
        resp_json2, status2, api_success2 = request("PUT", f"/organization/{state['organizationId']}",
                        json_body={"name": "Hacked Name"},
                        expected_status=403, allow_fail=True)
        # Restore original token
        state["accessToken"] = old_token
        if status2 == 403:
            logger.success("Update attempt failed as expected (403)")
        else:
            logger.warn("Update did not fail as expected")
        record_step(8, "Try update org as member (should fail)", False, api_success2)
    else:
        logger.error("User2 login failed")
        record_step(8, "Try update org as member (should fail)", False, False)

    # ------------------------------------------------------------
    # STEP 9: Promote User2 to Admin (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(9, "Promote User2 to Admin")
    if not state.get("memberIdUser2"):
        resp_json, status, api_success = request("GET", f"/organization/{state['organizationId']}/members")
        data = extract_data(resp_json)
        if isinstance(data, list):
            for member in data:
                if member.get("email") == USER2["email"]:
                    state["memberIdUser2"] = member["id"]
                    break
    if state.get("memberIdUser2"):
        # Ensure we are user1
        resp_json, status, api_success = request("POST", "/auth/login", json_body={
            "emailOrUsername": USER1["username"],
            "password": USER1["password"]
        })
        data = extract_data(resp_json)
        if api_success and data and data.get("accessToken"):
            state["accessToken"] = data["accessToken"]
        resp_json2, status2, api_success2 = request("PUT", f"/organization/{state['organizationId']}/members/{state['memberIdUser2']}/role",
                        json_body={"role": "admin"})
        if api_success2:
            logger.success("User2 promoted to admin")
        else:
            logger.error("Promotion failed")
        record_step(9, "Promote User2 to Admin", True, api_success2)
    else:
        logger.error("Cannot find memberId for user2")
        record_step(9, "Promote User2 to Admin", True, False)

    # ------------------------------------------------------------
    # STEP 10: User2 tries to remove owner (expected FAILURE)
    # ------------------------------------------------------------
    logger.step(10, "User2 tries to remove owner (expected fail)")
    resp_json, status, api_success = request("GET", f"/organization/{state['organizationId']}/members")
    data = extract_data(resp_json)
    owner_member_id = None
    if isinstance(data, list):
        for member in data:
            if member.get("user_id") == state["userId1"]:
                owner_member_id = member["id"]
                break
    if owner_member_id:
        # Login as user2
        resp_json, status, api_success = request("POST", "/auth/login", json_body={
            "emailOrUsername": USER2["username"],
            "password": USER2["password"]
        })
        data = extract_data(resp_json)
        if api_success and data and data.get("accessToken"):
            user2_token = data["accessToken"]
            old_token = state["accessToken"]
            state["accessToken"] = user2_token
            # Try to delete owner – expected to fail (403)
            resp_json2, status2, api_success2 = request("DELETE", f"/organization/{state['organizationId']}/members/{owner_member_id}",
                            expected_status=403, allow_fail=True)
            state["accessToken"] = old_token
            if status2 == 403:
                logger.success("Delete owner attempt failed as expected (403)")
            else:
                logger.warn("Delete owner did not fail as expected")
            record_step(10, "User2 tries to remove owner (should fail)", False, api_success2)
        else:
            logger.error("User2 login failed")
            record_step(10, "User2 tries to remove owner (should fail)", False, False)
    else:
        logger.error("Cannot find owner member ID")
        record_step(10, "User2 tries to remove owner (should fail)", False, False)

    # ------------------------------------------------------------
    # STEP 11: User1 tries to leave org (expected FAILURE because members exist)
    # ------------------------------------------------------------
    logger.step(11, "User1 tries to leave org (expected fail)")
    # Ensure user1 token
    resp_json, status, api_success = request("POST", "/auth/login", json_body={
        "emailOrUsername": USER1["username"],
        "password": USER1["password"]
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("accessToken"):
        state["accessToken"] = data["accessToken"]
    resp_json2, status2, api_success2 = request("POST", f"/organization/{state['organizationId']}/leave",
                    expected_status=400, allow_fail=True)
    if status2 == 400:
        logger.success("Leave attempt failed as expected (400)")
    else:
        logger.warn("Leave did not fail as expected")
    record_step(11, "Owner tries to leave while members exist (should fail)", False, api_success2)

    # ------------------------------------------------------------
    # STEP 12: User1 removes User2 (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(12, "User1 removes User2")
    resp_json, status, api_success = request("POST", "/auth/login", json_body={
        "emailOrUsername": USER1["username"],
        "password": USER1["password"]
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("accessToken"):
        state["accessToken"] = data["accessToken"]
    if state.get("memberIdUser2"):
        resp_json2, status2, api_success2 = request("DELETE", f"/organization/{state['organizationId']}/members/{state['memberIdUser2']}")
        if api_success2:
            logger.success("User2 removed")
            # Clear the memberId because it's removed
            state["memberIdUser2"] = None
        else:
            logger.error("Failed to remove user2")
        record_step(12, "Remove User2 (owner removes member)", True, api_success2)
    else:
        logger.error("memberIdUser2 not available")
        record_step(12, "Remove User2 (owner removes member)", True, False)

    # ------------------------------------------------------------
    # STEP 13: Re-invite User2 and transfer ownership (expected SUCCESS)
    # ------------------------------------------------------------
    logger.step(13, "Re-invite User2 and transfer ownership")
    # Ensure user1 token
    resp_json, status, api_success = request("POST", "/auth/login", json_body={
        "emailOrUsername": USER1["username"],
        "password": USER1["password"]
    })
    data = extract_data(resp_json)
    if api_success and data and data.get("accessToken"):
        state["accessToken"] = data["accessToken"]

    # Pre‑emptive cleanup: list members; if user2 still exists, delete them
    logger.info("Cleaning up: ensuring user2 is not a member before re-invite")
    resp_clean, _, _ = request("GET", f"/organization/{state['organizationId']}/members", expected_status=200, allow_fail=True)
    clean_data = extract_data(resp_clean)
    if isinstance(clean_data, list):
        for member in clean_data:
            if member.get("email") == USER2["email"]:
                logger.warn(f"User2 still has member ID {member['id']} – deleting")
                del_resp, _, del_ok = request("DELETE", f"/organization/{state['organizationId']}/members/{member['id']}", expected_status=200, allow_fail=True)
                if del_ok:
                    logger.success("Stale member record deleted")
                else:
                    logger.warn("Failed to delete stale record – continuing anyway")

    # Now invite again
    resp_json2, status2, api_success2 = request("POST", f"/organization/{state['organizationId']}/members/invite", json_body={
        "email": USER2["email"],
        "role": "member"
    })
    if api_success2:
        logger.success("User2 re-invited")
        # Get new member ID
        resp_json3, status3, api_success3 = request("GET", f"/organization/{state['organizationId']}/members")
        data3 = extract_data(resp_json3)
        if isinstance(data3, list):
            for member in data3:
                if member.get("email") == USER2["email"]:
                    state["memberIdUser2"] = member["id"]
                    break
        # Transfer ownership
        resp_json4, status4, api_success4 = request("POST", f"/organization/{state['organizationId']}/transfer-ownership", json_body={
            "newOwnerId": state["userId2"]
        })
        if api_success4:
            logger.success("Ownership transferred to User2")
        else:
            logger.error("Transfer ownership failed")
        # The step is success if both invite and transfer succeeded
        step_correct = api_success2 and api_success4
    else:
        logger.error("Re-invite failed")
        step_correct = False
    record_step(13, "Re-invite and transfer ownership", True, step_correct)

    # ------------------------------------------------------------
    # FINAL SUMMARY
    # ------------------------------------------------------------
    logger.info("\n" + "=" * 80)
    logger.info("📊 DETAILED STEP SUMMARY")
    logger.info("=" * 80)
    logger.info(f"{'Step':<6} {'Description':<45} {'Expected':<12} {'Actual':<12} {'Match'}")
    logger.info("-" * 80)

    matched = 0
    for step_num, desc, exp_success, api_success, step_correct in step_results:
        exp_str = "SUCCESS" if exp_success else "FAIL"
        act_str = "SUCCESS" if api_success else "FAIL"
        match = "✅" if step_correct else "❌"
        if step_correct:
            matched += 1
        logger.info(f"{step_num:<6} {desc:<45} {exp_str:<12} {act_str:<12} {match}")

    total = len(step_results)
    match_rate = (matched / total) * 100 if total > 0 else 0

    logger.info("=" * 80)
    logger.info(f"\n📈 Match Rate: {match_rate:.1f}% ({matched}/{total} steps matched expected outcome)")
    if match_rate == 100:
        logger.success("🎉 All steps behaved as expected!")
    else:
        logger.warn(f"⚠️ {total - matched} step(s) did not match expectations. Review logs above.")

    logger.info(f"📁 Full log written to: {LOG_FILE}")
    logger.info("=" * 80 + "\n")

    # Exit with non‑zero if any step did not match expectation
    sys.exit(0 if matched == total else 1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warn("Interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Unhandled exception: {str(e)}")
        sys.exit(1)