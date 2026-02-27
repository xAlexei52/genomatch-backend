/**
 * Parser for consensus/*.csv files
 *
 * File format (comma-separated):
 *   Sample ID,<value>
 *   Gene ID,<value>
 *   Transcript ID,<value>
 *   Protein ID,<value>
 *   (blank)
 *   <ExonName>,<QC_status>         ← exon block header
 *   Protein Position,...
 *   Amino Acid Reference,...
 *   cDNA Position,...
 *   cDNA Reference,...
 *   Allele1,...
 *   Allele2,...
 *   Position QC,...
 *   (blank)
 *   Allele,Reference Gene,Type,Reference,Variants   ← variant summary header
 *   ALLELE 1,<gene>,cDNA,<transcript>,<variants>
 *   ALLELE 1,<gene>,Protein,<protein>,<variants>
 *   ALLELE 2,<gene>,cDNA,<transcript>,<variants>
 *   ALLELE 2,<gene>,Protein,<protein>,<variants>
 *   (blank)
 *   ... next exon block ...
 *
 * The parser extracts exon QC and variant summaries into a JSONB object.
 * Full per-position sequences are not stored (too large), only key metadata.
 */

/**
 * Parse a consensus CSV buffer.
 * @param {Buffer} fileBuffer
 * @returns {object|null} Row for consensus_sequences table, or null on error
 */
function parseConsensusCsv(fileBuffer) {
  const text = fileBuffer.toString('utf-8');
  const lines = text.split(/\r?\n/);

  let geneSymbol = null;
  let transcriptId = null;
  let proteinId = null;

  const exons = {};
  const allVariants = [];
  let overallQc = 'PASS';

  // Current exon state
  let currentExon = null;
  let currentExonQc = null;
  let proteinRangeStart = null;
  let proteinRangeEnd = null;
  let awaitingVariantHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',');
    const label = cols[0] ? cols[0].trim() : '';

    // --- File header ---
    if (label === 'Gene ID') {
      geneSymbol = cols[1] ? cols[1].trim() : null;
      continue;
    }
    if (label === 'Transcript ID') {
      transcriptId = cols[1] ? cols[1].trim() : null;
      continue;
    }
    if (label === 'Protein ID') {
      proteinId = cols[1] ? cols[1].trim() : null;
      continue;
    }

    // Skip file-level headers
    if (label === 'Sample ID') continue;

    // --- Exon block header: pattern is a non-empty label with QC value in col 1 ---
    // Check: label doesn't match known row types AND cols[1] is PASS/FAIL
    const isExonHeader =
      label &&
      ![
        'Protein Position',
        'Amino Acid Reference',
        'cDNA Position',
        'cDNA Reference',
        'Allele1',
        'Allele2',
        'Position QC',
        'Allele',
      ].includes(label) &&
      (cols[1] === 'PASS' || cols[1] === 'FAIL' || cols[1] === 'NA_GAP');

    if (isExonHeader) {
      currentExon = label;
      currentExonQc = cols[1] ? cols[1].trim() : 'PASS';
      awaitingVariantHeader = false;
      proteinRangeStart = null;
      proteinRangeEnd = null;

      if (currentExonQc === 'FAIL') overallQc = 'FAIL';
      continue;
    }

    // Protein position row — capture range
    if (label === 'Protein Position' && currentExon) {
      const positions = cols
        .filter((c) => c && c.trim().startsWith('p.'))
        .map((c) => c.trim());
      if (positions.length > 0) {
        proteinRangeStart = positions[0];
        proteinRangeEnd = positions[positions.length - 1];
      }
      continue;
    }

    // Variant summary header row
    if (label === 'Allele' && cols[1] === 'Reference Gene') {
      awaitingVariantHeader = true;
      continue;
    }

    // Variant rows
    if (
      awaitingVariantHeader &&
      (label === 'ALLELE 1' || label === 'ALLELE 2')
    ) {
      const alleleLabel = label;
      const type = cols[2] ? cols[2].trim() : '';
      const reference = cols[3] ? cols[3].trim() : '';
      const variants = cols[4] ? cols[4].trim() : 'NO_VARIANTS';

      if (currentExon) {
        if (!exons[currentExon]) {
          exons[currentExon] = {
            qc: currentExonQc,
            protein_range:
              proteinRangeStart && proteinRangeEnd
                ? `${proteinRangeStart}-${proteinRangeEnd}`
                : null,
            variants: {},
          };
        }
        const varKey = `${alleleLabel.replace(' ', '')}_${type}`;
        exons[currentExon].variants[varKey] = variants;

        if (variants !== 'NO_VARIANTS') {
          allVariants.push({
            exon: currentExon,
            allele: alleleLabel,
            type,
            reference,
            variants,
          });
        }
      }
      continue;
    }
  }

  if (!geneSymbol) return null;

  // Build protein_range from first exon that has it
  let proteinRange = null;
  for (const exon of Object.values(exons)) {
    if (exon.protein_range) {
      proteinRange = exon.protein_range;
      break;
    }
  }

  const sequenceData = {
    exons,
    has_variants: allVariants.length > 0,
    variant_summary: allVariants,
  };

  return {
    gene_symbol: geneSymbol,
    transcript_id: transcriptId,
    protein_id: proteinId,
    protein_range: proteinRange ? proteinRange.substring(0, 30) : null,
    sequence_data: sequenceData,
    overall_qc: overallQc,
  };
}

module.exports = { parseConsensusCsv };
