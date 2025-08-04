-- TechLabs Automation Database Schema

-- Create database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workshops table
CREATE TABLE workshops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL,
    template VARCHAR(50) DEFAULT 'Generic' NOT NULL,
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'deploying', 'active', 'completed', 'failed', 'deleting')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deletion_scheduled_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Attendees table
CREATE TABLE attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    ovh_project_id VARCHAR(100),
    ovh_user_urn VARCHAR(255),
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'deploying', 'active', 'failed', 'deleting', 'deleted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(workshop_id, username),
    UNIQUE(workshop_id, email)
);

-- Deployment logs table
CREATE TABLE deployment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('deploy', 'destroy', 'plan', 'apply')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'running', 'completed', 'failed')),
    terraform_output TEXT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Credentials table (encrypted storage)
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(attendee_id)
);

-- Workshop templates table (for future use)
CREATE TABLE workshop_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    terraform_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_workshops_status ON workshops(status);
CREATE INDEX idx_workshops_start_date ON workshops(start_date);
CREATE INDEX idx_workshops_end_date ON workshops(end_date);
CREATE INDEX idx_workshops_deletion_scheduled ON workshops(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;

CREATE INDEX idx_attendees_workshop_id ON attendees(workshop_id);
CREATE INDEX idx_attendees_status ON attendees(status);
CREATE INDEX idx_attendees_ovh_project_id ON attendees(ovh_project_id) WHERE ovh_project_id IS NOT NULL;

CREATE INDEX idx_deployment_logs_attendee_id ON deployment_logs(attendee_id);
CREATE INDEX idx_deployment_logs_status ON deployment_logs(status);
CREATE INDEX idx_deployment_logs_started_at ON deployment_logs(started_at);

CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_workshops_updated_at BEFORE UPDATE ON workshops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendees_updated_at BEFORE UPDATE ON attendees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workshop_templates_updated_at BEFORE UPDATE ON workshop_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create audit triggers
CREATE TRIGGER audit_workshops AFTER INSERT OR UPDATE OR DELETE ON workshops
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_attendees AFTER INSERT OR UPDATE OR DELETE ON attendees
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Create views for common queries
CREATE VIEW workshop_summary AS
SELECT 
    w.id,
    w.name,
    w.description,
    w.start_date,
    w.end_date,
    w.timezone,
    w.template,
    w.status,
    w.created_at,
    COUNT(a.id) as attendee_count,
    COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_attendees,
    COUNT(CASE WHEN a.status = 'failed' THEN 1 END) as failed_attendees
FROM workshops w
LEFT JOIN attendees a ON w.id = a.workshop_id
GROUP BY w.id, w.name, w.description, w.start_date, w.end_date, w.timezone, w.template, w.status, w.created_at;

CREATE VIEW attendee_details AS
SELECT 
    a.id,
    a.username,
    a.email,
    a.ovh_project_id,
    a.ovh_user_urn,
    a.status,
    a.created_at,
    w.name as workshop_name,
    w.start_date as workshop_start,
    w.end_date as workshop_end,
    c.username as ovh_username
FROM attendees a
JOIN workshops w ON a.workshop_id = w.id
LEFT JOIN credentials c ON a.id = c.attendee_id;