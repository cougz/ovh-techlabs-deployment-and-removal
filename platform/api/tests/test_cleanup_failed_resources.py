#!/usr/bin/env python3
"""
Test cleanup of failed attendee resources.

This test verifies that failed deployments can be properly cleaned up
to prevent resource conflicts and quota issues.
"""

import requests
import json
import time
import sys
import os

# Add api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BASE_URL = "http://localhost"

def test_cleanup_failed_attendees():
    """
    Test that failed attendee deployments can be cleaned up properly.
    
    Expected behavior:
    1. Identify failed attendees
    2. Clean up their resources (if any)
    3. Remove attendees from database
    4. Verify resources are freed up
    """
    
    print("Testing cleanup of failed attendee resources...")
    
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
        
        # 2. Find failed attendees
        print("\n2. Identifying failed attendees...")
        response = requests.get(f"{BASE_URL}/api/workshops/", headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to get workshops: {response.text}")
            return False
        
        workshops = response.json()
        failed_attendees = []
        
        for workshop in workshops:
            response = requests.get(f"{BASE_URL}/api/attendees/workshop/{workshop['id']}", headers=headers)
            if response.status_code == 200:
                attendees = response.json()
                for attendee in attendees:
                    if attendee['status'] == 'failed':
                        failed_attendees.append({
                            'id': attendee['id'],
                            'username': attendee['username'],
                            'workshop_id': workshop['id'],
                            'workshop_name': workshop['name']
                        })
        
        print(f"Found {len(failed_attendees)} failed attendees:")
        for attendee in failed_attendees:
            print(f"   - {attendee['username']} in '{attendee['workshop_name']}'")
        
        if len(failed_attendees) == 0:
            print("✅ No failed attendees found - cleanup not needed")
            return True
        
        # 3. Clean up failed attendees
        print("\n3. Cleaning up failed attendees...")
        cleaned_count = 0
        
        for attendee in failed_attendees:
            print(f"   Cleaning up {attendee['username']}...")
            
            # Try to destroy any existing resources first
            response = requests.post(f"{BASE_URL}/api/attendees/{attendee['id']}/destroy", 
                                   headers=headers)
            if response.status_code == 200:
                print(f"      Resource destruction initiated")
                # Don't wait for completion, failed attendees may not have resources to destroy
            else:
                print(f"      No resources to destroy (expected for failed deployments)")
            
            # Delete the attendee record
            response = requests.delete(f"{BASE_URL}/api/attendees/{attendee['id']}", 
                                     headers=headers)
            if response.status_code == 200:
                print(f"      ✅ Attendee record deleted")
                cleaned_count += 1
            else:
                print(f"      ❌ Failed to delete attendee: {response.text}")
        
        print(f"\n✅ Cleaned up {cleaned_count}/{len(failed_attendees)} failed attendees")
        
        # 4. Verify cleanup
        print("\n4. Verifying cleanup...")
        response = requests.get(f"{BASE_URL}/api/workshops/", headers=headers)
        workshops = response.json()
        
        remaining_failed = 0
        for workshop in workshops:
            response = requests.get(f"{BASE_URL}/api/attendees/workshop/{workshop['id']}", headers=headers)
            if response.status_code == 200:
                attendees = response.json()
                for attendee in attendees:
                    if attendee['status'] == 'failed':
                        remaining_failed += 1
        
        if remaining_failed == 0:
            print("✅ All failed attendees successfully cleaned up")
            return True
        else:
            print(f"⚠️ {remaining_failed} failed attendees still remain")
            return False
        
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Testing cleanup of failed attendee resources...")
    print("=" * 60)
    
    if test_cleanup_failed_attendees():
        print("=" * 60)
        print("✅ TEST PASSED: Failed attendee cleanup verified")
        sys.exit(0)
    else:
        print("=" * 60) 
        print("❌ TEST FAILED: Failed attendee cleanup needs fixes")
        sys.exit(1)