# State Machine Design for TechLabs Automation

## Overview

This document defines the clear state transitions for workshops and attendees as required by STATE-MANAGEMENT-REVAMP-001. The goal is to ensure consistent state display across all frontend components.

## Workshop State Machine

### States and Transitions

```
┌─────────────┐    create workshop    ┌─────────────┐
│   Initial   │ ───────────────────> │  planning   │
└─────────────┘                      └─────────────┘
                                           │
                                           │ deploy_workshop
                                           ▼
                                     ┌─────────────┐
                                     │ deploying   │ ◄───┐
                                     └─────────────┘     │
                                           │             │ retry_deployment
                                           │ deployment  │
                                           │ complete    │
                                           ▼             │
┌─────────────┐    cleanup_resources ┌─────────────┐     │
│  completed  │ ◄─────────────────── │   active    │     │
└─────────────┘                      └─────────────┘     │
      │                                    │             │
      │                                    │ deployment  │
      │                              ┌─────┴─────┐       │
      │                              │           │       │
      │                              ▼           ▼       │
      │                        ┌─────────────┐ ┌─────────┴───┐
      │ manual_cleanup         │  deleting   │ │   failed    │
      │                        └─────────────┘ └─────────────┘
      │                              │               │
      │ ◄────────────────────────────┘               │
      │                                              │
      │ ◄────────────────────────────────────────────┘
      │                      retry_from_failed
      ▼
┌─────────────┐
│   deleted   │
└─────────────┘
```

### Workshop State Definitions

| State | Description | Conditions |
|-------|-------------|------------|
| `planning` | Workshop created, attendees may be added, but none are deployed | - Workshop exists<br>- No attendees deployed |
| `deploying` | Deployment in progress for one or more attendees | - At least one attendee has status `deploying` |
| `active` | All attendees successfully deployed | - All attendees have status `active`<br>- No attendees in `deploying` or `failed` state |
| `failed` | Workshop deployment failed | - One or more attendees have status `failed`<br>- No active deployments |
| `deleting` | Cleanup in progress | - Cleanup initiated<br>- Resources being destroyed |
| `completed` | Workshop ended, resources cleaned up | - Workshop end date passed<br>- All resources cleaned up |
| `deleted` | Workshop permanently removed | - Workshop deleted from system |

### Workshop State Validation Rules

```typescript
interface WorkshopStateRules {
  planning: {
    canTransitionTo: ['deploying', 'deleted'];
    conditions: {
      attendeeStates: 'all planning or no attendees';
      deploymentInProgress: false;
    };
  };
  deploying: {
    canTransitionTo: ['active', 'failed', 'planning'];
    conditions: {
      attendeeStates: 'at least one deploying';
      hasActiveDeployments: true;
    };
  };
  active: {
    canTransitionTo: ['deleting', 'completed', 'failed'];
    conditions: {
      attendeeStates: 'all active';
      allDeploymentsSuccessful: true;
    };
  };
  failed: {
    canTransitionTo: ['deploying', 'deleting', 'deleted'];
    conditions: {
      attendeeStates: 'at least one failed';
      noActiveDeployments: true;
    };
  };
  deleting: {
    canTransitionTo: ['completed', 'failed'];
    conditions: {
      cleanupInProgress: true;
    };
  };
  completed: {
    canTransitionTo: ['deleted'];
    conditions: {
      allResourcesCleaned: true;
    };
  };
  deleted: {
    canTransitionTo: [];
    conditions: {
      workshopRemoved: true;
    };
  };
}
```

## Attendee State Machine

### States and Transitions

```
┌─────────────┐    create attendee    ┌─────────────┐
│   Initial   │ ───────────────────> │  planning   │
└─────────────┘                      └─────────────┘
                                           │
                                           │ deploy_attendee
                                           ▼
                                     ┌─────────────┐
                                     │ deploying   │ ◄───┐
                                     └─────────────┘     │
                                           │             │ retry_deployment
                                           │ deployment  │
                                           │ success     │
                                           ▼             │
┌─────────────┐    destroy_resources ┌─────────────┐     │
│ destroyed   │ ◄─────────────────── │   active    │     │
└─────────────┘                      └─────────────┘     │
      ▲                                    │             │
      │                                    │ deployment  │
      │                              ┌─────┴─────┐       │
      │                              │           │       │
      │                              ▼           ▼       │
      │                        ┌─────────────┐ ┌─────────┴───┐
      │ successful_cleanup     │  deleting   │ │   failed    │
      │                        └─────────────┘ └─────────────┘
      │                              │               │
      │ ◄────────────────────────────┘               │
      │                                              │
      │ ◄────────────────────────────────────────────┘
      │                      retry_from_failed
      │
      │ cleanup_failed
      ▼
┌─────────────┐
│   failed    │ (cleanup failure)
└─────────────┘
```

### Attendee State Definitions

| State | Description | Conditions |
|-------|-------------|------------|
| `planning` | Attendee created but not deployed | - Attendee exists in database<br>- No OVH resources allocated |
| `deploying` | Terraform deployment in progress | - Deploy task initiated<br>- Terraform apply running |
| `active` | Successfully deployed with OVH resources | - Terraform apply successful<br>- OVH project created<br>- IAM user created |
| `failed` | Deployment failed | - Terraform apply failed<br>- Maximum retries exceeded<br>- Non-recoverable error |
| `deleting` | Cleanup in progress | - Destroy task initiated<br>- Terraform destroy running |
| `destroyed` | Resources successfully cleaned up | - Terraform destroy successful<br>- All OVH resources removed |

### Attendee State Validation Rules

```typescript
interface AttendeeStateRules {
  planning: {
    canTransitionTo: ['deploying'];
    conditions: {
      hasOvhResources: false;
      deploymentNotStarted: true;
    };
  };
  deploying: {
    canTransitionTo: ['active', 'failed'];
    conditions: {
      deploymentInProgress: true;
      terraformTaskActive: true;
    };
  };
  active: {
    canTransitionTo: ['deleting', 'failed'];
    conditions: {
      hasOvhProjectId: true;
      hasOvhUserUrn: true;
      terraformStateExists: true;
    };
  };
  failed: {
    canTransitionTo: ['deploying', 'deleting'];
    conditions: {
      deploymentFailed: true;
      errorMessageExists: true;
    };
  };
  deleting: {
    canTransitionTo: ['destroyed', 'failed'];
    conditions: {
      cleanupInProgress: true;
      terraformDestroyActive: true;
    };
  };
  destroyed: {
    canTransitionTo: [];
    conditions: {
      ovhResourcesRemoved: true;
      terraformStateCleared: true;
    };
  };
}
```

## State Synchronization Rules

### Workshop-Attendee Relationship

The workshop state is derived from its attendees' states according to these rules:

```typescript
function calculateWorkshopState(attendees: Attendee[]): WorkshopStatus {
  if (attendees.length === 0) return 'planning';
  
  const states = attendees.map(a => a.status);
  
  // If any attendee is deploying, workshop is deploying
  if (states.some(s => s === 'deploying')) {
    return 'deploying';
  }
  
  // If all attendees are active, workshop is active
  if (states.every(s => s === 'active')) {
    return 'active';
  }
  
  // If any attendee failed and no deployments active, workshop failed
  if (states.some(s => s === 'failed') && !states.some(s => s === 'deploying')) {
    return 'failed';
  }
  
  // If any attendee is deleting, workshop is deleting
  if (states.some(s => s === 'deleting')) {
    return 'deleting';
  }
  
  // If all attendees are destroyed, workshop is completed
  if (states.every(s => s === 'destroyed')) {
    return 'completed';
  }
  
  // Default to planning for mixed states
  return 'planning';
}
```

## Implementation Guidelines

### 1. State Machine Implementation

```typescript
// State machine context
interface StateContext {
  workshopId: string;
  attendeeIds: string[];
  currentState: WorkshopStatus | AttendeeStatus;
  previousState?: WorkshopStatus | AttendeeStatus;
  metadata: Record<string, any>;
}

// State machine actions
type StateAction = 
  | { type: 'DEPLOY_WORKSHOP' }
  | { type: 'DEPLOYMENT_SUCCESS' }
  | { type: 'DEPLOYMENT_FAILED'; error: string }
  | { type: 'CLEANUP_RESOURCES' }
  | { type: 'CLEANUP_SUCCESS' }
  | { type: 'CLEANUP_FAILED'; error: string };
```

### 2. State Validation

```typescript
function validateStateTransition(
  fromState: WorkshopStatus,
  toState: WorkshopStatus,
  context: StateContext
): boolean {
  const rules = WorkshopStateRules[fromState];
  return rules.canTransitionTo.includes(toState) && 
         validateConditions(rules.conditions, context);
}
```

### 3. Optimistic Updates

```typescript
function handleOptimisticStateUpdate(
  action: StateAction,
  currentState: WorkshopStatus
): WorkshopStatus {
  switch (action.type) {
    case 'DEPLOY_WORKSHOP':
      return currentState === 'planning' ? 'deploying' : currentState;
    case 'CLEANUP_RESOURCES':
      return ['active', 'failed'].includes(currentState) ? 'deleting' : currentState;
    default:
      return currentState;
  }
}
```

### 4. Error Handling

```typescript
interface StateError {
  type: 'INVALID_TRANSITION' | 'CONDITION_NOT_MET' | 'SYNC_CONFLICT';
  message: string;
  currentState: string;
  attemptedState: string;
  context: StateContext;
}
```

This state machine design ensures consistent and predictable state transitions across the entire application, addressing the core issues identified in STATE-MANAGEMENT-REVAMP-001.