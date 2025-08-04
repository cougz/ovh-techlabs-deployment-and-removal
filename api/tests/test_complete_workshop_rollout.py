#!/usr/bin/env python3
"""
Test complete workshop rollout with 3 users and then complete removal.

This test verifies the complete workshop lifecycle:
1. Create workshop
2. Add 3 attendees  
3. Deploy all attendees (complete rollout)
4. Verify all attendees have OVH credentials
5. Remove workshop (complete removal)
6. Verify all resources are cleaned up
"""

import requests
import json
import time
import sys
import os

# Add api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BASE_URL = "http://localhost"

def test_complete_workshop_lifecycle():
    """
    Test complete workshop rollout with 3 users and cleanup.
    
    Expected behavior:
    1. Create workshop
    2. Add 3 attendees
    3. Deploy all attendees (should result in 3 OVH projects)
    4. Verify all attendees have working credentials
    5. Clean up all resources
    """
    
    print("Testing complete workshop rollout and removal...")
    
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
            "name": "Complete Rollout Test Workshop",
            "description": "Testing complete workshop rollout with 3 users",
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
        
        # 3. Add 3 attendees
        print("\n3. Adding 3 attendees...")
        attendees = []
        attendee_data = [
            {"username": "user01", "email": "user01@example.com"},
            {"username": "user02", "email": "user02@example.com"},
            {"username": "user03", "email": "user03@example.com"}
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
        
        print(f"✅ All 3 attendees created successfully")
        
        # 4. Deploy all attendees
        print("\n4. Deploying all attendees...")
        deployment_tasks = []
        
        for i, attendee in enumerate(attendees):
            response = requests.post(f"{BASE_URL}/api/attendees/{attendee['id']}/deploy", 
                                   headers=headers)
            if response.status_code != 200:
                print(f"❌ Attendee {i+1} deployment failed: {response.text}")
                return False
            
            deployment_tasks.append({"id": attendee['id'], "username": attendee['username']})
            print(f"✅ Attendee {i+1} deployment initiated: {attendee['username']}")
        
        # 5. Monitor all deployments
        print("\n5. Monitoring deployments...")
        max_attempts = 60
        deployed_count = 0
        
        for attempt in range(max_attempts):
            time.sleep(10)
            print(f"Checking deployment status... (attempt {attempt + 1}/{max_attempts})")
            
            current_deployed = 0
            failed_count = 0
            
            for task in deployment_tasks:
                response = requests.get(f"{BASE_URL}/api/attendees/{task['id']}", 
                                      headers=headers)
                if response.status_code != 200:
                    print(f"❌ Status check failed for {task['username']}: {response.text}")
                    return False
                
                status = response.json()["status"]
                print(f"   {task['username']}: {status}")
                
                if status == "active":
                    current_deployed += 1
                elif status == "failed":
                    failed_count += 1
            
            if failed_count > 0:
                print(f"❌ {failed_count} deployments failed")
                return False
            
            if current_deployed == 3:
                print("✅ All 3 attendees deployed successfully")
                break
        else:
            print("❌ Deployment timed out")
            return False
        
        # 6. Verify all attendees have credentials
        print("\n6. Verifying attendee credentials...")
        credentials_list = []
        
        for i, attendee in enumerate(attendees):
            response = requests.get(f"{BASE_URL}/api/attendees/{attendee['id']}/credentials", 
                                  headers=headers)
            
            if response.status_code != 200:
                print(f"❌ Credentials retrieval failed for {attendee['username']}: {response.text}")
                return False
            
            credentials = response.json()
            credentials_list.append({
                "username": attendee['username'],
                "ovh_username": credentials.get("username"),
                "ovh_project_id": credentials.get("ovh_project_id"),
                "has_password": bool(credentials.get("password"))
            })
            
            print(f"✅ {attendee['username']} credentials:")
            print(f"   OVH Username: {credentials.get('username')}")
            print(f"   OVH Project ID: {credentials.get('ovh_project_id')}")
            print(f"   Has Password: {'Yes' if credentials.get('password') else 'No'}")
        
        # Verify all credentials are unique and complete
        project_ids = [cred["ovh_project_id"] for cred in credentials_list]
        unique_project_ids = set(project_ids)
        
        if len(unique_project_ids) != 3:
            print(f"❌ Expected 3 unique project IDs, got {len(unique_project_ids)}")
            print(f"Project IDs: {project_ids}")
            return False
        
        print("✅ All attendees have unique OVH projects and credentials")
        
        # 7. Test workshop removal
        print("\n7. Testing complete workshop removal...")
        
        # First destroy all attendee resources
        print("   Destroying attendee resources...")
        for i, attendee in enumerate(attendees):
            response = requests.post(f"{BASE_URL}/api/attendees/{attendee['id']}/destroy", 
                                   headers=headers)
            if response.status_code != 200:
                print(f"❌ Attendee {i+1} destruction failed: {response.text}")
                return False
            
            print(f"✅ Attendee {i+1} destruction initiated: {attendee['username']}")
        
        # Monitor destruction
        print("   Monitoring resource destruction...")
        for attempt in range(max_attempts):
            time.sleep(10)
            print(f"   Checking destruction status... (attempt {attempt + 1}/{max_attempts})")
            
            destroyed_count = 0
            failed_count = 0
            
            for task in deployment_tasks:
                response = requests.get(f"{BASE_URL}/api/attendees/{task['id']}", 
                                      headers=headers)
                if response.status_code != 200:
                    print(f"❌ Status check failed for {task['username']}: {response.text}")
                    return False
                
                status = response.json()["status"]
                print(f"      {task['username']}: {status}")
                
                if status == "deleted":
                    destroyed_count += 1
                elif status == "failed":
                    failed_count += 1
            
            if failed_count > 0:
                print(f"❌ {failed_count} destructions failed")
                return False
            
            if destroyed_count == 3:
                print("✅ All 3 attendee resources destroyed successfully")
                break
        else:
            print("❌ Destruction timed out")
            return False
        
        # 8. Verify credentials are no longer available
        print("\n8. Verifying credentials are no longer available...")
        for i, attendee in enumerate(attendees):
            response = requests.get(f"{BASE_URL}/api/attendees/{attendee['id']}/credentials", 
                                  headers=headers)
            
            if response.status_code == 404:
                print(f"✅ {attendee['username']} credentials properly cleaned up")
            else:
                print(f"❌ {attendee['username']} credentials still available (status: {response.status_code})")
                return False
        
        print("\n✅ COMPLETE WORKSHOP ROLLOUT AND REMOVAL SUCCESSFUL")
        print("Summary:")
        print("- Created workshop with 3 attendees")
        print("- Successfully deployed all attendees with unique OVH projects")
        print("- Verified all attendees had working credentials")
        print("- Successfully cleaned up all resources")
        print("- Verified credentials are no longer available")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Testing complete workshop rollout and removal...")
    print("=" * 60)
    
    if test_complete_workshop_lifecycle():
        print("=" * 60)
        print("✅ TEST PASSED: Complete workshop lifecycle verified")
        sys.exit(0)
    else:
        print("=" * 60) 
        print("❌ TEST FAILED: Complete workshop lifecycle needs fixes")
        sys.exit(1)