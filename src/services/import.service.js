const pool = require('../utils/db');

/**
 * Import a single sample's sequencing results into the database.
 *
 * Runs everything in a single transaction:
 *  1. Upsert sequencing_run
 *  2. Insert sample (triggers auto-compute fenotipo_vector, fenotipo_ponderado, fenotipo_bits)
 *  3. Batch insert allele_calls (optional)
 *  4. Batch insert consensus_sequences (optional)
 *
 * @param {object} params
 * @param {object} params.parsedDetails   - Output of parseSampleDetailsLong()
 * @param {Array}  params.alleleRows      - Output of parseAlleleTsv() for each file
 * @param {Array}  params.consensusRows   - Output of parseConsensusCsv() for each file
 * @param {string} params.siteId          - UUID of the importing site
 * @param {string} params.runDate         - ISO date string (e.g. "2024-06-15")
 * @param {string} [params.instrument]    - Instrument name
 * @param {string} [params.panelType]     - Panel type (default: 'RBCPv3')
 * @param {string} [params.donorId]       - Donor UUID (optional)
 * @returns {object} Import summary
 */
async function importSample({
  parsedDetails,
  alleleRows = [],
  consensusRows = [],
  siteId,
  runDate,
  instrument = null,
  panelType = 'RBCPv3',
  donorId = null,
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ----------------------------------------------------------------
    // 1. Upsert sequencing_run
    // ----------------------------------------------------------------
    const runResult = await client.query(
      `INSERT INTO sequencing_runs
         (site_id, plate_id, run_date, instrument, panel_type, overall_qc)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       ON CONFLICT (site_id, plate_id)
       DO UPDATE SET
         run_date    = EXCLUDED.run_date,
         instrument  = COALESCE(EXCLUDED.instrument, sequencing_runs.instrument),
         panel_type  = EXCLUDED.panel_type
       RETURNING id`,
      [siteId, parsedDetails.plateId, runDate, instrument, panelType]
    );
    const runId = runResult.rows[0].id;

    // ----------------------------------------------------------------
    // 2. Insert sample
    //    DB triggers auto-compute: fenotipo_vector, fenotipo_ponderado, fenotipo_bits
    //    DB trigger also records in audit.change_log
    // ----------------------------------------------------------------
    const nc = parsedDetails.nativeColumns || {};
    const sampleResult = await client.query(
      `INSERT INTO samples (
         site_id, run_id, sample_number, donor_id, run_date,
         qc_core_status, qc_core_reads,
         estimated_dna_ng, contamination_score, primer_dimer_fraction,
         abo_type,
         rh_d, rh_cc, rh_c, rh_ee, rh_e,
         kel_kk, kel_k, kel_kpa, kel_kpb,
         fy_fya, fy_fyb,
         jk_jka, jk_jkb,
         mns_m, mns_n, mns_ss, mns_s, mns_u,
         di_dia, di_dib,
         do_doa, do_dob,
         co_coa, co_cob,
         antigen_phenotypes, genotypes,
         has_ambiguous, has_unexpected, has_novel_variant,
         validation_status
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7,
         $8, $9, $10,
         $11,
         $12, $13, $14, $15, $16,
         $17, $18, $19, $20,
         $21, $22,
         $23, $24,
         $25, $26, $27, $28, $29,
         $30, $31,
         $32, $33,
         $34, $35,
         $36, $37,
         $38, $39, $40,
         'PENDING'
       )
       RETURNING id`,
      [
        siteId,
        runId,
        parsedDetails.sampleNumber,
        donorId,
        runDate,
        parsedDetails.qcCoreStatus,
        parsedDetails.qcCoreReads,
        parsedDetails.estimatedDnaNG,
        parsedDetails.contaminationScore,
        parsedDetails.primerDimerFraction,
        nc.abo_type || null,
        nc.rh_d || null,
        nc.rh_cc || null,
        nc.rh_c || null,
        nc.rh_ee || null,
        nc.rh_e || null,
        nc.kel_kk || null,
        nc.kel_k || null,
        nc.kel_kpa || null,
        nc.kel_kpb || null,
        nc.fy_fya || null,
        nc.fy_fyb || null,
        nc.jk_jka || null,
        nc.jk_jkb || null,
        nc.mns_m || null,
        nc.mns_n || null,
        nc.mns_ss || null,
        nc.mns_s || null,
        nc.mns_u || null,
        nc.di_dia || null,
        nc.di_dib || null,
        nc.do_doa || null,
        nc.do_dob || null,
        nc.co_coa || null,
        nc.co_cob || null,
        JSON.stringify(parsedDetails.antigenPhenotypes),
        JSON.stringify(parsedDetails.genotypes),
        parsedDetails.hasAmbiguous,
        parsedDetails.hasUnexpected,
        parsedDetails.hasNovelVariant,
      ]
    );
    const sampleId = sampleResult.rows[0].id;

    // ----------------------------------------------------------------
    // 3. Batch insert allele_calls
    // ----------------------------------------------------------------
    let allelesInserted = 0;
    if (alleleRows.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < alleleRows.length; i += BATCH_SIZE) {
        const batch = alleleRows.slice(i, i + BATCH_SIZE);
        batch
          .map(
            (_, idx) =>
              `($1, $2, $${3 + idx * 9}, $${4 + idx * 9}, $${5 + idx * 9}, $${6 + idx * 9}, $${7 + idx * 9}, $${8 + idx * 9}, $${9 + idx * 9}, $${10 + idx * 9}, $${11 + idx * 9})`
          )
          .join(', ');
        const values = [sampleId, runDate];
        for (const row of batch) {
          values.push(
            row.gene_symbol,
            row.amplicon,
            row.cdna_position,
            row.cdna_ref_base,
            row.allele1_call,
            row.allele2_call,
            row.allele1_isbt,
            row.allele2_isbt,
            row.combined_call
          );
        }

        // Build a simpler parameterized insert for the batch
        await insertAlleleBatch(client, sampleId, runDate, batch);
        allelesInserted += batch.length;
      }
    }

    // ----------------------------------------------------------------
    // 4. Batch insert consensus_sequences
    // ----------------------------------------------------------------
    let consensusInserted = 0;
    for (const row of consensusRows) {
      if (!row) continue;
      await client.query(
        `INSERT INTO consensus_sequences
           (sample_id, run_date, gene_symbol, transcript_id, protein_id, protein_range, sequence_data, overall_qc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sampleId,
          runDate,
          row.gene_symbol,
          row.transcript_id,
          row.protein_id,
          row.protein_range,
          JSON.stringify(row.sequence_data),
          row.overall_qc,
        ]
      );
      consensusInserted++;
    }

    await client.query('COMMIT');

    return {
      runId,
      sampleId,
      sampleNumber: parsedDetails.sampleNumber,
      plate: parsedDetails.plateId,
      phenotypesCount: parsedDetails.phenotypesCount,
      allelesInserted,
      consensusInserted,
      validationStatus: 'PENDING',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Insert allele_calls rows one by one (avoids parameter limit issues on large batches).
 */
async function insertAlleleBatch(client, sampleId, runDate, rows) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO allele_calls
         (sample_id, run_date, gene_symbol, amplicon, cdna_position, cdna_ref_base,
          allele1_call, allele2_call, allele1_isbt, allele2_isbt, combined_call,
          predicted_phenotype, qc_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        sampleId,
        runDate,
        row.gene_symbol,
        row.amplicon,
        row.cdna_position,
        row.cdna_ref_base,
        row.allele1_call,
        row.allele2_call,
        row.allele1_isbt,
        row.allele2_isbt,
        row.combined_call,
        row.predicted_phenotype,
        row.qc_status,
      ]
    );
  }
}

module.exports = { importSample };
