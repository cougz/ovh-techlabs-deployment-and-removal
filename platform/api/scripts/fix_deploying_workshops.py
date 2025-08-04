#!/usr/bin/env python3
"""
Script to fix workshops stuck in 'deploying' state.
This script will check all workshops with 'deploying' status and update them
based on their attendee deployment states.
"""

import sys
import os
sys.path.append('/app')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.workshop import Workshop
from models.attendee import Attendee
from services.workshop_status_service import WorkshopStatusService
from uuid import UUID
from datetime import datetime

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:TempPassword123!@postgres:5432/techlabs")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def fix_deploying_workshops():
    """Find and fix workshops stuck in deploying state."""
    db = SessionLocal()
    
    try:
        # Find all workshops in deploying state
        deploying_workshops = db.query(Workshop).filter(Workshop.status == 'deploying').all()
        
        if not deploying_workshops:
            print("No workshops found in 'deploying' state.")
            return
        
        print(f"Found {len(deploying_workshops)} workshop(s) in 'deploying' state.")
        
        for workshop in deploying_workshops:
            print(f"\nProcessing workshop: {workshop.name} (ID: {workshop.id})")
            
            # Get all attendees for this workshop
            attendees = db.query(Attendee).filter(Attendee.workshop_id == workshop.id).all()
            attendee_statuses = [a.status for a in attendees]
            
            print(f"  Attendee count: {len(attendees)}")
            print(f"  Attendee statuses: {attendee_statuses}")
            
            # Calculate what the status should be
            calculated_status = WorkshopStatusService.calculate_workshop_status_from_attendees(attendee_statuses)
            
            print(f"  Current status: {workshop.status}")
            print(f"  Calculated status: {calculated_status}")
            
            # Update the workshop status
            if workshop.status != calculated_status:
                workshop.status = calculated_status
                workshop.updated_at = datetime.utcnow()
                db.commit()
                print(f"  ✅ Updated workshop status to: {calculated_status}")
            else:
                print(f"  ℹ️  Status already correct")
                
        print("\nAll workshops processed successfully.")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_deploying_workshops()