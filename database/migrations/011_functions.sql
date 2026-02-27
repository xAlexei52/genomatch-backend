-- ============================================================
-- MIGRATION 011: Compatibility search function
-- ============================================================

CREATE OR REPLACE FUNCTION buscar_donantes_compatibles(
    p_abo_receptor       TEXT,
    p_rh_receptor        TEXT,
    p_fenotipos_receptor JSONB,
    p_anticuerpos        TEXT[] DEFAULT NULL,
    p_max_resultados     INTEGER DEFAULT 20,
    p_usar_ponderacion   BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
    donor_id            UUID,
    sample_number       VARCHAR,
    abo_type            VARCHAR,
    similitud_coseno    FLOAT,
    similitud_ponderada FLOAT,
    antigenos_diferentes INTEGER,
    perfil_fenotipico   JSONB,
    genotipos           JSONB,
    fecha_tipificacion  TIMESTAMPTZ
) AS $$
DECLARE
    v_vector_receptor   vector;
    v_weighted_receptor vector;
    v_bits_receptor     BIT(444);
    v_abo_compatible    TEXT[];
BEGIN
    v_vector_receptor := phenotype_to_vector(p_fenotipos_receptor);
    v_weighted_receptor := phenotype_to_weighted_vector(p_fenotipos_receptor);
    v_bits_receptor := phenotype_to_bitvector(p_fenotipos_receptor);

    v_abo_compatible := CASE p_abo_receptor
        WHEN 'AB' THEN ARRAY['O','A','B','AB']
        WHEN 'A'  THEN ARRAY['O','A']
        WHEN 'B'  THEN ARRAY['O','B']
        WHEN 'O'  THEN ARRAY['O']
        ELSE ARRAY[p_abo_receptor]
    END;

    RETURN QUERY
    SELECT
        s.donor_id,
        s.sample_number,
        s.abo_type,
        (1 - (s.fenotipo_vector <=> v_vector_receptor))::FLOAT AS similitud_coseno,
        (1 - (s.fenotipo_ponderado <=> v_weighted_receptor))::FLOAT AS similitud_ponderada,
        rbc_hamming_distance(s.fenotipo_bits, v_bits_receptor) AS antigenos_diferentes,
        s.antigen_phenotypes AS perfil_fenotipico,
        s.genotypes AS genotipos,
        s.run_date AS fecha_tipificacion
    FROM samples s
    WHERE
        s.validation_status = 'VALIDATED'
        AND s.abo_type = ANY(v_abo_compatible)
        AND (p_rh_receptor = '+' OR s.rh_D = '0')
        AND (p_anticuerpos IS NULL OR NOT EXISTS (
            SELECT 1
            FROM unnest(p_anticuerpos) AS ab(nombre)
            WHERE s.antigen_phenotypes ->> ab.nombre = '+'
        ))
        AND s.fenotipo_vector IS NOT NULL
    ORDER BY
        CASE WHEN p_usar_ponderacion THEN
            s.fenotipo_ponderado <=> v_weighted_receptor
        ELSE
            s.fenotipo_vector <=> v_vector_receptor
        END
    LIMIT p_max_resultados;
END;
$$ LANGUAGE plpgsql;
