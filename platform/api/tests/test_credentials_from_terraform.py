#!/usr/bin/env python3
"""
Test attendee credentials retrieval from Terraform outputs.

This test verifies that attendee credentials are properly retrieved
from OVH IAM user outputs, not from locally generated credentials.
"""

import requests
import json
import time
import sys
import os

# Add api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BASE_URL = "http://localhost"

def test_attendee_credentials_behavior():
    """
    Test that credentials endpoint returns actual OVH IAM user credentials
    from Terraform outputs after successful deployment.
    
    Expected behavior:
    1. Create workshop and attendee
    2. Deploy attendee resources (creates OVH IAM user via Terraform)
    3. Retrieve credentials - should return OVH IAM username/password
    4. Verify credentials are different from local username
    """
    
    print("Testing attendee credentials retrieval behavior...")
    
    try:
        # Health check first
        print("Testing API connectivity...")
        response = requests.get(f"{BASE_URL}/health/")
        if response.status_code != 200:
            print(f"❌ API health check failed: {response.text}")
            return False
        print("✅ API health check passed")
        
        # 1. Login
        print("\n1. Logging in...")
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json={"username": "admin", "password": "admin"})
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
            return False
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful")
        
        # 2. Create workshop
        print("\n2. Creating workshop...")
        workshop_data = {
            "name": "Credential Test Workshop",
            "description": "Testing credential retrieval from Terraform",
            "start_date": "2024-07-15T10:00:00Z",
            "end_date": "2024-07-15T18:00:00Z"
        }
        
        response = requests.post(f"{BASE_URL}/api/workshops/", 
                               json=workshop_data, headers=headers)
        if response.status_code not in [200, 201]:
            print(f"❌ Workshop creation failed: {response.text}")
            return False
        
        workshop = response.json()
        workshop_id = workshop["id"]
        print(f"✅ Workshop created: {workshop_id}")
        
        # 3. Add attendee
        print("\n3. Adding attendee...")
        attendee_data = {
            "username": "credtest01",
            "email": "credtest01@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendees?workshop_id={workshop_id}", 
                               json=attendee_data, headers=headers)
        if response.status_code not in [200, 201]:
            print(f"❌ Attendee creation failed: {response.text}")
            return False
        
        attendee = response.json()
        attendee_id = attendee["id"]
        original_username = attendee["username"]
        print(f"✅ Attendee created: {attendee_id}")
        print(f"   Original username: {original_username}")
        
        # 4. Deploy attendee (this should create OVH IAM user via Terraform)
        print("\n4. Starting attendee deployment...")
        response = requests.post(f"{BASE_URL}/api/attendees/{attendee_id}/deploy", 
                               headers=headers)
        if response.status_code != 200:
            print(f"❌ Deployment initiation failed: {response.text}")
            return False
        
        print("✅ Deployment initiated")
        
        # 5. Wait for deployment to complete
        print("\n5. Monitoring deployment...")
        max_attempts = 60
        for attempt in range(max_attempts):
            time.sleep(5)
            print(f"Checking status... (attempt {attempt + 1}/{max_attempts})")
            
            response = requests.get(f"{BASE_URL}/api/attendees/{attendee_id}", 
                                  headers=headers)
            if response.status_code != 200:
                print(f"❌ Status check failed: {response.text}")
                return False
            
            attendee_status = response.json()["status"]
            print(f"Attendee status: {attendee_status}")
            
            if attendee_status == "active":
                print("✅ Deployment completed successfully")
                break
            elif attendee_status == "failed":
                print("❌ Deployment failed")
                return False
        else:
            print("❌ Deployment timed out")
            return False
        
        # 6. Test credentials retrieval - THIS IS THE KEY TEST
        print("\n6. Testing credentials retrieval...")
        response = requests.get(f"{BASE_URL}/api/attendees/{attendee_id}/credentials", 
                              headers=headers)
        
        print(f"Credentials endpoint status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 404:
            print("❌ FAILING TEST: Credentials endpoint returns 404")
            print("   This indicates credentials are not being retrieved from Terraform outputs")
            print("   Expected: 200 with OVH IAM user credentials")
            print("   Actual: 404 - credentials not found")
            return False
        
        if response.status_code != 200:
            print(f"❌ FAILING TEST: Unexpected credentials response: {response.text}")
            return False
        
        credentials = response.json()
        returned_username = credentials.get("username")
        returned_password = credentials.get("password")
        ovh_project_id = credentials.get("ovh_project_id")
        
        print(f"Returned credentials:")
        print(f"   Username: {returned_username}")
        print(f"   Password: [REDACTED] ({'present' if returned_password else 'missing'})")
        print(f"   OVH Project ID: {ovh_project_id}")
        
        # Behavior verification
        if not returned_username or not returned_password:
            print("❌ FAILING TEST: Missing username or password in credentials")
            return False
        
        if returned_username == original_username:
            print("❌ FAILING TEST: Credentials returning local username instead of OVH IAM username")
            print(f"   Expected: OVH IAM username (different from '{original_username}')")
            print(f"   Actual: '{returned_username}' (same as local username)")
            return False
        
        if not ovh_project_id:
            print("❌ FAILING TEST: Missing OVH project ID in credentials")
            return False
        
        print("✅ Credentials retrieval successful")
        print(f"   OVH IAM username: {returned_username}")
        print(f"   OVH Project ID: {ovh_project_id}")
        
        # 7. Cleanup
        print("\n7. Cleaning up...")
        response = requests.post(f"{BASE_URL}/api/attendees/{attendee_id}/destroy", 
                               headers=headers)
        if response.status_code == 200:
            print("✅ Cleanup initiated")
        else:
            print(f"⚠️ Cleanup warning: {response.text}")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Testing Terraform credentials retrieval behavior...")
    print("=" * 60)
    
    if test_attendee_credentials_behavior():
        print("=" * 60)
        print("✅ TEST PASSED: Credentials behavior verified")
        sys.exit(0)
    else:
        print("=" * 60) 
        print("❌ TEST FAILED: Credentials behavior needs implementation")
        sys.exit(1)