/**
 * Parser for alleles/*.tsv files
 *
 * File structure (tab-separated):
 *   Header block:
 *     Sample ID   <value>
 *     Blood Group <value>
 *
 *   Per antigen group block (repeated):
 *     Antigen Group  <value>
 *     Gene           <value>
 *     Transcript ID  <value>
 *     Protein ID     <value>
 *     (blank)
 *     QC             <PASS|FAIL>
 *     (blank)
 *     Amplicon       <amp1>  <amp2> ... <ampN>  ISBT Genotype  <antigen1> <antigen2> ...
 *     cDNA Position  <pos1>  <pos2> ... <posN>  ISBT Genotype  <antigen1> ...
 *     cDNA Reference <ref1>  <ref2> ... <refN>  ISBT Genotype  <antigen1> ...
 *     ALLELE 1       <base1> <base2> ...         <isbt_allele1> <pheno1>  ...
 *     ALLELE 2       <base1> <base2> ...         <isbt_allele2> <pheno1>  ...
 *     CALL                                       <combined>    <pheno1>  ...
 *
 * Output: array of allele_calls rows
 */

/**
 * Parse an allele TSV buffer.
 * @param {Buffer} fileBuffer
 * @returns {Array<object>} Rows for allele_calls table
 */
function parseAlleleTsv(fileBuffer) {
  const text = fileBuffer.toString('utf-8');
  const lines = text.split(/\r?\n/);
  const rows = [];

  let currentGene = null;
  let currentQc = 'PASS';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const cols = line.split('\t');
    const rowLabel = cols[0] ? cols[0].trim() : '';

    if (rowLabel === 'Gene') {
      currentGene = cols[1] ? cols[1].trim() : null;
      i++;
      continue;
    }

    if (rowLabel === 'QC') {
      currentQc = cols[1] ? cols[1].trim() : 'PASS';
      i++;
      continue;
    }

    // Start of an allele block: found the Amplicon header row
    if (rowLabel === 'Amplicon') {
      const ampliconRow = cols; // cols[0] = 'Amplicon', cols[1..N] = amplicon names
      const cdnaPosRow = lines[i + 1] ? lines[i + 1].split('\t') : [];
      const cdnaRefRow = lines[i + 2] ? lines[i + 2].split('\t') : [];
      const allele1Row = lines[i + 3] ? lines[i + 3].split('\t') : [];
      const allele2Row = lines[i + 4] ? lines[i + 4].split('\t') : [];
      const callRow = lines[i + 5] ? lines[i + 5].split('\t') : [];

      // Find the ISBT Genotype column index in the cDNA Reference row
      let isbtColIndex = -1;
      for (let j = 1; j < cdnaRefRow.length; j++) {
        if (cdnaRefRow[j] && cdnaRefRow[j].trim() === 'ISBT Genotype') {
          isbtColIndex = j;
          break;
        }
      }

      if (isbtColIndex === -1) {
        // No ISBT column found — skip this block
        i++;
        continue;
      }

      const allele1Isbt = allele1Row[isbtColIndex]
        ? allele1Row[isbtColIndex].trim()
        : null;
      const allele2Isbt = allele2Row[isbtColIndex]
        ? allele2Row[isbtColIndex].trim()
        : null;
      const combinedCall = callRow[isbtColIndex]
        ? callRow[isbtColIndex].trim()
        : null;

      // Build phenotype summary from CALL row (columns after isbtColIndex)
      const phenotypeParts = [];
      const phenoNames = cdnaRefRow.slice(isbtColIndex + 1);
      const phenoValues = callRow.slice(isbtColIndex + 1);
      for (let p = 0; p < phenoNames.length; p++) {
        const name = phenoNames[p] ? phenoNames[p].trim() : '';
        const val = phenoValues[p] ? phenoValues[p].trim() : '';
        if (name && val) phenotypeParts.push(`${name}:${val}`);
      }
      const predictedPhenotype = phenotypeParts.slice(0, 3).join(' ') || null; // first 3 antigens, fits VARCHAR(10)... actually might be too long

      // One row per cDNA position
      for (let col = 1; col < isbtColIndex; col++) {
        const amplicon = ampliconRow[col] ? ampliconRow[col].trim() : null;
        const cdnaPos = cdnaPosRow[col] ? cdnaPosRow[col].trim() : null;
        const cdnaRef = cdnaRefRow[col] ? cdnaRefRow[col].trim() : null;
        const a1Call = allele1Row[col] ? allele1Row[col].trim() : null;
        const a2Call = allele2Row[col] ? allele2Row[col].trim() : null;

        if (!cdnaPos || cdnaPos === '') continue;

        rows.push({
          gene_symbol: currentGene,
          amplicon: amplicon || currentGene,
          cdna_position: cdnaPos,
          cdna_ref_base: cdnaRef ? cdnaRef.charAt(0) : null,
          allele1_call: a1Call ? a1Call.substring(0, 10) : null,
          allele2_call: a2Call ? a2Call.substring(0, 10) : null,
          allele1_isbt: allele1Isbt ? allele1Isbt.substring(0, 50) : null,
          allele2_isbt: allele2Isbt ? allele2Isbt.substring(0, 50) : null,
          combined_call: combinedCall ? combinedCall.substring(0, 100) : null,
          predicted_phenotype: predictedPhenotype
            ? predictedPhenotype.substring(0, 10)
            : null,
          qc_status: currentQc ? currentQc.substring(0, 10) : 'PASS',
        });
      }

      i += 6; // Skip the 6 rows of this block (Amplicon through CALL)
      continue;
    }

    i++;
  }

  return rows;
}

module.exports = { parseAlleleTsv };
