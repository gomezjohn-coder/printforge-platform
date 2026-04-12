const express = require('express');
const { Product, Artist, Category } = require('../models');
const logger = require('../middleware/logger');
const router = express.Router();

// GET /api/v1/products — List products with filtering, pagination, sorting
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      productType,
      artist,
      sort = 'newest',
      search,
    } = req.query;

    const where = { isActive: true };
    if (category) where['$category.slug$'] = category;
    if (productType) where.productType = productType;
    if (artist) where['$artist.slug$'] = artist;

    const order = {
      newest: [['createdAt', 'DESC']],
      popular: [['salesCount', 'DESC']],
      'price-low': [['price', 'ASC']],
      'price-high': [['price', 'DESC']],
    }[sort] || [['createdAt', 'DESC']];

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        { model: Artist, as: 'artist', attributes: ['id', 'name', 'slug', 'avatarUrl'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      ],
      order,
      limit: parseInt(limit),
      offset,
      subQuery: false,
    });

    res.json({
      data: products,
      meta: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/featured — Featured products for homepage
router.get('/featured', async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { isActive: true },
      include: [
        { model: Artist, as: 'artist', attributes: ['id', 'name', 'slug', 'avatarUrl'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      ],
      order: [['salesCount', 'DESC']],
      limit: 12,
    });
    res.json({ data: products });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/:slug — Get single product
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { slug: req.params.slug, isActive: true },
      include: [
        { model: Artist, as: 'artist', attributes: ['id', 'name', 'slug', 'avatarUrl', 'bio'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      ],
    });

    if (!product) {
      return res.status(404).json({ error: { message: 'Product not found' } });
    }

    // Fetch related products by same artist
    const relatedProducts = await Product.findAll({
      where: { artistId: product.artistId, isActive: true, id: { [require('sequelize').Op.ne]: product.id } },
      limit: 4,
      order: [['salesCount', 'DESC']],
    });

    res.json({ data: { ...product.toJSON(), relatedProducts } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
