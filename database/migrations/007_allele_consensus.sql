-- ============================================================
-- MIGRATION 007: Allele calls and consensus sequences
-- ============================================================

CREATE TABLE IF NOT EXISTS allele_calls (
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

CREATE INDEX IF NOT EXISTS idx_allele_sample ON allele_calls(sample_id);
CREATE INDEX IF NOT EXISTS idx_allele_gene ON allele_calls(gene_symbol, amplicon);

CREATE TABLE IF NOT EXISTS consensus_sequences (
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

CREATE INDEX IF NOT EXISTS idx_consensus_sample ON consensus_sequences(sample_id);
CREATE INDEX IF NOT EXISTS idx_consensus_gene ON consensus_sequences(gene_symbol);
