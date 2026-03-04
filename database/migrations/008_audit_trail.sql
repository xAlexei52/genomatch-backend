-- ============================================================
-- MIGRATION 008: Audit trail (NOM-253-SSA1 / 21 CFR Part 11)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS audit;

-- Immutable change log for data mutations
CREATE TABLE IF NOT EXISTS audit.change_log (
    id              BIGSERIAL PRIMARY KEY,
    schema_name     TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    record_id       TEXT NOT NULL,
    action          CHAR(1) NOT NULL CHECK (action IN ('I','U','D')),
    action_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    user_id         UUID,
    user_name       TEXT NOT NULL DEFAULT COALESCE(current_setting('app.current_user', true), 'system'),
    site_id         UUID,
    client_ip       INET DEFAULT inet_client_addr(),
    application     TEXT DEFAULT current_setting('application_name', true),
    old_data        JSONB,
    new_data        JSONB,
    changed_fields  TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit.change_log(table_name, action_at);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit.change_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit.change_log(user_id, action_at);

-- Activity log for API calls
CREATE TABLE IF NOT EXISTS audit.activity_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID,
    user_name       TEXT,
    site_id         UUID,
    method          VARCHAR(10),
    path            TEXT,
    status_code     INTEGER,
    duration_ms     INTEGER,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON audit.activity_log(user_id, created_at);

-- ============================================================
-- TRIGGER: Auto-log changes to samples table
-- ============================================================
CREATE OR REPLACE FUNCTION audit.log_sample_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit.change_log (schema_name, table_name, record_id, action, new_data, site_id)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id::text, 'I', 
                jsonb_build_object('sample_number', NEW.sample_number, 'validation_status', NEW.validation_status),
                NEW.site_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.change_log (schema_name, table_name, record_id, action, old_data, new_data, changed_fields, site_id)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id::text, 'U',
                jsonb_build_object('validation_status', OLD.validation_status),
                jsonb_build_object('validation_status', NEW.validation_status),
                ARRAY(SELECT unnest FROM unnest(ARRAY['validation_status']) WHERE 
                    OLD.validation_status IS DISTINCT FROM NEW.validation_status),
                NEW.site_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit.change_log (schema_name, table_name, record_id, action, old_data, site_id)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id::text, 'D',
                jsonb_build_object('sample_number', OLD.sample_number),
                OLD.site_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to all sample partitions
DO $$
DECLARE
    part TEXT;
BEGIN
    FOR part IN SELECT inhrelid::regclass::text FROM pg_inherits WHERE inhparent = 'samples'::regclass
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_audit_samples ON %I;
            CREATE TRIGGER trg_audit_samples
                AFTER INSERT OR UPDATE OR DELETE ON %I
                FOR EACH ROW EXECUTE FUNCTION audit.log_sample_changes();
        ', part, part);
    END LOOP;
END $$;
