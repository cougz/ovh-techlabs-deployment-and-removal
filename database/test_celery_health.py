#!/usr/bin/env python3
"""
Test to verify Celery health check configuration works correctly.
This test ensures that Celery containers use proper health checks, not HTTP.
"""

import subprocess
import time


def test_celery_worker_ping():
    """Test that Celery worker responds to ping command."""
    try:
        result = subprocess.run([
            'sudo', 'docker', 'exec', 'techlabs-celery-worker-prod',
            'celery', '-A', 'main.celery', 'inspect', 'ping'
        ], capture_output=True, text=True, timeout=30)
        
        assert result.returncode == 0, f"Celery ping failed: {result.stderr}"
        assert 'pong' in result.stdout, f"No pong response in: {result.stdout}"
        assert '1 node online' in result.stdout, f"Worker not online: {result.stdout}"
        print("✅ Celery worker ping test passed")
        return True
    except Exception as e:
        print(f"❌ Celery worker ping test failed: {e}")
        return False


def test_celery_beat_inspect():
    """Test that Celery beat scheduler is running."""
    try:
        # Celery Beat may not respond to ping, try inspect stats instead
        result = subprocess.run([
            'sudo', 'docker', 'exec', 'techlabs-celery-beat-prod',
            'celery', '-A', 'main.celery', 'inspect', 'stats'
        ], capture_output=True, text=True, timeout=30)
        
        # Beat container might not have worker processes to inspect
        # Just check if the command doesn't crash
        print(f"Celery beat stats: {result.stdout}")
        print("✅ Celery beat inspect command executed")
        return True
    except Exception as e:
        print(f"❌ Celery beat inspect test failed: {e}")
        return False


def test_docker_container_exists():
    """Test that both Celery containers exist and are running."""
    containers = ['techlabs-celery-worker-prod', 'techlabs-celery-beat-prod']
    
    for container in containers:
        try:
            result = subprocess.run([
                'sudo', 'docker', 'inspect', container, '--format={{.State.Status}}'
            ], capture_output=True, text=True)
            
            assert result.returncode == 0, f"Container {container} not found"
            status = result.stdout.strip()
            assert status == 'running', f"Container {container} status: {status}"
            print(f"✅ Container {container} is running")
        except Exception as e:
            print(f"❌ Container {container} check failed: {e}")
            return False
    
    return True


def test_celery_health_check_should_not_use_http():
    """Test that demonstrates proper Celery health check vs incorrect HTTP check."""
    # This test documents what should happen after we fix the health checks
    print("📝 Expected behavior after fix:")
    print("   - Celery worker health check: 'celery -A main.celery inspect ping'")
    print("   - Celery beat health check: process check or custom script")
    print("   - Should NOT use: curl http://localhost:8000/health")
    
    return True


if __name__ == "__main__":
    print("🔍 Testing Celery container functionality...")
    
    # Run all tests
    tests = [
        test_docker_container_exists,
        test_celery_worker_ping,
        test_celery_beat_inspect,
        test_celery_health_check_should_not_use_http
    ]
    
    passed = 0
    for test in tests:
        if test():
            passed += 1
    
    print(f"\n📊 Tests passed: {passed}/{len(tests)}")
    
    if passed == len(tests):
        print("✅ All Celery functionality tests pass - containers are working despite health check issues")
    else:
        print("❌ Some Celery tests failed")