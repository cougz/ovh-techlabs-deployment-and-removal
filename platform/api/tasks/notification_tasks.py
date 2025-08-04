import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

from core.celery_app import celery_app
from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

@celery_app.task
def send_email_notification(to_email: str, subject: str, body: str, html_body: str = None):
    """Send email notification."""
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
        logger.warning("SMTP not configured, skipping email notification")
        return
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Add text body
        text_part = MIMEText(body, 'plain')
        msg.attach(text_part)
        
        # Add HTML body if provided
        if html_body:
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
        
        # Send email
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Email sent successfully to {to_email}")
        
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {str(e)}")
        raise

@celery_app.task
def send_workshop_credentials(attendee_email: str, attendee_name: str, workshop_name: str, credentials: dict):
    """Send workshop credentials to attendee."""
    subject = f"Workshop Credentials - {workshop_name}"
    
    body = f"""
Dear {attendee_name},

Your workshop environment is ready! Here are your access credentials:

Workshop: {workshop_name}
Username: {credentials.get('username', 'N/A')}
Password: {credentials.get('password', 'N/A')}
OVH Project ID: {credentials.get('ovh_project_id', 'N/A')}

Please keep these credentials secure and do not share them with others.

Best regards,
TechLabs Automation Team
"""
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f4f4f4; padding: 20px; text-align: center; }}
        .credentials {{ background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px; }}
        .warning {{ background-color: #fff3cd; padding: 10px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Workshop Credentials</h2>
        </div>
        
        <p>Dear {attendee_name},</p>
        
        <p>Your workshop environment is ready! Here are your access credentials:</p>
        
        <div class="credentials">
            <h3>Workshop: {workshop_name}</h3>
            <p><strong>Username:</strong> {credentials.get('username', 'N/A')}</p>
            <p><strong>Password:</strong> {credentials.get('password', 'N/A')}</p>
            <p><strong>OVH Project ID:</strong> {credentials.get('ovh_project_id', 'N/A')}</p>
        </div>
        
        <div class="warning">
            <p><strong>Important:</strong> Please keep these credentials secure and do not share them with others.</p>
        </div>
        
        <p>Best regards,<br>TechLabs Automation Team</p>
    </div>
</body>
</html>
"""
    
    send_email_notification.delay(attendee_email, subject, body, html_body)

@celery_app.task
def send_cleanup_warning_notification(attendee_email: str, attendee_name: str, workshop_name: str, deletion_time: str):
    """Send environment cleanup warning notification."""
    subject = f"Environment Cleanup Notice - {workshop_name}"
    
    # Parse deletion time for display
    from datetime import datetime
    try:
        deletion_dt = datetime.fromisoformat(deletion_time.replace('Z', '+00:00'))
        deletion_formatted = deletion_dt.strftime("%B %d, %Y at %I:%M %p UTC")
    except:
        deletion_formatted = deletion_time
    
    body = f"""
Dear {attendee_name},

Your workshop environment for "{workshop_name}" will be automatically cleaned up in approximately 24 hours.

Important Information:
- Workshop environments are automatically deleted 1 hour after the workshop end date
- Your environment will be deleted on: {deletion_formatted}
- All data, configurations, and resources will be permanently removed

Action Required:
If you need to save any work, configurations, or data from your workshop environment, please do so within the next 24 hours. After deletion, this data cannot be recovered.

What will be deleted:
- Your OVH Cloud Project and all associated resources
- Any configurations, files, or data you created during the workshop
- Access credentials and project permissions

Thank you for participating in our workshop!

Best regards,
TechLabs Automation Team
"""
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f4f4f4; padding: 20px; text-align: center; }}
        .warning {{ background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107; }}
        .important {{ background-color: #f8d7da; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #dc3545; }}
        .details {{ background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Environment Cleanup Notice</h2>
        </div>
        
        <p>Dear {attendee_name},</p>
        
        <p>Your workshop environment for <strong>"{workshop_name}"</strong> will be automatically cleaned up in approximately 24 hours.</p>
        
        <div class="important">
            <h3>⚠️ Action Required</h3>
            <p>If you need to save any work, configurations, or data from your workshop environment, please do so within the next 24 hours. After deletion, this data cannot be recovered.</p>
        </div>
        
        <div class="details">
            <h3>Important Information</h3>
            <ul>
                <li>Workshop environments are automatically deleted 1 hour after the workshop end date</li>
                <li><strong>Your environment will be deleted on:</strong> {deletion_formatted}</li>
                <li>All data, configurations, and resources will be permanently removed</li>
            </ul>
        </div>
        
        <div class="warning">
            <h3>What will be deleted:</h3>
            <ul>
                <li>Your OVH Cloud Project and all associated resources</li>
                <li>Any configurations, files, or data you created during the workshop</li>
                <li>Access credentials and project permissions</li>
            </ul>
        </div>
        
        <p>Thank you for participating in our workshop!</p>
        
        <p>Best regards,<br>TechLabs Automation Team</p>
    </div>
</body>
</html>
"""
    
    send_email_notification.delay(attendee_email, subject, body, html_body)

