const { Sequelize, DataTypes } = require('sequelize');

// Use PostgreSQL in production/staging, SQLite in-memory for local dev
const isProduction = process.env.NODE_ENV === 'production';
const sequelize = isProduction
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      pool: { max: 20, min: 5, idle: 10000 },
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: process.env.DB_PATH || ':memory:',
      logging: false,
    });

// ─── Artist Model ────────────────────────────────────────
const Artist = sequelize.define('Artist', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, unique: true, allowNull: false },
  bio: { type: DataTypes.TEXT },
  avatarUrl: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  totalSales: { type: DataTypes.INTEGER, defaultValue: 0 },
  joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// ─── Category Model ──────────────────────────────────────
const Category = sequelize.define('Category', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  slug: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.TEXT },
  iconUrl: { type: DataTypes.STRING },
});

// ─── Product Model ───────────────────────────────────────
const Product = sequelize.define('Product', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.TEXT },
  imageUrl: { type: DataTypes.STRING },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  productType: { type: DataTypes.ENUM('t-shirt', 'hoodie', 'sticker', 'mug', 'phone-case', 'wall-art', 'tote-bag', 'poster'), allowNull: false },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  salesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

// ─── Order Model ─────────────────────────────────────────
const Order = sequelize.define('Order', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customerEmail: { type: DataTypes.STRING, allowNull: false },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'), defaultValue: 'pending' },
  shippingAddress: { type: DataTypes.JSON },
  items: { type: DataTypes.JSON, allowNull: false },
});

// ─── Associations ────────────────────────────────────────
Artist.hasMany(Product, { foreignKey: 'artistId', as: 'products' });
Product.belongsTo(Artist, { foreignKey: 'artistId', as: 'artist' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

module.exports = { sequelize, Artist, Category, Product, Order };
