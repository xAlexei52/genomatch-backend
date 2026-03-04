-- ============================================================
-- MIGRATION 002: Reference tables (blood group systems, antigens)
-- ============================================================

CREATE TABLE IF NOT EXISTS blood_group_systems (
    id              SMALLINT PRIMARY KEY,
    symbol          VARCHAR(10) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    gene_names      TEXT[] NOT NULL,
    isbt_number     CHAR(3) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cat_antigenos (
    posicion_vector   SMALLINT PRIMARY KEY,
    nombre_antigeno   VARCHAR(30) NOT NULL UNIQUE,
    sistema_isbt      VARCHAR(10) NOT NULL,
    grupo_antigeno    VARCHAR(30) NOT NULL,
    numero_isbt       CHAR(6),
    frecuencia        VARCHAR(15),
    peso_clinico      NUMERIC(3,2) DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS allele_definitions (
    id              SERIAL PRIMARY KEY,
    gene_symbol     VARCHAR(20) NOT NULL,
    allele_name     VARCHAR(50) NOT NULL UNIQUE,
    system_id       SMALLINT REFERENCES blood_group_systems(id),
    is_null         BOOLEAN DEFAULT FALSE,
    is_weak         BOOLEAN DEFAULT FALSE,
    defining_snps   JSONB,
    predicted_phenotype JSONB
);

CREATE INDEX IF NOT EXISTS idx_allele_gene ON allele_definitions(gene_symbol);
CREATE INDEX IF NOT EXISTS idx_allele_trgm ON allele_definitions 
    USING GIN (allele_name gin_trgm_ops);
