const { sequelize, Artist, Category, Product } = require('./models');
const logger = require('./middleware/logger');

const artists = [
  { name: 'Luna Creative Studio', slug: 'luna-creative', bio: 'Dreamy illustrations inspired by nature and cosmos', avatarUrl: '/images/avatars/luna.jpg', location: 'Melbourne, AU', totalSales: 2340 },
  { name: 'PixelPunk Design', slug: 'pixelpunk', bio: 'Retro gaming and cyberpunk aesthetics', avatarUrl: '/images/avatars/pixel.jpg', location: 'New York, US', totalSales: 1876 },
  { name: 'Wildflower Art Co', slug: 'wildflower-art', bio: 'Botanical illustrations and floral patterns', avatarUrl: '/images/avatars/wildflower.jpg', location: 'London, UK', totalSales: 3102 },
  { name: 'Cosmic Ink', slug: 'cosmic-ink', bio: 'Space-themed artwork and sci-fi designs', avatarUrl: '/images/avatars/cosmic.jpg', location: 'Tokyo, JP', totalSales: 1543 },
  { name: 'Street Canvas', slug: 'street-canvas', bio: 'Urban art inspired by street culture', avatarUrl: '/images/avatars/street.jpg', location: 'Berlin, DE', totalSales: 987 },
  { name: 'MinimalForm', slug: 'minimalform', bio: 'Clean minimalist designs and typography', avatarUrl: '/images/avatars/minimal.jpg', location: 'Copenhagen, DK', totalSales: 2210 },
  { name: 'Fauna & Flora', slug: 'fauna-flora', bio: 'Wildlife and nature conservation art', avatarUrl: '/images/avatars/fauna.jpg', location: 'Sydney, AU', totalSales: 1654 },
  { name: 'RetroWave Studios', slug: 'retrowave', bio: 'Synthwave and 80s nostalgia artwork', avatarUrl: '/images/avatars/retro.jpg', location: 'Los Angeles, US', totalSales: 2890 },
  { name: 'Inkwell Collective', slug: 'inkwell', bio: 'Hand-drawn illustrations and sketch art', avatarUrl: '/images/avatars/inkwell.jpg', location: 'Portland, US', totalSales: 1120 },
  { name: 'Neon Dreams', slug: 'neon-dreams', bio: 'Vibrant neon-inspired pop art and culture', avatarUrl: '/images/avatars/neon.jpg', location: 'Seoul, KR', totalSales: 1780 },
];

const categories = [
  { name: 'T-Shirts', slug: 't-shirts', description: 'Premium quality t-shirts with unique designs', iconUrl: '/images/icons/tshirt.svg' },
  { name: 'Stickers', slug: 'stickers', description: 'Durable vinyl stickers for laptops, bottles, and more', iconUrl: '/images/icons/sticker.svg' },
  { name: 'Mugs', slug: 'mugs', description: 'Ceramic mugs with wraparound prints', iconUrl: '/images/icons/mug.svg' },
  { name: 'Phone Cases', slug: 'phone-cases', description: 'Slim-fit cases for all popular phone models', iconUrl: '/images/icons/phone.svg' },
  { name: 'Wall Art', slug: 'wall-art', description: 'Gallery-quality prints and canvas art', iconUrl: '/images/icons/art.svg' },
  { name: 'Hoodies', slug: 'hoodies', description: 'Cozy hoodies with premium print quality', iconUrl: '/images/icons/hoodie.svg' },
  { name: 'Tote Bags', slug: 'tote-bags', description: 'Durable cotton tote bags with all-over prints', iconUrl: '/images/icons/bag.svg' },
  { name: 'Posters', slug: 'posters', description: 'High-quality paper prints in multiple sizes', iconUrl: '/images/icons/poster.svg' },
];

const productTemplates = [
  { title: 'Celestial Cat Galaxy', tags: ['cat', 'space', 'galaxy', 'cute'], productType: 't-shirt', price: 28.00, salesCount: 456 },
  { title: 'Retro Sunset Vibes', tags: ['retro', 'sunset', 'vaporwave', '80s'], productType: 't-shirt', price: 26.00, salesCount: 892 },
  { title: 'Botanical Dreams', tags: ['flowers', 'botanical', 'nature', 'garden'], productType: 'mug', price: 16.00, salesCount: 334 },
  { title: 'Pixel Adventure Hero', tags: ['gaming', 'pixel', 'retro', '8bit'], productType: 'sticker', price: 4.50, salesCount: 1203 },
  { title: 'Mountain Wanderer', tags: ['mountain', 'hiking', 'nature', 'adventure'], productType: 'hoodie', price: 45.00, salesCount: 567 },
  { title: 'Tokyo Neon Nights', tags: ['japan', 'neon', 'city', 'night'], productType: 'wall-art', price: 35.00, salesCount: 289 },
  { title: 'Geometric Wolf', tags: ['wolf', 'geometric', 'animal', 'minimal'], productType: 't-shirt', price: 28.00, salesCount: 678 },
  { title: 'Coffee & Code', tags: ['coffee', 'programming', 'developer', 'tech'], productType: 'mug', price: 16.00, salesCount: 945 },
  { title: 'Ocean Wave Mandala', tags: ['ocean', 'wave', 'mandala', 'zen'], productType: 'phone-case', price: 22.00, salesCount: 412 },
  { title: 'Vintage Vinyl Records', tags: ['music', 'vinyl', 'retro', 'vintage'], productType: 'tote-bag', price: 20.00, salesCount: 523 },
  { title: 'Aurora Borealis Fox', tags: ['fox', 'aurora', 'nature', 'northern-lights'], productType: 'poster', price: 18.00, salesCount: 367 },
  { title: 'Cyberpunk City 2099', tags: ['cyberpunk', 'scifi', 'future', 'city'], productType: 'wall-art', price: 40.00, salesCount: 234 },
  { title: 'Succulent Garden', tags: ['succulent', 'plant', 'garden', 'green'], productType: 'sticker', price: 5.00, salesCount: 876 },
  { title: 'Samurai Spirit', tags: ['samurai', 'japan', 'warrior', 'art'], productType: 't-shirt', price: 28.00, salesCount: 543 },
  { title: 'Abstract Color Splash', tags: ['abstract', 'color', 'modern', 'art'], productType: 'phone-case', price: 22.00, salesCount: 321 },
  { title: 'Bee Kind Save Bees', tags: ['bee', 'nature', 'save', 'environment'], productType: 'tote-bag', price: 20.00, salesCount: 654 },
  { title: 'Synthwave Sunset Drive', tags: ['synthwave', '80s', 'car', 'sunset'], productType: 'poster', price: 18.00, salesCount: 789 },
  { title: 'Watercolor Whale', tags: ['whale', 'ocean', 'watercolor', 'sea'], productType: 'hoodie', price: 48.00, salesCount: 432 },
  { title: 'Minimal Line Portrait', tags: ['minimal', 'line', 'portrait', 'art'], productType: 'wall-art', price: 32.00, salesCount: 267 },
  { title: 'Ramen Bowl Paradise', tags: ['ramen', 'food', 'japan', 'kawaii'], productType: 't-shirt', price: 26.00, salesCount: 1098 },
  { title: 'Dark Mode Developer', tags: ['developer', 'coding', 'dark-mode', 'tech'], productType: 'sticker', price: 4.50, salesCount: 1543 },
  { title: 'Wildflower Meadow', tags: ['wildflower', 'meadow', 'botanical', 'spring'], productType: 'mug', price: 16.00, salesCount: 398 },
  { title: 'Space Odyssey Cat', tags: ['cat', 'space', 'astronaut', 'cute'], productType: 'phone-case', price: 22.00, salesCount: 567 },
  { title: 'Vintage Map Explorer', tags: ['map', 'vintage', 'travel', 'adventure'], productType: 'poster', price: 20.00, salesCount: 345 },
  { title: 'Mushroom Forest Magic', tags: ['mushroom', 'forest', 'fantasy', 'nature'], productType: 'hoodie', price: 45.00, salesCount: 623 },
  { title: 'Koi Fish Pond', tags: ['koi', 'fish', 'japan', 'zen'], productType: 'wall-art', price: 38.00, salesCount: 289 },
  { title: 'Stay Pawsitive', tags: ['dog', 'pun', 'cute', 'positive'], productType: 'sticker', price: 4.00, salesCount: 1876 },
  { title: 'Cactus Club', tags: ['cactus', 'desert', 'plant', 'minimal'], productType: 'tote-bag', price: 20.00, salesCount: 432 },
  { title: 'Vaporwave Sunset Palm', tags: ['vaporwave', 'palm', 'aesthetic', '90s'], productType: 't-shirt', price: 28.00, salesCount: 765 },
  { title: 'Origami Crane Pattern', tags: ['origami', 'japan', 'pattern', 'minimal'], productType: 'mug', price: 16.00, salesCount: 234 },
  { title: 'Constellation Map', tags: ['stars', 'constellation', 'astronomy', 'space'], productType: 'poster', price: 22.00, salesCount: 543 },
  { title: 'Taco Tuesday Party', tags: ['taco', 'food', 'funny', 'party'], productType: 't-shirt', price: 26.00, salesCount: 987 },
  { title: 'Geometric Bear', tags: ['bear', 'geometric', 'animal', 'nature'], productType: 'hoodie', price: 48.00, salesCount: 345 },
  { title: 'Neon Tiger Roar', tags: ['tiger', 'neon', 'animal', 'fierce'], productType: 'wall-art', price: 35.00, salesCount: 456 },
  { title: 'Plant Mom Life', tags: ['plant', 'mom', 'garden', 'green'], productType: 'mug', price: 16.00, salesCount: 678 },
  { title: 'Retro Cassette Mix', tags: ['cassette', 'music', 'retro', '90s'], productType: 'sticker', price: 5.00, salesCount: 1234 },
  { title: 'Deep Sea Diver', tags: ['ocean', 'diver', 'underwater', 'adventure'], productType: 'phone-case', price: 22.00, salesCount: 289 },
  { title: 'Monstera Leaf Pattern', tags: ['monstera', 'leaf', 'tropical', 'pattern'], productType: 'tote-bag', price: 20.00, salesCount: 534 },
  { title: 'Pixel Cat Loading', tags: ['cat', 'pixel', 'gaming', 'loading'], productType: 'sticker', price: 4.50, salesCount: 1654 },
  { title: 'Solar System Planets', tags: ['planets', 'solar', 'space', 'science'], productType: 'poster', price: 20.00, salesCount: 432 },
  { title: 'Zen Garden Stones', tags: ['zen', 'garden', 'stones', 'meditation'], productType: 'wall-art', price: 30.00, salesCount: 198 },
  { title: 'Coffee Monster', tags: ['coffee', 'monster', 'funny', 'morning'], productType: 't-shirt', price: 26.00, salesCount: 876 },
  { title: 'Arctic Fox Snow', tags: ['fox', 'arctic', 'snow', 'winter'], productType: 'hoodie', price: 48.00, salesCount: 345 },
  { title: 'Rainbow Pride Wave', tags: ['rainbow', 'pride', 'wave', 'love'], productType: 'sticker', price: 4.00, salesCount: 2100 },
  { title: 'Steampunk Owl Clock', tags: ['steampunk', 'owl', 'clock', 'vintage'], productType: 'mug', price: 16.00, salesCount: 234 },
  { title: 'Cherry Blossom Path', tags: ['cherry', 'blossom', 'japan', 'spring'], productType: 'phone-case', price: 22.00, salesCount: 567 },
  { title: 'Disco Ball Night', tags: ['disco', 'party', 'retro', 'dance'], productType: 't-shirt', price: 28.00, salesCount: 432 },
  { title: 'Penguin Parade', tags: ['penguin', 'cute', 'animal', 'winter'], productType: 'sticker', price: 4.50, salesCount: 1432 },
  { title: 'Abstract Mountains', tags: ['mountain', 'abstract', 'landscape', 'minimal'], productType: 'wall-art', price: 35.00, salesCount: 367 },
  { title: 'Donut Worry Be Happy', tags: ['donut', 'happy', 'food', 'pun'], productType: 'tote-bag', price: 20.00, salesCount: 654 },
];

async function seedDatabase() {
  try {
    // Check if data already exists
    const existingProducts = await Product.count();
    if (existingProducts > 0) {
      logger.info('Database already seeded, skipping');
      return;
    }

    // Create artists
    const createdArtists = await Artist.bulkCreate(artists);
    logger.info(`Seeded ${createdArtists.length} artists`);

    // Create categories
    const createdCategories = await Category.bulkCreate(categories);
    logger.info(`Seeded ${createdCategories.length} categories`);

    // Create products — distribute across artists and categories
    const products = productTemplates.map((template, index) => {
      const artist = createdArtists[index % createdArtists.length];
      const category = createdCategories.find(c =>
        c.slug === template.productType + 's' ||
        c.slug === template.productType.replace('-', '-') + 's'
      ) || createdCategories[index % createdCategories.length];

      return {
        ...template,
        slug: template.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        imageUrl: `/images/products/${template.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`,
        artistId: artist.id,
        categoryId: category.id,
      };
    });

    const createdProducts = await Product.bulkCreate(products);
    logger.info(`Seeded ${createdProducts.length} products`);

    logger.info('Database seeding complete');
  } catch (err) {
    logger.error({ err }, 'Failed to seed database');
    throw err;
  }
}

module.exports = { seedDatabase };

// Allow direct execution: node src/seed.js
if (require.main === module) {
  sequelize.sync({ force: true }).then(() => seedDatabase()).then(() => process.exit(0));
}
