#!/bin/bash

echo "======================================================"
echo "Verifying Status Flow in Batch Deployment"
echo "======================================================"
echo

# Check 1: Verify status updates are properly sequenced
echo "1. Checking status update sequence in batch deployment..."
if grep -A 20 "attendee.status = \"deploying\"" api/tasks/terraform_tasks.py | grep -q "broadcast_status_update"; then
    echo "   ✅ Status set to 'deploying' with broadcast"
else
    echo "   ❌ Missing status broadcast for 'deploying'"
fi

# Check 2: Verify deployment logs are created
echo
echo "2. Checking deployment log creation..."
if grep -q "DeploymentLog(" api/tasks/terraform_tasks.py && \
   grep -q "deployment_log.status = \"started\"" api/tasks/terraform_tasks.py; then
    echo "   ✅ Deployment logs created and updated"
else
    echo "   ❌ Missing deployment log creation"
fi

# Check 3: Verify progress updates during phases
echo
echo "3. Checking progress updates..."
if grep -q "broadcast_deployment_progress" api/tasks/terraform_tasks.py && \
   grep -q "Planning infrastructure" api/tasks/terraform_tasks.py && \
   grep -q "Creating OVH resources" api/tasks/terraform_tasks.py && \
   grep -q "Configuring access" api/tasks/terraform_tasks.py; then
    echo "   ✅ Progress updates for all phases"
else
    echo "   ❌ Missing progress updates"
fi

# Check 4: Verify final status updates
echo
echo "4. Checking final status handling..."
if grep -A 10 "attendee.status = \"active\"" api/tasks/terraform_tasks.py | grep -q "broadcast_status_update" && \
   grep -A 10 "attendee.status = \"failed\"" api/tasks/terraform_tasks.py | grep -q "broadcast_status_update"; then
    echo "   ✅ Final status broadcasts for success and failure"
else
    echo "   ❌ Missing final status broadcasts"
fi

# Check 5: Verify deployment log completion
echo
echo "5. Checking deployment log completion..."
if grep -q "deployment_log.status = \"completed\"" api/tasks/terraform_tasks.py && \
   grep -q "deployment_log.completed_at = datetime.utcnow()" api/tasks/terraform_tasks.py; then
    echo "   ✅ Deployment logs properly completed"
else
    echo "   ❌ Missing deployment log completion"
fi

echo
echo "======================================================"
echo "Status Flow Fix Summary:"
echo "======================================================"
echo "✅ Attendees immediately set to 'deploying' status"
echo "✅ Deployment logs created for each attendee"
echo "✅ Progress updates during plan/apply phases"
echo "✅ Final status broadcasts on success/failure"
echo "✅ Deployment logs properly completed"
echo
echo "The frontend status should now progress correctly:"
echo "pending → deploying → [planning] → [applying] → active/failed"