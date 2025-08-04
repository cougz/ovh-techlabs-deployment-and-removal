#!/usr/bin/env python3
"""
Test script to demonstrate Terraform functionality with the workshop system.
This script will:
1. Add attendees to an existing workshop 
2. Trigger Terraform deployment for testing
3. Show the deployment process
"""

import requests
import json
import time
import sys
from datetime import datetime, timedelta

# Configuration
API_BASE = "http://localhost:8000/api"
WORKSHOP_ID = "480b4c78-5e36-4def-a0ce-db73d2d93f2d"  # The workshop you created
AUTH_TOKEN = "admin-token"  # Simple auth for testing

# Headers for API requests
headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

def make_request(method, endpoint, data=None):
    """Make API request with error handling."""
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        print(f"{method} {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code < 400:
            return response.json() if response.content else {}
        else:
            print(f"Error: {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Make sure the containers are running.")
        return None
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return None

def add_test_attendees():
    """Add test attendees to the workshop."""
    print("\n🧪 Adding test attendees to workshop...")
    
    attendees = [
        {"username": "alice.smith", "email": "alice.smith@example.com"},
        {"username": "bob.johnson", "email": "bob.johnson@example.com"},
        {"username": "charlie.brown", "email": "charlie.brown@example.com"}
    ]
    
    created_attendees = []
    for attendee in attendees:
        print(f"\n📝 Adding attendee: {attendee['username']}")
        result = make_request("POST", f"/attendees?workshop_id={WORKSHOP_ID}", attendee)
        if result:
            created_attendees.append(result)
            print(f"✅ Created attendee: {result.get('id', 'Unknown ID')}")
        else:
            print(f"❌ Failed to create attendee: {attendee['username']}")
    
    return created_attendees

def get_workshop_info():
    """Get current workshop information."""
    print(f"\n📋 Getting workshop information...")
    workshop = make_request("GET", f"/workshops/{WORKSHOP_ID}")
    if workshop:
        print(f"✅ Workshop: {workshop.get('name', 'Unknown')}")
        print(f"   Status: {workshop.get('status', 'Unknown')}")
        print(f"   Start: {workshop.get('start_date', 'Unknown')}")
        print(f"   End: {workshop.get('end_date', 'Unknown')}")
        return workshop
    return None

def list_attendees():
    """List all attendees in the workshop."""
    print(f"\n👥 Getting workshop attendees...")
    attendees = make_request("GET", f"/attendees/workshop/{WORKSHOP_ID}")
    if attendees:
        print(f"✅ Found {len(attendees)} attendees:")
        for attendee in attendees:
            print(f"   - {attendee.get('username', 'Unknown')} ({attendee.get('status', 'Unknown')})")
        return attendees
    return []

def deploy_workshop():
    """Deploy workshop resources using Terraform."""
    print(f"\n🚀 Deploying workshop resources...")
    result = make_request("POST", f"/workshops/{WORKSHOP_ID}/deploy")
    if result:
        print(f"✅ Deployment started!")
        print(f"   Message: {result.get('message', 'Unknown')}")
        print(f"   Task IDs: {result.get('task_ids', [])}")
        print(f"   Attendee count: {result.get('attendee_count', 0)}")
        return result.get('task_ids', [])
    return []

def monitor_deployment(task_ids, max_wait_seconds=300):
    """Monitor deployment progress."""
    print(f"\n⏳ Monitoring deployment progress...")
    start_time = time.time()
    
    while time.time() - start_time < max_wait_seconds:
        print(f"\n🔍 Checking attendee status...")
        attendees = list_attendees()
        
        if not attendees:
            print("❌ No attendees found")
            return False
        
        statuses = [a.get('status', 'unknown') for a in attendees]
        print(f"   Statuses: {statuses}")
        
        # Check if all are deployed or failed
        if all(status in ['active', 'failed'] for status in statuses):
            print(f"\n✅ Deployment completed!")
            active_count = sum(1 for s in statuses if s == 'active')
            failed_count = sum(1 for s in statuses if s == 'failed')
            print(f"   Active: {active_count}, Failed: {failed_count}")
            return True
        
        print("   ⏳ Still deploying, waiting 10 seconds...")
        time.sleep(10)
    
    print(f"\n⚠️ Timeout after {max_wait_seconds} seconds")
    return False

def cleanup_workshop():
    """Cleanup workshop resources."""
    print(f"\n🧹 Cleaning up workshop resources...")
    result = make_request("DELETE", f"/workshops/{WORKSHOP_ID}/resources")
    if result:
        print(f"✅ Cleanup started!")
        print(f"   Message: {result.get('message', 'Unknown')}")
        print(f"   Task IDs: {result.get('task_ids', [])}")
        return True
    return False

def main():
    """Main test function."""
    print("🔬 TechLabs Automation - Terraform Testing Script")
    print("=" * 60)
    
    # Get initial workshop info
    workshop = get_workshop_info()
    if not workshop:
        print("❌ Failed to get workshop information")
        return 1
    
    # List current attendees
    attendees = list_attendees()
    
    # Add attendees if none exist
    if not attendees:
        print("\n📝 No attendees found, adding test attendees...")
        created_attendees = add_test_attendees()
        if not created_attendees:
            print("❌ Failed to create test attendees")
            return 1
    else:
        print(f"\n✅ Found {len(attendees)} existing attendees")
    
    # Deploy workshop
    task_ids = deploy_workshop()
    if not task_ids:
        print("❌ Failed to start deployment")
        return 1
    
    # Monitor deployment
    success = monitor_deployment(task_ids)
    
    # Show final status
    print(f"\n📊 Final Status:")
    final_attendees = list_attendees()
    for attendee in final_attendees:
        status = attendee.get('status', 'unknown')
        print(f"   {attendee.get('username', 'Unknown')}: {status}")
        if status == 'active':
            project_id = attendee.get('ovh_project_id', 'Not set')
            user_urn = attendee.get('ovh_user_urn', 'Not set')
            print(f"     OVH Project ID: {project_id}")
            print(f"     OVH User URN: {user_urn}")
    
    # Ask if user wants to cleanup
    response = input(f"\n🧹 Would you like to cleanup the workshop resources? (y/N): ")
    if response.lower() in ['y', 'yes']:
        cleanup_workshop()
        print("\n⏳ Cleanup initiated. Monitor the attendee statuses to see progress.")
    
    print(f"\n✅ Test completed!")
    return 0

if __name__ == "__main__":
    sys.exit(main())