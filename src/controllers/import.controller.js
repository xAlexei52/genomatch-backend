const ResponseUtil = require('../utils/response.util');
const {
  parseSampleDetailsLong,
} = require('../utils/parsers/sampleDetails.parser');
const { parseAlleleTsv } = require('../utils/parsers/allele.parser');
const { parseConsensusCsv } = require('../utils/parsers/consensus.parser');
const { importSample } = require('../services/import.service');

class ImportController {
  /**
   * POST /api/v1/import/run
   *
   * Accepts multipart/form-data with:
   *   - sampleDetails (file, required): sampleDetailsLong.tsv
   *   - alleles       (files[], optional): allele TSV files
   *   - consensus     (files[], optional): consensus CSV files
   *   - site_id       (body, required)
   *   - runDate       (body, required): ISO date string "YYYY-MM-DD"
   *   - instrument    (body, optional)
   *   - panelType     (body, optional, default: 'RBCPv3')
   *   - donorId       (body, optional)
   */
  async importRun(req, res) {
    try {
      // ---- Validate required file ----
      if (
        !req.files ||
        !req.files['sampleDetails'] ||
        req.files['sampleDetails'].length === 0
      ) {
        return ResponseUtil.badRequest(
          res,
          'sampleDetails file is required (sampleDetailsLong.tsv)'
        );
      }

      // ---- Validate required body fields ----
      const { site_id, runDate, instrument, panelType, donorId } = req.body;

      if (!site_id) {
        return ResponseUtil.badRequest(res, 'site_id is required');
      }
      if (!runDate) {
        return ResponseUtil.badRequest(
          res,
          'runDate is required (ISO date, e.g. "2024-06-15")'
        );
      }

      // Basic UUID format check for site_id
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(site_id)) {
        return ResponseUtil.badRequest(res, 'site_id must be a valid UUID');
      }

      // ---- Parse sampleDetailsLong.tsv ----
      const sampleDetailsFile = req.files['sampleDetails'][0];
      let parsedDetails;
      try {
        parsedDetails = parseSampleDetailsLong(sampleDetailsFile.buffer);
      } catch (parseError) {
        return ResponseUtil.badRequest(
          res,
          `Failed to parse sampleDetails file: ${parseError.message}`
        );
      }

      if (!parsedDetails.plateId || !parsedDetails.sampleNumber) {
        return ResponseUtil.badRequest(
          res,
          'sampleDetails file is missing required metadata (Plate or snum). Verify it is a sampleDetailsLong.tsv file.'
        );
      }

      // ---- Parse allele TSV files (optional) ----
      const alleleRows = [];
      if (req.files['alleles'] && req.files['alleles'].length > 0) {
        for (const file of req.files['alleles']) {
          try {
            const rows = parseAlleleTsv(file.buffer);
            alleleRows.push(...rows);
          } catch (parseError) {
            console.warn(
              `Warning: failed to parse allele file ${file.originalname}: ${parseError.message}`
            );
          }
        }
      }

      // ---- Parse consensus CSV files (optional) ----
      const consensusRows = [];
      if (req.files['consensus'] && req.files['consensus'].length > 0) {
        for (const file of req.files['consensus']) {
          try {
            const row = parseConsensusCsv(file.buffer);
            if (row) consensusRows.push(row);
          } catch (parseError) {
            console.warn(
              `Warning: failed to parse consensus file ${file.originalname}: ${parseError.message}`
            );
          }
        }
      }

      // ---- Import to database ----
      const result = await importSample({
        parsedDetails,
        alleleRows,
        consensusRows,
        siteId: site_id,
        runDate,
        instrument: instrument || null,
        panelType: panelType || 'RBCPv3',
        donorId: donorId || null,
      });

      return ResponseUtil.success(
        res,
        result,
        'Sample imported successfully',
        201
      );
    } catch (error) {
      console.error('Import error:', error);

      // Return user-friendly DB errors
      if (error.code === '23503') {
        return ResponseUtil.badRequest(
          res,
          `Invalid reference: ${error.detail || error.message}`
        );
      }
      if (error.code === '23505') {
        return ResponseUtil.badRequest(
          res,
          `Duplicate entry: ${error.detail || error.message}`
        );
      }

      return ResponseUtil.error(res, `Import failed: ${error.message}`, 500);
    }
  }
}

module.exports = new ImportController();
