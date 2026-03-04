/**
 * Parser for sampleDetailsLong.tsv
 *
 * File format (tab-separated):
 *   SampleID | Category | Key | Value
 *
 * Categories:
 *   Metadata            → QC metrics, plate info
 *   predicted_phenotype → Antigen results (key: PANEL;GENE;GROUP;ANTIGEN)
 *   isbt_genotype       → ISBT allele calls (key: PANEL;GENE;GROUP)
 *   additional_data     → Extra data (RHD copy numbers, etc.)
 */

// Maps antigen name (as it appears in the TSV) → native DB column in samples table
const ANTIGEN_TO_COLUMN = {
  RhD: 'rh_d',
  C: 'rh_cc',
  c: 'rh_c',
  E: 'rh_ee',
  e: 'rh_e',
  K: 'kel_kk',
  k: 'kel_k',
  Kpa: 'kel_kpa',
  Kpb: 'kel_kpb',
  Fya: 'fy_fya',
  Fyb: 'fy_fyb',
  Jka: 'jk_jka',
  Jkb: 'jk_jkb',
  M: 'mns_m',
  N: 'mns_n',
  S: 'mns_ss',
  s: 'mns_s',
  U: 'mns_u',
  Dia: 'di_dia',
  Dib: 'di_dib',
  Doa: 'do_doa',
  Dob: 'do_dob',
  Coa: 'co_coa',
  Cob: 'co_cob',
};

// Normalize phenotype values: ++ is still positive, blank → null
function normalizePhenotype(value) {
  if (!value || value.trim() === '' || value.trim() === 'NA') return null;
  const v = value.trim();
  if (v === '++') return '+';
  return v;
}

/**
 * Parse a sampleDetailsLong.tsv buffer.
 * @param {Buffer} fileBuffer
 * @returns {object} Parsed sample data ready for DB insertion
 */
function parseSampleDetailsLong(fileBuffer) {
  const text = fileBuffer.toString('utf-8');
  const lines = text.split(/\r?\n/);

  const metadata = {};
  const antigenPhenotypes = {};
  const genotypes = {};
  const nativeColumns = {};
  let sampleId = null;
  let hasAmbiguous = false;
  let hasUnexpected = false;
  let hasNovelVariant = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split('\t');
    if (cols.length < 4) continue;

    const [rowSampleId, category, key, value] = cols;

    // Capture SampleID from first data row
    if (!sampleId && rowSampleId && rowSampleId !== 'SampleID') {
      sampleId = rowSampleId.trim();
    }

    // Skip header row
    if (rowSampleId === 'SampleID') continue;

    const cat = category ? category.trim() : '';
    const k = key ? key.trim() : '';
    const v = value ? value.trim() : '';

    if (cat === 'Metadata') {
      metadata[k] = v;
    } else if (cat === 'predicted_phenotype') {
      // Key format: PANEL;GENE;GROUP;ANTIGEN_NAME
      const parts = k.split(';');
      const antigenName = parts[parts.length - 1];
      const normalized = normalizePhenotype(v);

      if (normalized !== null) {
        antigenPhenotypes[antigenName] = normalized;

        // Map to native column if applicable
        const col = ANTIGEN_TO_COLUMN[antigenName];
        if (col) {
          nativeColumns[col] = normalized;
        }

        // Flag detection
        if (normalized === 'AMB') hasAmbiguous = true;
        if (normalized === 'UNX') hasUnexpected = true;
        if (normalized === 'NOVEL') hasNovelVariant = true;
      }
    } else if (cat === 'isbt_genotype') {
      // Key format: PANEL;GENE;GROUP
      const parts = k.split(';');
      if (parts.length >= 3) {
        const gene = parts[1];
        const group = parts[2];
        const genotypeKey = `${gene}_${group}`;
        if (v && v !== 'NA') {
          genotypes[genotypeKey] = v;
        }
      }
    }
    // additional_data is parsed but not stored separately (ignored for now)
  }

  // Extract metadata fields
  const plateId = metadata['Plate'] || null;
  const sampleNumber = metadata['snum'] ? String(metadata['snum']) : null;
  const qcCoreStatus = metadata['Panel QC;CORE'] || null;
  const qcCoreReads = metadata['Panel Read Pairs;CORE']
    ? parseInt(metadata['Panel Read Pairs;CORE'], 10) || null
    : null;
  const qcExpandedStatus = metadata['Panel QC;EXPANDED'] || null;
  const qcExpandedReads = metadata['Panel Read Pairs;EXPANDED']
    ? parseInt(metadata['Panel Read Pairs;EXPANDED'], 10) || null
    : null;
  const qcPlusStatus = metadata['Panel QC;PLUS'] || null;
  const qcPlusReads = metadata['Panel Read Pairs;PLUS']
    ? parseInt(metadata['Panel Read Pairs;PLUS'], 10) || null
    : null;
  const rhdCopyNumberQc = metadata['RHD Copy Number QC'] || null;
  const estimatedDnaNG = metadata['Estimated DNA (ng)']
    ? parseFloat(metadata['Estimated DNA (ng)']) || null
    : null;
  const contaminationScore = metadata['Contamination Score']
    ? parseFloat(metadata['Contamination Score']) || null
    : null;
  const primerDimerFraction = metadata['Primer Dimer Fraction']
    ? parseFloat(metadata['Primer Dimer Fraction']) || null
    : null;

  const phenotypesCount = Object.keys(antigenPhenotypes).length;

  return {
    sampleId,
    plateId,
    sampleNumber,
    qcCoreStatus,
    qcCoreReads,
    qcExpandedStatus,
    qcExpandedReads,
    qcPlusStatus,
    qcPlusReads,
    rhdCopyNumberQc,
    estimatedDnaNG,
    contaminationScore,
    primerDimerFraction,
    antigenPhenotypes,
    genotypes,
    nativeColumns,
    hasAmbiguous,
    hasUnexpected,
    hasNovelVariant,
    phenotypesCount,
  };
}

module.exports = { parseSampleDetailsLong };
