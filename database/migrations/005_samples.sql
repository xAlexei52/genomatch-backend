-- ============================================================
-- MIGRATION 005: Sequencing runs and samples (partitioned)
-- ============================================================

CREATE TABLE IF NOT EXISTS sequencing_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES sites(id),
    plate_id        VARCHAR(50) NOT NULL,
    run_date        TIMESTAMPTZ NOT NULL,
    instrument      VARCHAR(50),
    panel_type      VARCHAR(30) NOT NULL DEFAULT 'RBCPv3',
    software_version VARCHAR(30),
    overall_qc      VARCHAR(10) DEFAULT 'PENDING',
    operator_id     UUID REFERENCES users(id),
    raw_file_path   TEXT,
    import_metadata JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (site_id, plate_id)
);

-- Main sample table — partitioned by run_date year
CREATE TABLE IF NOT EXISTS samples (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES sites(id),
    run_id          UUID NOT NULL REFERENCES sequencing_runs(id),
    sample_number   VARCHAR(50) NOT NULL,
    donor_id        UUID,
    run_date        TIMESTAMPTZ NOT NULL,

    -- QC Metrics
    qc_core_status  VARCHAR(10),
    qc_core_reads   INTEGER,
    qc_expanded_status VARCHAR(10),
    qc_expanded_reads  INTEGER,
    qc_plus_status  VARCHAR(10),
    qc_plus_reads   INTEGER,
    rhd_copy_number_qc VARCHAR(10),
    estimated_dna_ng   NUMERIC(8,2),
    contamination_score NUMERIC(5,4),
    primer_dimer_fraction NUMERIC(5,4),

    -- Layer 1: Native columns (top 25 queried antigens)
    abo_type        VARCHAR(3),
    "rh_D"          VARCHAR(5),
    "rh_C"          VARCHAR(5),    "rh_c"   VARCHAR(5),
    "rh_E"          VARCHAR(5),    "rh_e"   VARCHAR(5),
    "kel_K"         VARCHAR(5),    "kel_k"  VARCHAR(5),
    "kel_Kpa"       VARCHAR(5),    "kel_Kpb" VARCHAR(5),
    "fy_Fya"        VARCHAR(5),    "fy_Fyb" VARCHAR(5),
    "jk_Jka"        VARCHAR(5),    "jk_Jkb" VARCHAR(5),
    "mns_M"         VARCHAR(5),    "mns_N"  VARCHAR(5),
    "mns_S"         VARCHAR(5),    "mns_s"  VARCHAR(5),
    "mns_U"         VARCHAR(5),
    "di_Dia"        VARCHAR(5),    "di_Dib" VARCHAR(5),
    "do_Doa"        VARCHAR(5),    "do_Dob" VARCHAR(5),
    "co_Coa"        VARCHAR(5),    "co_Cob" VARCHAR(5),

    -- Layer 2: JSONB for all 444+ antigens
    antigen_phenotypes JSONB NOT NULL DEFAULT '{}',

    -- Layer 3: Integer-encoded phenotype vector
    antigen_vector  INTEGER[] NOT NULL DEFAULT '{}',

    -- Genotype data (per-gene ISBT)
    genotypes       JSONB NOT NULL DEFAULT '{}',

    -- Flags
    has_ambiguous   BOOLEAN DEFAULT FALSE,
    has_unexpected  BOOLEAN DEFAULT FALSE,
    has_novel_variant BOOLEAN DEFAULT FALSE,
    validation_status VARCHAR(15) DEFAULT 'PENDING'
        CHECK (validation_status IN ('PENDING','VALIDATED','REJECTED','REVIEW')),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    validated_by    UUID REFERENCES users(id),
    validated_at    TIMESTAMPTZ,

    PRIMARY KEY (id, run_date)
) PARTITION BY RANGE (run_date);

-- Create yearly partitions
CREATE TABLE IF NOT EXISTS samples_2024 PARTITION OF samples
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS samples_2025 PARTITION OF samples
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS samples_2026 PARTITION OF samples
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS samples_2027 PARTITION OF samples
    FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
