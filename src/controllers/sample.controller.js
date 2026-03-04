const sampleService = require('../services/sample.service');
const ResponseUtil = require('../utils/response.util');

class SampleController {
  async listSamples(req, res, next) {
    try {
      const {
        site_id,
        validation_status,
        abo_type,
        date_from,
        date_to,
        has_ambiguous,
        has_unexpected,
        page,
        limit,
      } = req.query;

      const result = await sampleService.listSamples({
        site_id,
        validation_status,
        abo_type,
        date_from,
        date_to,
        has_ambiguous,
        has_unexpected,
        page,
        limit,
      });

      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getSampleById(req, res, next) {
    try {
      const { id } = req.params;
      const sample = await sampleService.getSampleById(id);

      if (!sample) {
        return ResponseUtil.notFound(res, 'Sample not found');
      }

      return ResponseUtil.success(res, sample);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SampleController();
