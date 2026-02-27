-- ============================================================
-- MIGRATION 003: Multi-tenant sites and users
-- NOTE: Handles pre-existing tables from legacy Sequelize schema
-- ============================================================

-- Drop legacy tables that conflict with new schema
DROP TABLE IF EXISTS phenotype_search_cache CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS compatibility_analysis CASCADE;
DROP TABLE IF EXISTS phenotypes CASCADE;
DROP TABLE IF EXISTS genotypes CASCADE;
DROP TABLE IF EXISTS genetic_records CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- Rename legacy users table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        ALTER TABLE users RENAME TO _legacy_users;
    END IF;
END $$;

-- Rename legacy samples if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'samples' AND table_schema = 'public') THEN
        ALTER TABLE samples RENAME TO _legacy_samples;
    END IF;
END $$;

-- Rename legacy tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['patients', 'plates', 'roles', 'locations', 'ubicaciones', 'genes', 'antigen_groups', 'antigens'])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            EXECUTE format('ALTER TABLE %I RENAME TO %I', tbl, '_legacy_' || tbl);
        END IF;
    END LOOP;
END $$;

-- Now create the new tables
CREATE TABLE IF NOT EXISTS sites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name       VARCHAR(200) NOT NULL,
    isbt_facility_code VARCHAR(20) UNIQUE,
    cofepris_license   VARCHAR(50),
    country_code    CHAR(2) NOT NULL DEFAULT 'MX',
    logo_url        TEXT,
    primary_color   VARCHAR(7) DEFAULT '#0274C6',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES sites(id),
    username        VARCHAR(100) NOT NULL UNIQUE,
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(200),
    password_hash   VARCHAR(200) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_site ON users(site_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
