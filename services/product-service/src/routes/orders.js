const express = require('express');
const { Order, Product } = require('../models');
const { ordersTotal } = require('../middleware/metrics');
const logger = require('../middleware/logger');
const router = express.Router();

// POST /api/v1/orders — Create a new order
router.post('/', async (req, res, next) => {
  try {
    const { customerEmail, items, shippingAddress } = req.body;

    if (!customerEmail || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: { message: 'customerEmail and items[] are required' },
      });
    }

    // Calculate total from product prices
    let totalAmount = 0;
    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        return res.status(400).json({
          error: { message: `Product ${item.productId} not found` },
        });
      }
      totalAmount += parseFloat(product.price) * (item.quantity || 1);
    }

    const order = await Order.create({
      customerEmail,
      totalAmount,
      items,
      shippingAddress,
      status: 'confirmed',
    });

    // Increment order metrics for SLO tracking
    ordersTotal.inc({ status: 'confirmed' });

    logger.info({ orderId: order.id, total: totalAmount, requestId: req.id }, 'Order created');

    res.status(201).json({ data: order });
  } catch (err) {
    ordersTotal.inc({ status: 'failed' });
    next(err);
  }
});

// GET /api/v1/orders/:id — Get order by ID
router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: { message: 'Order not found' } });
    }
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
