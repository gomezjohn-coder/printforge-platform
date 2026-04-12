const express = require('express');
const { Artist, Product, Category } = require('../models');
const router = express.Router();

// GET /api/v1/artists — List all artists
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sort = 'popular' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const order = sort === 'popular'
      ? [['totalSales', 'DESC']]
      : [['joinedAt', 'DESC']];

    const { count, rows: artists } = await Artist.findAndCountAll({
      order,
      limit: parseInt(limit),
      offset,
    });

    res.json({
      data: artists,
      meta: { total: count, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/artists/:slug — Get artist profile with their products
router.get('/:slug', async (req, res, next) => {
  try {
    const artist = await Artist.findOne({
      where: { slug: req.params.slug },
      include: [{
        model: Product,
        as: 'products',
        where: { isActive: true },
        required: false,
        include: [{ model: Category, as: 'category', attributes: ['name', 'slug'] }],
        order: [['salesCount', 'DESC']],
      }],
    });

    if (!artist) {
      return res.status(404).json({ error: { message: 'Artist not found' } });
    }

    res.json({ data: artist });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
