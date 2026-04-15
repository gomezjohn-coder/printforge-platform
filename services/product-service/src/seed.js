const { sequelize, Artist, Category, Product } = require('./models');
const logger = require('./middleware/logger');

const artists = [
  { name: 'Sensei Ink', slug: 'sensei-ink', bio: 'Anime-inspired illustration — One Piece & Naruto fan art reimagined', avatarUrl: '/images/avatars/sensei.jpg', location: 'Tokyo, JP', totalSales: 4560 },
  { name: 'Shinobi Brush', slug: 'shinobi-brush', bio: 'Street art meets shonen anime. Hand-drawn jutsu energy.', avatarUrl: '/images/avatars/shinobi.jpg', location: 'Osaka, JP', totalSales: 3200 },
  { name: 'Straw Hat Studios', slug: 'straw-hat-studios', bio: 'Pirate-inspired art for dreamers and adventurers', avatarUrl: '/images/avatars/strawhat.jpg', location: 'Melbourne, AU', totalSales: 5100 },
  { name: 'Akatsuki Arts', slug: 'akatsuki-arts', bio: 'Dark anime aesthetics and villain arc artwork', avatarUrl: '/images/avatars/akatsuki.jpg', location: 'Berlin, DE', totalSales: 2780 },
  { name: 'Neo Tokyo Collective', slug: 'neo-tokyo', bio: 'Cyberpunk anime mashups and neon city vibes', avatarUrl: '/images/avatars/neotokyo.jpg', location: 'New York, US', totalSales: 3890 },
  { name: 'Mural Phantom', slug: 'mural-phantom', bio: 'Street murals turned wearable. Graffiti meets anime.', avatarUrl: '/images/avatars/phantom.jpg', location: 'Los Angeles, US', totalSales: 2100 },
  { name: 'Sumi-e Street', slug: 'sumi-e-street', bio: 'Traditional Japanese ink wash meets modern street style', avatarUrl: '/images/avatars/sumie.jpg', location: 'Kyoto, JP', totalSales: 1870 },
  { name: 'Kawaii Vandal', slug: 'kawaii-vandal', bio: 'Cute meets chaos. Pop culture sticker bombs.', avatarUrl: '/images/avatars/kawaii.jpg', location: 'Seoul, KR', totalSales: 4200 },
  { name: 'Grand Line Press', slug: 'grand-line-press', bio: 'Adventure-inspired prints from the Grand Line', avatarUrl: '/images/avatars/grandline.jpg', location: 'Sydney, AU', totalSales: 1560 },
  { name: 'Hokage Studio', slug: 'hokage-studio', bio: 'From genin to hokage — ninja art for true fans', avatarUrl: '/images/avatars/hokage.jpg', location: 'London, UK', totalSales: 3340 },
];

const categories = [
  { name: 'T-Shirts', slug: 't-shirts', description: 'Anime & street art tees printed on premium cotton', iconUrl: '/images/icons/tshirt.svg' },
  { name: 'Stickers', slug: 'stickers', description: 'Waterproof vinyl stickers — anime, graffiti, kawaii', iconUrl: '/images/icons/sticker.svg' },
  { name: 'Mugs', slug: 'mugs', description: 'Ceramic mugs with wraparound anime art', iconUrl: '/images/icons/mug.svg' },
  { name: 'Phone Cases', slug: 'phone-cases', description: 'Slim-fit cases with original anime designs', iconUrl: '/images/icons/phone.svg' },
  { name: 'Wall Art', slug: 'wall-art', description: 'Gallery prints — anime scenes and street murals', iconUrl: '/images/icons/art.svg' },
  { name: 'Hoodies', slug: 'hoodies', description: 'Cozy hoodies with anime-inspired artwork', iconUrl: '/images/icons/hoodie.svg' },
  { name: 'Tote Bags', slug: 'tote-bags', description: 'Canvas totes with original indie art prints', iconUrl: '/images/icons/bag.svg' },
  { name: 'Posters', slug: 'posters', description: 'High-quality anime and street art posters', iconUrl: '/images/icons/poster.svg' },
];

const productTemplates = [
  // One Piece inspired
  { title: 'Straw Hat Pirate King', tags: ['pirate', 'anime', 'adventure', 'one-piece-style'], productType: 't-shirt', price: 32.00, salesCount: 2456 },
  { title: 'Jolly Roger Flag Art', tags: ['skull', 'pirate', 'flag', 'anime'], productType: 'poster', price: 22.00, salesCount: 1892 },
  { title: 'Going Merry Voyage', tags: ['ship', 'ocean', 'adventure', 'anime'], productType: 'wall-art', price: 38.00, salesCount: 987 },
  { title: 'Devil Fruit Collection', tags: ['fruit', 'power', 'anime', 'colorful'], productType: 'sticker', price: 5.50, salesCount: 3203 },
  { title: 'Grand Line Navigator', tags: ['map', 'ocean', 'adventure', 'anime'], productType: 'mug', price: 18.00, salesCount: 1567 },
  { title: 'Pirate Crew Chibi Set', tags: ['chibi', 'cute', 'pirate', 'anime'], productType: 'sticker', price: 6.00, salesCount: 4100 },
  { title: 'Wanted Dead or Alive', tags: ['wanted', 'poster', 'bounty', 'anime'], productType: 't-shirt', price: 30.00, salesCount: 1876 },
  { title: 'Thousand Sunny Sunset', tags: ['ship', 'sunset', 'ocean', 'anime'], productType: 'phone-case', price: 24.00, salesCount: 1234 },

  // Naruto inspired
  { title: 'Shadow Clone Jutsu Art', tags: ['ninja', 'jutsu', 'anime', 'naruto-style'], productType: 't-shirt', price: 32.00, salesCount: 2890 },
  { title: 'Sharingan Eye Mandala', tags: ['eye', 'mandala', 'dark', 'anime'], productType: 'wall-art', price: 42.00, salesCount: 1543 },
  { title: 'Village Hidden in Leaves', tags: ['village', 'leaf', 'ninja', 'anime'], productType: 'hoodie', price: 52.00, salesCount: 2100 },
  { title: 'Nine Tails Fox Spirit', tags: ['fox', 'spirit', 'fire', 'anime'], productType: 'poster', price: 24.00, salesCount: 1987 },
  { title: 'Kunai & Shuriken Pack', tags: ['weapon', 'ninja', 'tools', 'anime'], productType: 'sticker', price: 5.00, salesCount: 3456 },
  { title: 'Sage Mode Meditation', tags: ['sage', 'meditation', 'nature', 'anime'], productType: 'mug', price: 18.00, salesCount: 876 },
  { title: 'Akatsuki Cloud Pattern', tags: ['cloud', 'red', 'dark', 'anime'], productType: 'hoodie', price: 55.00, salesCount: 2340 },
  { title: 'Ramen Ichiraku Bowl', tags: ['ramen', 'food', 'japan', 'anime'], productType: 'mug', price: 18.00, salesCount: 3100 },

  // Street art / indie
  { title: 'Tokyo Graffiti Nights', tags: ['graffiti', 'tokyo', 'neon', 'street'], productType: 't-shirt', price: 30.00, salesCount: 1654 },
  { title: 'Spray Can Samurai', tags: ['samurai', 'graffiti', 'street', 'japan'], productType: 'wall-art', price: 45.00, salesCount: 876 },
  { title: 'Koi Dragon Street Mural', tags: ['koi', 'dragon', 'mural', 'japan'], productType: 'poster', price: 26.00, salesCount: 1234 },
  { title: 'Neon Alley Cat', tags: ['cat', 'neon', 'alley', 'street'], productType: 'phone-case', price: 24.00, salesCount: 1678 },
  { title: 'Urban Geisha Remix', tags: ['geisha', 'urban', 'modern', 'remix'], productType: 'tote-bag', price: 24.00, salesCount: 987 },
  { title: 'Cyberpunk Ronin 2099', tags: ['cyberpunk', 'ronin', 'future', 'neon'], productType: 'hoodie', price: 52.00, salesCount: 1456 },
  { title: 'Sticker Bomb Anime Mix', tags: ['sticker', 'bomb', 'anime', 'mix'], productType: 'sticker', price: 8.00, salesCount: 5600 },
  { title: 'Cherry Blossom Drift', tags: ['cherry', 'blossom', 'japan', 'drift'], productType: 'wall-art', price: 36.00, salesCount: 1100 },

  // Anime mashup / general
  { title: 'Anime Eyes Collection', tags: ['eyes', 'anime', 'manga', 'art'], productType: 'sticker', price: 5.50, salesCount: 4500 },
  { title: 'Mecha Robot Battle', tags: ['mecha', 'robot', 'battle', 'anime'], productType: 't-shirt', price: 32.00, salesCount: 1890 },
  { title: 'Kawaii Food Gang', tags: ['kawaii', 'food', 'cute', 'japan'], productType: 'sticker', price: 4.50, salesCount: 6200 },
  { title: 'Sunset Samurai Silhouette', tags: ['samurai', 'sunset', 'silhouette', 'japan'], productType: 'poster', price: 22.00, salesCount: 2100 },
  { title: 'Dragon Ball Training', tags: ['dragon', 'training', 'gym', 'anime'], productType: 'hoodie', price: 50.00, salesCount: 1780 },
  { title: 'Spirit Mask Festival', tags: ['mask', 'spirit', 'festival', 'japan'], productType: 'phone-case', price: 24.00, salesCount: 1345 },
  { title: 'Onigiri Rice Ball Crew', tags: ['onigiri', 'food', 'cute', 'kawaii'], productType: 'mug', price: 16.00, salesCount: 2300 },
  { title: 'Manga Panel Explosion', tags: ['manga', 'panel', 'action', 'comic'], productType: 'wall-art', price: 40.00, salesCount: 1567 },
  { title: 'Bonsai Master', tags: ['bonsai', 'tree', 'zen', 'japan'], productType: 'tote-bag', price: 22.00, salesCount: 890 },
  { title: 'Pixel Ninja Runner', tags: ['pixel', 'ninja', 'retro', 'gaming'], productType: 'sticker', price: 4.50, salesCount: 3400 },
  { title: 'Ink Wash Dragon', tags: ['ink', 'dragon', 'traditional', 'sumi-e'], productType: 'poster', price: 28.00, salesCount: 1200 },
  { title: 'Harajuku Street Style', tags: ['harajuku', 'fashion', 'street', 'tokyo'], productType: 't-shirt', price: 30.00, salesCount: 1654 },
  { title: 'Demon Slayer Moon', tags: ['demon', 'moon', 'sword', 'anime'], productType: 'hoodie', price: 55.00, salesCount: 2890 },
  { title: 'Lucky Cat Neko Wave', tags: ['cat', 'lucky', 'neko', 'wave'], productType: 'phone-case', price: 24.00, salesCount: 1876 },
  { title: 'Anime Sunset Rooftop', tags: ['sunset', 'rooftop', 'chill', 'anime'], productType: 'wall-art', price: 38.00, salesCount: 1450 },
  { title: 'Tanuki Raccoon Spirit', tags: ['tanuki', 'raccoon', 'spirit', 'folklore'], productType: 'mug', price: 18.00, salesCount: 1100 },
  { title: 'Kanji Fire Water Earth', tags: ['kanji', 'elements', 'japan', 'brush'], productType: 'tote-bag', price: 22.00, salesCount: 780 },
  { title: 'Tokyo Tower Dreamscape', tags: ['tokyo', 'tower', 'dream', 'city'], productType: 'poster', price: 24.00, salesCount: 1340 },
  { title: 'Shonen Jump Energy', tags: ['energy', 'power', 'shonen', 'anime'], productType: 't-shirt', price: 32.00, salesCount: 2100 },
  { title: 'Sakura Petals Drift', tags: ['sakura', 'petals', 'spring', 'japan'], productType: 'sticker', price: 4.00, salesCount: 5400 },
  { title: 'Vending Machine Glow', tags: ['vending', 'machine', 'night', 'japan'], productType: 'phone-case', price: 24.00, salesCount: 1567 },
  { title: 'Rogue Ninja Scroll', tags: ['ninja', 'scroll', 'rogue', 'dark'], productType: 'hoodie', price: 52.00, salesCount: 1890 },
  { title: 'Matcha Latte Art', tags: ['matcha', 'latte', 'art', 'cafe'], productType: 'mug', price: 16.00, salesCount: 2400 },
  { title: 'Wave Off Kanagawa Remix', tags: ['wave', 'kanagawa', 'remix', 'ukiyo-e'], productType: 'wall-art', price: 44.00, salesCount: 1876 },
  { title: 'Three Sword Style Legend', tags: ['swordsman', 'anime', 'pirate', 'legend'], productType: 't-shirt', price: 34.00, salesCount: 3200 },
];

async function seedDatabase() {
  try {
    const existingProducts = await Product.count();
    if (existingProducts > 0) {
      logger.info('Database already seeded, skipping');
      return;
    }

    const createdArtists = await Artist.bulkCreate(artists);
    logger.info(`Seeded ${createdArtists.length} artists`);

    const createdCategories = await Category.bulkCreate(categories);
    logger.info(`Seeded ${createdCategories.length} categories`);

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

if (require.main === module) {
  sequelize.sync({ force: true }).then(() => seedDatabase()).then(() => process.exit(0));
}
