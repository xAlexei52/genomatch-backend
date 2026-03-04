-- ============================================================
-- MIGRATION 013: Fix case-sensitive column names
-- PostgreSQL lowercases unquoted identifiers
-- Recreate samples with proper lowercase column names
-- ============================================================

-- Drop dependent objects first
DROP MATERIALIZED VIEW IF EXISTS mv_current_donor_profiles CASCADE;
DROP TABLE IF EXISTS allele_calls CASCADE;
DROP TABLE IF EXISTS consensus_sequences CASCADE;

-- Collect partition names and drop
DO $$
DECLARE
    part TEXT;
BEGIN
    FOR part IN SELECT inhrelid::regclass::text FROM pg_inherits WHERE inhparent = 'samples'::regclass
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %s CASCADE', part);
    END LOOP;
END $$;

DROP TABLE IF EXISTS samples CASCADE;

-- Recreate with ALL LOWERCASE column names (no quoting needed)
CREATE TABLE samples (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES sites(id),
    run_id          UUID NOT NULL REFERENCES sequencing_runs(id),
    sample_number   VARCHAR(50) NOT NULL,
    donor_id        UUID,
    run_date        TIMESTAMPTZ NOT NULL,

    -- QC
    qc_core_status  VARCHAR(10),
    qc_core_reads   INTEGER,
    estimated_dna_ng   NUMERIC(8,2),
    contamination_score NUMERIC(5,4),
    primer_dimer_fraction NUMERIC(5,4),

    -- Native antigen columns (ALL LOWERCASE)
    abo_type        VARCHAR(3),
    rh_d            VARCHAR(5),
    rh_cc           VARCHAR(5),   -- uppercase C
    rh_c            VARCHAR(5),   -- lowercase c
    rh_ee           VARCHAR(5),   -- uppercase E
    rh_e            VARCHAR(5),   -- lowercase e
    kel_kk          VARCHAR(5),   -- uppercase K
    kel_k           VARCHAR(5),   -- lowercase k
    kel_kpa         VARCHAR(5),
    kel_kpb         VARCHAR(5),
    fy_fya          VARCHAR(5),
    fy_fyb          VARCHAR(5),
    jk_jka          VARCHAR(5),
    jk_jkb          VARCHAR(5),
    mns_m           VARCHAR(5),
    mns_n           VARCHAR(5),
    mns_ss          VARCHAR(5),   -- uppercase S
    mns_s           VARCHAR(5),   -- lowercase s
    mns_u           VARCHAR(5),
    di_dia          VARCHAR(5),
    di_dib          VARCHAR(5),
    do_doa          VARCHAR(5),
    do_dob          VARCHAR(5),
    co_coa          VARCHAR(5),
    co_cob          VARCHAR(5),

    -- JSONB + vector layers
    antigen_phenotypes JSONB NOT NULL DEFAULT '{}',
    antigen_vector  INTEGER[] NOT NULL DEFAULT '{}',
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

    -- pgvector columns
    fenotipo_vector vector(444),
    fenotipo_ponderado vector(444),
    fenotipo_bits   BIT(444),

    PRIMARY KEY (id, run_date)
) PARTITION BY RANGE (run_date);

-- Partitions
CREATE TABLE samples_2024 PARTITION OF samples FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE samples_2025 PARTITION OF samples FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE samples_2026 PARTITION OF samples FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE samples_2027 PARTITION OF samples FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- Recreate triggers on partitions
DO $$
DECLARE
    part TEXT;
BEGIN
    FOR part IN SELECT inhrelid::regclass::text FROM pg_inherits WHERE inhparent = 'samples'::regclass
    LOOP
        EXECUTE format('
            CREATE TRIGGER trg_samples_vector
                BEFORE INSERT OR UPDATE OF antigen_phenotypes ON %I
                FOR EACH ROW EXECUTE FUNCTION trg_compute_vectors();
            CREATE TRIGGER trg_audit_samples
                AFTER INSERT OR UPDATE OR DELETE ON %I
                FOR EACH ROW EXECUTE FUNCTION audit.log_sample_changes();
        ', part, part);
    END LOOP;
END $$;

-- Recreate indexes
CREATE INDEX idx_abo_rh_kel ON samples (abo_type, rh_d, kel_kk) WHERE validation_status = 'VALIDATED';
CREATE INDEX idx_common_match ON samples (abo_type, rh_d, rh_cc, rh_c, rh_ee, rh_e, kel_kk, fy_fya, fy_fyb, jk_jka, jk_jkb) WHERE validation_status = 'VALIDATED';
CREATE INDEX idx_mns ON samples (mns_m, mns_n, mns_ss, mns_s, mns_u) WHERE validation_status = 'VALIDATED';
CREATE INDEX idx_phenotypes_gin ON samples USING GIN (antigen_phenotypes jsonb_path_ops);
CREATE INDEX idx_vector_gin ON samples USING GIN (antigen_vector gin__int_ops);
CREATE INDEX idx_genotypes_gin ON samples USING GIN (genotypes jsonb_path_ops);
CREATE INDEX idx_run_date_brin ON samples USING BRIN (run_date);
CREATE INDEX idx_validation ON samples(validation_status);
CREATE INDEX idx_site_run ON samples(site_id, run_date DESC);

-- Recreate allele_calls and consensus_sequences
CREATE TABLE allele_calls (
    id              BIGSERIAL PRIMARY KEY,
    sample_id       UUID NOT NULL,
    run_date        TIMESTAMPTZ NOT NULL,
    gene_symbol     VARCHAR(20) NOT NULL,
    amplicon        VARCHAR(50) NOT NULL,
    cdna_position   VARCHAR(20) NOT NULL,
    cdna_ref_base   CHAR(1),
    allele1_call    VARCHAR(10),
    allele2_call    VARCHAR(10),
    allele1_isbt    VARCHAR(50),
    allele2_isbt    VARCHAR(50),
    combined_call   VARCHAR(100),
    predicted_phenotype VARCHAR(10),
    qc_status       VARCHAR(10) DEFAULT 'PASS',
    FOREIGN KEY (sample_id, run_date) REFERENCES samples(id, run_date)
);
CREATE INDEX idx_allele_sample ON allele_calls(sample_id);

CREATE TABLE consensus_sequences (
    id              BIGSERIAL PRIMARY KEY,
    sample_id       UUID NOT NULL,
    run_date        TIMESTAMPTZ NOT NULL,
    gene_symbol     VARCHAR(20) NOT NULL,
    transcript_id   VARCHAR(30),
    protein_id      VARCHAR(30),
    protein_range   VARCHAR(30),
    sequence_data   JSONB NOT NULL,
    overall_qc      VARCHAR(10) DEFAULT 'PASS',
    FOREIGN KEY (sample_id, run_date) REFERENCES samples(id, run_date)
);
CREATE INDEX idx_consensus_sample ON consensus_sequences(sample_id);

-- Recreate materialized view with lowercase names
CREATE MATERIALIZED VIEW mv_current_donor_profiles AS
SELECT DISTINCT ON (s.donor_id)
    s.id AS sample_id, s.donor_id, s.site_id, s.abo_type,
    s.rh_d, s.rh_cc, s.rh_c, s.rh_ee, s.rh_e,
    s.kel_kk, s.kel_k, s.fy_fya, s.fy_fyb, s.jk_jka, s.jk_jkb,
    s.mns_m, s.mns_n, s.mns_ss, s.mns_s, s.mns_u,
    s.fenotipo_vector, s.fenotipo_ponderado, s.fenotipo_bits,
    s.antigen_phenotypes, s.antigen_vector, s.genotypes,
    s.has_ambiguous, s.has_unexpected,
    s.run_date AS ultima_tipificacion
FROM samples s
WHERE s.validation_status = 'VALIDATED' AND s.donor_id IS NOT NULL
ORDER BY s.donor_id, s.run_date DESC
WITH DATA;

CREATE UNIQUE INDEX idx_mv_donor_id ON mv_current_donor_profiles(donor_id);
CREATE INDEX idx_mv_abo_rh ON mv_current_donor_profiles(abo_type, rh_d);
CREATE INDEX idx_mv_int_gin ON mv_current_donor_profiles USING GIN (antigen_vector gin__int_ops);
CREATE INDEX idx_mv_phenotypes ON mv_current_donor_profiles USING GIN (antigen_phenotypes jsonb_path_ops);
