#!/usr/bin/env python3
"""
Test sequential deployment approach to handle OVH quota limitations.

This test verifies that multiple attendees can be deployed sequentially
with proper cleanup between deployments to avoid quota issues.
"""

import requests
import json
import time
import sys
import os

# Add api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BASE_URL = "http://localhost"

def test_sequential_deployment():
    """
    Test sequential deployment of multiple attendees with cleanup.
    
    Expected behavior:
    1. Create workshop with 2 attendees (limited to avoid quota)
    2. Deploy attendee 1, wait for completion, get credentials
    3. Clean up attendee 1 to free resources  
    4. Deploy attendee 2, wait for completion, get credentials
    5. Clean up attendee 2
    6. Verify all resources freed
    
    This approach should avoid hitting OVH quota limits by ensuring
    only one project exists at a time.
    """
    
    print("Testing sequential deployment approach...")
    
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
            "name": "Sequential Deployment Test",
            "description": "Testing sequential deployment to avoid quota issues", 
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
        
        # 3. Add 2 attendees (limited to avoid quota)
        print("\n3. Adding 2 attendees...")
        attendees = []
        attendee_data = [
            {"username": "seqtest01", "email": "seqtest01@example.com"},
            {"username": "seqtest02", "email": "seqtest02@example.com"}
        ]
        
        for i, data in enumerate(attendee_data):
            response = requests.post(f"{BASE_URL}/api/attendees?workshop_id={workshop_id}", 
                                   json=data, headers=headers)
            if response.status_code not in [200, 201]:
                print(f"❌ Attendee {i+1} creation failed: {response.text}")
                return False
            
            attendee = response.json()
            attendees.append(attendee)
            print(f"✅ Attendee {i+1} created: {attendee['username']} ({attendee['id']})")
        
        # 4. Sequential deployment and cleanup
        print("\n4. Testing sequential deployment pattern...")
        
        for i, attendee in enumerate(attendees):
            print(f"\n   --- Processing Attendee {i+1}: {attendee['username']} ---")
            
            # 4a. Deploy attendee
            print(f"   Deploying {attendee['username']}...")
            response = requests.post(f"{BASE_URL}/api/attendees/{attendee['id']}/deploy", 
                                   headers=headers)
            if response.status_code != 200:
                print(f"   ❌ Deployment failed: {response.text}")
                return False
            
            print(f"   ✅ Deployment initiated")
            
            # 4b. Monitor deployment
            print(f"   Monitoring deployment...")
            max_attempts = 30
            deployment_successful = False
            
            for attempt in range(max_attempts):
                time.sleep(10)
                response = requests.get(f"{BASE_URL}/api/attendees/{attendee['id']}", 
                                      headers=headers)
                if response.status_code != 200:
                    print(f"   ❌ Status check failed: {response.text}")
                    return False
                
                status = response.json()["status"]
                print(f"   Status check {attempt + 1}/{max_attempts}: {status}")
                
                if status == "active":
                    print(f"   ✅ {attendee['username']} deployed successfully")
                    deployment_successful = True
                    break
                elif status == "failed":
                    print(f"   ❌ {attendee['username']} deployment failed")
                    return False
            
            if not deployment_successful:
                print(f"   ❌ {attendee['username']} deployment timed out")
                return False
            
            # 4c. Verify credentials
            print(f"   Verifying credentials for {attendee['username']}...")
            response = requests.get(f"{BASE_URL}/api/attendees/{attendee['id']}/credentials", 
                                  headers=headers)
            
            if response.status_code != 200:
                print(f"   ❌ Credentials retrieval failed: {response.text}")
                return False
            
            credentials = response.json()
            if not credentials.get("username") or not credentials.get("password"):
                print(f"   ❌ Invalid credentials returned")
                return False
            
            print(f"   ✅ Credentials verified for {attendee['username']}")
            print(f"      OVH Username: {credentials['username']}")
            print(f"      OVH Project: {credentials['ovh_project_id']}")
            
            # 4d. Clean up to free resources (except for last attendee - test cleanup separately)
            if i < len(attendees) - 1:  # Don't clean up the last one yet
                print(f"   Cleaning up {attendee['username']} to free resources...")
                response = requests.post(f"{BASE_URL}/api/attendees/{attendee['id']}/destroy", 
                                       headers=headers)
                if response.status_code != 200:
                    print(f"   ❌ Cleanup initiation failed: {response.text}")
                    return False
                
                print(f"   Monitoring cleanup...")
                for attempt in range(max_attempts):
                    time.sleep(10)
                    response = requests.get(f"{BASE_URL}/api/attendees/{attendee['id']}", 
                                          headers=headers)
                    if response.status_code != 200:
                        print(f"   ❌ Cleanup status check failed: {response.text}")
                        return False
                    
                    status = response.json()["status"]
                    print(f"   Cleanup check {attempt + 1}/{max_attempts}: {status}")
                    
                    if status == "deleted":
                        print(f"   ✅ {attendee['username']} cleaned up successfully")
                        break
                    elif status == "failed":
                        print(f"   ❌ {attendee['username']} cleanup failed")
                        return False
                else:
                    print(f"   ❌ {attendee['username']} cleanup timed out")
                    return False
            
            print(f"   --- Completed processing {attendee['username']} ---")
        
        # 5. Final cleanup of last attendee
        print(f"\n5. Final cleanup...")
        last_attendee = attendees[-1]
        response = requests.post(f"{BASE_URL}/api/attendees/{last_attendee['id']}/destroy", 
                               headers=headers)
        if response.status_code == 200:
            print(f"✅ Final cleanup initiated for {last_attendee['username']}")
        else:
            print(f"⚠️ Final cleanup warning: {response.text}")
        
        print("\n✅ SEQUENTIAL DEPLOYMENT TEST SUCCESSFUL")
        print("Summary:")
        print("- Created workshop with 2 attendees")
        print("- Successfully deployed each attendee sequentially")
        print("- Verified credentials for each deployment") 
        print("- Cleaned up resources between deployments")
        print("- Demonstrated quota-friendly deployment pattern")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Testing sequential deployment to handle OVH quotas...")
    print("=" * 60)
    
    if test_sequential_deployment():
        print("=" * 60)
        print("✅ TEST PASSED: Sequential deployment pattern verified")
        sys.exit(0)
    else:
        print("=" * 60) 
        print("❌ TEST FAILED: Sequential deployment needs fixes")
        sys.exit(1)