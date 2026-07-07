const express = require("express");
const router = express.Router();

/**
 * GET /api/notes/:weekKey
 */
router.get("/:weekKey", async (req, res) => {
  try {
    const { weekKey } = req.params;

    // TODO: load from DB
    res.json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/notes/:weekKey
 */
router.post("/:weekKey", async (req, res) => {
  try {
    const { weekKey } = req.params;
    const { tutorName, dayId, note } = req.body;

    // TODO: save to DB

    res.json({
      success: true,
      weekKey,
      tutorName,
      dayId,
      note,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;