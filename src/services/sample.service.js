const pool = require('../utils/db');

class SampleService {
  /**
   * List samples with filters and pagination.
   *
   * Available filters (all optional):
   *   site_id, validation_status, abo_type,
   *   date_from, date_to, has_ambiguous, has_unexpected
   *
   * Pagination: page (default 1), limit (default 20, max 100)
   */
  async listSamples({
    site_id,
    validation_status,
    abo_type,
    date_from,
    date_to,
    has_ambiguous,
    has_unexpected,
    page = 1,
    limit = 20,
  }) {
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (site_id) {
      conditions.push(`s.site_id = $${idx++}`);
      values.push(site_id);
    }
    if (validation_status) {
      conditions.push(`s.validation_status = $${idx++}`);
      values.push(validation_status);
    }
    if (abo_type) {
      conditions.push(`s.abo_type = $${idx++}`);
      values.push(abo_type);
    }
    if (date_from) {
      conditions.push(`s.run_date >= $${idx++}`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`s.run_date <= $${idx++}`);
      values.push(date_to);
    }
    if (has_ambiguous !== undefined && has_ambiguous !== '') {
      conditions.push(`s.has_ambiguous = $${idx++}`);
      values.push(has_ambiguous === 'true' || has_ambiguous === true);
    }
    if (has_unexpected !== undefined && has_unexpected !== '') {
      conditions.push(`s.has_unexpected = $${idx++}`);
      values.push(has_unexpected === 'true' || has_unexpected === true);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM samples s ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(
      `SELECT
         s.id, s.site_id, s.run_id, s.sample_number, s.donor_id,
         s.run_date, s.abo_type,
         s.rh_d, s.rh_cc, s.rh_c, s.rh_ee, s.rh_e,
         s.kel_kk, s.kel_k, s.fy_fya, s.fy_fyb,
         s.jk_jka, s.jk_jkb,
         s.mns_m, s.mns_n, s.mns_ss, s.mns_s, s.mns_u,
         s.qc_core_status, s.qc_core_reads,
         s.estimated_dna_ng, s.contamination_score, s.primer_dimer_fraction,
         s.has_ambiguous, s.has_unexpected, s.has_novel_variant,
         s.validation_status, s.created_at,
         r.plate_id, r.instrument, r.panel_type
       FROM samples s
       LEFT JOIN sequencing_runs r ON r.id = s.run_id
       ${where}
       ORDER BY s.run_date DESC, s.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, safeLimit, offset]
    );

    return {
      data: dataResult.rows,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Get a single sample by ID with full detail:
   * phenotypes, genotypes, allele_calls, consensus_sequences.
   */
  async getSampleById(id) {
    const sampleResult = await pool.query(
      `SELECT
         s.*,
         r.plate_id, r.instrument, r.panel_type, r.run_date AS run_date_full,
         r.overall_qc AS run_qc
       FROM samples s
       LEFT JOIN sequencing_runs r ON r.id = s.run_id
       WHERE s.id = $1`,
      [id]
    );

    if (!sampleResult.rows[0]) return null;

    const sample = sampleResult.rows[0];

    const [allelesResult, consensusResult] = await Promise.all([
      pool.query(
        `SELECT gene_symbol, amplicon, cdna_position, cdna_ref_base,
                allele1_call, allele2_call, allele1_isbt, allele2_isbt,
                combined_call, predicted_phenotype, qc_status
         FROM allele_calls
         WHERE sample_id = $1
         ORDER BY gene_symbol, amplicon, cdna_position`,
        [id]
      ),
      pool.query(
        `SELECT gene_symbol, transcript_id, protein_id, protein_range,
                sequence_data, overall_qc
         FROM consensus_sequences
         WHERE sample_id = $1
         ORDER BY gene_symbol`,
        [id]
      ),
    ]);

    // Remove pgvector binary columns from the response (not JSON-serializable cleanly)
    delete sample.fenotipo_vector;
    delete sample.fenotipo_ponderado;
    delete sample.fenotipo_bits;
    delete sample.antigen_vector;

    return {
      ...sample,
      alleleCalls: allelesResult.rows,
      consensusSequences: consensusResult.rows,
    };
  }
}

module.exports = new SampleService();
