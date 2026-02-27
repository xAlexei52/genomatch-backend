-- ============================================================
-- MIGRATION 006: pgvector columns + HNSW indexes
-- Drop pre-existing functions from legacy schema
-- ============================================================
DROP FUNCTION IF EXISTS phenotype_to_vector(jsonb) CASCADE;
DROP FUNCTION IF EXISTS phenotype_to_weighted_vector CASCADE;
DROP FUNCTION IF EXISTS phenotype_to_bitvector CASCADE;
DROP FUNCTION IF EXISTS trg_compute_vectors CASCADE;
DROP FUNCTION IF EXISTS buscar_donantes_compatibles CASCADE;

-- Dense phenotype vector (444 dimensions)
ALTER TABLE samples ADD COLUMN IF NOT EXISTS
    fenotipo_vector vector(444);

-- Weighted phenotype vector (multiplied by clinical weight)
ALTER TABLE samples ADD COLUMN IF NOT EXISTS
    fenotipo_ponderado vector(444);

-- Binary phenotype vector (presence/absence)
ALTER TABLE samples ADD COLUMN IF NOT EXISTS
    fenotipo_bits BIT(444);

-- ============================================================
-- FUNCTION: Convert JSONB phenotypes → vector(444)
-- ============================================================
CREATE OR REPLACE FUNCTION phenotype_to_vector(
    p_phenotypes JSONB
) RETURNS vector AS $$
DECLARE
    v_result FLOAT4[] := ARRAY[]::FLOAT4[];
    v_value  TEXT;
    v_num    FLOAT4;
    r        RECORD;
BEGIN
    FOR i IN 0..443 LOOP
        v_result := array_append(v_result, -1.0::FLOAT4);
    END LOOP;

    FOR r IN
        SELECT posicion_vector, nombre_antigeno
        FROM cat_antigenos
        ORDER BY posicion_vector
    LOOP
        v_value := p_phenotypes ->> r.nombre_antigeno;
        IF v_value IS NOT NULL THEN
            v_num := CASE v_value
                WHEN '+' THEN 1.0
                WHEN '++' THEN 1.0
                WHEN '0' THEN 0.0
                WHEN 'w' THEN 0.5
                WHEN 'ww' THEN 0.5
                WHEN 'AMB' THEN 0.75
                WHEN 'UNX' THEN -0.5
                WHEN 'NA' THEN -1.0
                WHEN '*' THEN 0.75
                ELSE -1.0
            END;
            v_result[r.posicion_vector + 1] := v_num;
        END IF;
    END LOOP;

    RETURN v_result::vector;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- ============================================================
-- FUNCTION: Weighted vector (clinical priorities)
-- ============================================================
CREATE OR REPLACE FUNCTION phenotype_to_weighted_vector(
    p_phenotypes JSONB
) RETURNS vector AS $$
DECLARE
    v_result FLOAT4[] := ARRAY[]::FLOAT4[];
    v_value  TEXT;
    v_num    FLOAT4;
    r        RECORD;
BEGIN
    FOR i IN 0..443 LOOP
        v_result := array_append(v_result, 0.0::FLOAT4);
    END LOOP;

    FOR r IN
        SELECT posicion_vector, nombre_antigeno, peso_clinico
        FROM cat_antigenos
        ORDER BY posicion_vector
    LOOP
        v_value := p_phenotypes ->> r.nombre_antigeno;
        IF v_value IS NOT NULL THEN
            v_num := CASE v_value
                WHEN '+' THEN 1.0
                WHEN '0' THEN 0.0
                WHEN 'w' THEN 0.5
                WHEN 'AMB' THEN 0.75
                ELSE 0.0
            END;
            v_result[r.posicion_vector + 1] := v_num * r.peso_clinico;
        END IF;
    END LOOP;

    RETURN v_result::vector;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- ============================================================
-- FUNCTION: Binary bitvector
-- ============================================================
CREATE OR REPLACE FUNCTION phenotype_to_bitvector(
    p_phenotypes JSONB
) RETURNS BIT(444) AS $$
DECLARE
    v_bits TEXT := '';
    v_value TEXT;
    r RECORD;
BEGIN
    FOR r IN
        SELECT posicion_vector, nombre_antigeno
        FROM cat_antigenos
        ORDER BY posicion_vector
    LOOP
        v_value := p_phenotypes ->> r.nombre_antigeno;
        IF v_value IN ('+', '++', 'w', 'ww') THEN
            v_bits := v_bits || '1';
        ELSE
            v_bits := v_bits || '0';
        END IF;
    END LOOP;

    WHILE length(v_bits) < 444 LOOP
        v_bits := v_bits || '0';
    END LOOP;

    RETURN v_bits::BIT(444);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- ============================================================
-- FUNCTION: Hamming distance
-- ============================================================
CREATE OR REPLACE FUNCTION rbc_hamming_distance(a BIT(444), b BIT(444))
RETURNS INTEGER AS $$
    SELECT length(replace((a # b)::TEXT, '0', ''));
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- ============================================================
-- TRIGGER: Auto-compute vectors on insert/update
-- ============================================================
CREATE OR REPLACE FUNCTION trg_compute_vectors()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fenotipo_vector := phenotype_to_vector(NEW.antigen_phenotypes);
    NEW.fenotipo_ponderado := phenotype_to_weighted_vector(NEW.antigen_phenotypes);
    NEW.fenotipo_bits := phenotype_to_bitvector(NEW.antigen_phenotypes);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all partitions
DO $$
DECLARE
    part TEXT;
BEGIN
    FOR part IN SELECT inhrelid::regclass::text FROM pg_inherits WHERE inhparent = 'samples'::regclass
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_samples_vector ON %I;
            CREATE TRIGGER trg_samples_vector
                BEFORE INSERT OR UPDATE OF antigen_phenotypes ON %I
                FOR EACH ROW EXECUTE FUNCTION trg_compute_vectors();
        ', part, part);
    END LOOP;
END $$;
