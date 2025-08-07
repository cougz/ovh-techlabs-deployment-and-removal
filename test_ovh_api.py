#!/usr/bin/env python3
import ovh
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize client
client = ovh.Client(
    endpoint=os.getenv('OVH_ENDPOINT', 'ovh-eu'),
    application_key=os.getenv('OVH_APPLICATION_KEY'),
    application_secret=os.getenv('OVH_APPLICATION_SECRET'),
    consumer_key=os.getenv('OVH_CONSUMER_KEY')
)

print("Testing OVH API endpoints...")
print(f"Endpoint: {os.getenv('OVH_ENDPOINT')}")
print(f"App Key: {os.getenv('OVH_APPLICATION_KEY')[:8]}...")
print("-" * 50)

# Test different endpoint variations
test_endpoints = [
    "/v1/services",
    "/services",
    "/1.0/services",
    "/v1/cloud/project",
    "/cloud/project",
    "/1.0/cloud/project",
    "/v1/me",
    "/me",
    "/v1/me/identity/user",
    "/me/identity/user",
    "/v2/iam/policy",
    "/iam/policy",
]

for endpoint in test_endpoints:
    try:
        print(f"\nTesting {endpoint}...")
        result = client.get(endpoint)
        print(f"  ✓ Success! Got {len(result) if isinstance(result, list) else 'response'}")
        if isinstance(result, list) and len(result) > 0:
            print(f"    First item: {result[0]}")
    except Exception as e:
        print(f"  ✗ Error: {str(e)}")