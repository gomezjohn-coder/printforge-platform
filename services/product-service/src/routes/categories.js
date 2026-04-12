const express = require('express');
const { Category, Product } = require('../models');
const { Sequelize } = require('sequelize');
const router = express.Router();

// GET /api/v1/categories — List all categories with product counts
router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      attributes: {
        include: [
          [Sequelize.fn('COUNT', Sequelize.col('products.id')), 'productCount'],
        ],
      },
      include: [{
        model: Product,
        as: 'products',
        attributes: [],
        where: { isActive: true },
        required: false,
      }],
      group: ['Category.id'],
      order: [['name', 'ASC']],
    });

    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/categories/:slug — Get category with products
router.get('/:slug', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sort = 'popular' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const category = await Category.findOne({
      where: { slug: req.params.slug },
    });

    if (!category) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }

    const order = sort === 'popular'
      ? [['salesCount', 'DESC']]
      : [['createdAt', 'DESC']];

    const { count, rows: products } = await Product.findAndCountAll({
      where: { categoryId: category.id, isActive: true },
      include: [{ model: require('../models').Artist, as: 'artist', attributes: ['id', 'name', 'slug', 'avatarUrl'] }],
      order,
      limit: parseInt(limit),
      offset,
    });

    res.json({
      data: { ...category.toJSON(), products },
      meta: { total: count, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
