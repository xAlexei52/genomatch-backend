-- ============================================================
-- MIGRATION 010: Materialized view for donor profiles
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_current_donor_profiles AS
SELECT DISTINCT ON (s.donor_id)
    s.id AS sample_id,
    s.donor_id,
    s.site_id,
    s.abo_type,
    s."rh_D", s."rh_C", s."rh_c", s."rh_E", s."rh_e",
    s."kel_K", s."kel_k",
    s."fy_Fya", s."fy_Fyb",
    s."jk_Jka", s."jk_Jkb",
    s."mns_M", s."mns_N", s."mns_S", s."mns_s", s."mns_U",
    s.fenotipo_vector,
    s.fenotipo_ponderado,
    s.fenotipo_bits,
    s.antigen_phenotypes,
    s.antigen_vector,
    s.genotypes,
    s.has_ambiguous,
    s.has_unexpected,
    s.run_date AS ultima_tipificacion
FROM samples s
WHERE s.validation_status = 'VALIDATED'
  AND s.donor_id IS NOT NULL
ORDER BY s.donor_id, s.run_date DESC
WITH DATA;

-- Indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_donor_id ON mv_current_donor_profiles(donor_id);
CREATE INDEX IF NOT EXISTS idx_mv_abo_rh ON mv_current_donor_profiles(abo_type, "rh_D");
CREATE INDEX IF NOT EXISTS idx_mv_int_gin ON mv_current_donor_profiles
    USING GIN (antigen_vector gin__int_ops);
CREATE INDEX IF NOT EXISTS idx_mv_phenotypes ON mv_current_donor_profiles
    USING GIN (antigen_phenotypes jsonb_path_ops);
