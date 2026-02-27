-- ============================================================
-- MIGRATION 009: Indexes for all search strategies
-- Column names are quoted because they were created case-sensitive
-- ============================================================

-- Strategy 1: B-tree composites on native columns
CREATE INDEX IF NOT EXISTS idx_abo_rh_kel ON samples (abo_type, "rh_D", "kel_K")
    WHERE validation_status = 'VALIDATED';

CREATE INDEX IF NOT EXISTS idx_common_match ON samples (
    abo_type, "rh_D", "rh_C", "rh_c", "rh_E", "rh_e",
    "kel_K", "fy_Fya", "fy_Fyb", "jk_Jka", "jk_Jkb"
) WHERE validation_status = 'VALIDATED';

CREATE INDEX IF NOT EXISTS idx_mns ON samples ("mns_M", "mns_N", "mns_S", "mns_s", "mns_U")
    WHERE validation_status = 'VALIDATED';

-- Strategy 2: GIN jsonb_path_ops on JSONB phenotypes
CREATE INDEX IF NOT EXISTS idx_phenotypes_gin ON samples
    USING GIN (antigen_phenotypes jsonb_path_ops);

-- Strategy 3: GIN gin__int_ops on integer vector
CREATE INDEX IF NOT EXISTS idx_vector_gin ON samples
    USING GIN (antigen_vector gin__int_ops);

-- Strategy 4: GIN on genotypes
CREATE INDEX IF NOT EXISTS idx_genotypes_gin ON samples
    USING GIN (genotypes jsonb_path_ops);

-- Strategy 5: BRIN on partition key
CREATE INDEX IF NOT EXISTS idx_run_date_brin ON samples USING BRIN (run_date);

-- Validation status index
CREATE INDEX IF NOT EXISTS idx_validation ON samples(validation_status);
CREATE INDEX IF NOT EXISTS idx_site_run ON samples(site_id, run_date DESC);
