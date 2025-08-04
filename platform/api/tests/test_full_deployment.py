#!/usr/bin/env python3
import requests
import json
import time
import sys

BASE_URL = "http://localhost"

def test_full_deployment():
    """Test complete deployment flow through API"""
    
    print("=" * 60)
    print("TechLabs Automation - Full Deployment Test")
    print("=" * 60)
    
    try:
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
            "name": "Test Workshop API",
            "description": "Testing deployment through API",
            "start_date": "2025-01-08T10:00:00Z",
            "end_date": "2025-01-09T18:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/workshops", 
                               headers=headers, json=workshop_data)
        if response.status_code != 200:
            print(f"❌ Workshop creation failed: {response.text}")
            return False
        
        workshop = response.json()
        workshop_id = workshop["id"]
        print(f"✅ Workshop created: {workshop_id}")
        
        # 3. Add attendee
        print("\n3. Adding attendee...")
        attendee_data = {
            "username": "testuser01",
            "email": "testuser01@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/attendees?workshop_id={workshop_id}",
                               headers=headers, json=attendee_data)
        if response.status_code != 200:
            print(f"❌ Attendee creation failed: {response.text}")
            return False
        
        attendee = response.json()
        print(f"✅ Attendee created: {attendee['id']}")
        
        # 4. Deploy workshop
        print("\n4. Starting deployment...")
        response = requests.post(f"{BASE_URL}/api/workshops/{workshop_id}/deploy",
                               headers=headers)
        if response.status_code != 200:
            print(f"❌ Deployment start failed: {response.text}")
            return False
        
        print("✅ Deployment initiated")
        deployment_response = response.json()
        print(f"Task ID: {deployment_response.get('task_id', 'N/A')}")
        
        # 5. Monitor deployment
        print("\n5. Monitoring deployment...")
        max_attempts = 60  # 5 minutes
        for i in range(max_attempts):
            print(f"Checking status... (attempt {i+1}/{max_attempts})")
            
            response = requests.get(f"{BASE_URL}/api/workshops/{workshop_id}",
                                  headers=headers)
            if response.status_code != 200:
                print(f"❌ Failed to get workshop status: {response.text}")
                break
                
            workshop = response.json()
            
            print(f"Workshop status: {workshop['status']}")
            
            # Also check attendee status
            response = requests.get(f"{BASE_URL}/api/attendees/workshop/{workshop_id}",
                                  headers=headers)
            if response.status_code == 200:
                attendees = response.json()
                if attendees:
                    print(f"Attendee status: {attendees[0]['status']}")
            
            if workshop['status'] == 'active':
                print("✅ Deployment successful!")
                
                # 6. Get credentials if successful
                print("\n6. Retrieving credentials...")
                response = requests.get(f"{BASE_URL}/api/attendees/{attendee['id']}/credentials",
                                      headers=headers)
                if response.status_code == 200:
                    creds = response.json()
                    print(f"✅ Credentials retrieved:")
                    print(f"   Username: {creds['username']}")
                    if 'ovh_project_id' in creds:
                        print(f"   Project ID: {creds['ovh_project_id']}")
                    else:
                        print("   Project ID: Not yet available")
                else:
                    print(f"⚠️  Could not retrieve credentials: {response.text}")
                
                return True
                
            elif workshop['status'] == 'failed':
                print("❌ Deployment failed!")
                
                # Get deployment logs
                print("\n7. Getting deployment logs...")
                response = requests.get(f"{BASE_URL}/api/deployments/workshop/{workshop_id}",
                                      headers=headers)
                if response.status_code == 200:
                    logs = response.json()
                    print(f"Found {len(logs)} log entries:")
                    for log in logs[-5:]:  # Show last 5 logs
                        status = log.get('status', 'unknown')
                        action = log.get('action', 'unknown')
                        created = log.get('created_at', 'unknown')
                        print(f"  [{created}] {action}: {status}")
                        if log.get('error_message'):
                            print(f"    Error: {log['error_message']}")
                        if log.get('terraform_output'):
                            # Show last few lines of terraform output
                            output_lines = log['terraform_output'].split('\n')
                            relevant_lines = [line for line in output_lines[-10:] if line.strip()]
                            if relevant_lines:
                                print(f"    Output: {relevant_lines[-1]}")
                else:
                    print(f"Could not retrieve logs: {response.text}")
                
                return False
            
            time.sleep(5)
        
        print("❌ Deployment timed out!")
        return False
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API server. Is it running?")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

def test_api_health():
    """Test that API is accessible"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ API health check passed")
            return True
        else:
            print(f"❌ API health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot reach API: {str(e)}")
        return False

if __name__ == "__main__":
    print("Testing API connectivity...")
    if not test_api_health():
        print("\n❌ API is not accessible. Please check that the API server is running.")
        sys.exit(1)
    
    success = test_full_deployment()
    
    print("\n" + "=" * 60)
    print(f"FINAL RESULT: {'✅ SUCCESS' if success else '❌ FAILED'}")
    
    if not success:
        print("\nTroubleshooting steps:")
        print("1. Check API logs: docker logs techlabs-api-prod")
        print("2. Check Celery worker logs: docker logs techlabs-celery-worker-prod")
        print("3. Run environment test: docker exec -it techlabs-celery-worker-prod python /app/tests/test_environment.py")
        print("4. Run Terraform test: docker exec -it techlabs-celery-worker-prod python /app/tests/test_terraform_minimal.py")
    
    sys.exit(0 if success else 1)