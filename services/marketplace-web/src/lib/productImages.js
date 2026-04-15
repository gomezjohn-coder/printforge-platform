// Product images — mapped by product slug to local files in /public/products/
// Images are AI-generated anime/street art designs

const PRODUCT_IMAGE_MAP = {
  'straw-hat-pirate-king': '/products/1.png',
  'jolly-roger-flag-art': '/products/2.jpg',
  'going-merry-voyage': '/products/3.jpg',
  'devil-fruit-collection': '/products/4.jpg',
  'grand-line-navigator': '/products/5.jpg',
  'pirate-crew-chibi-set': '/products/6.jpg',
  'wanted-dead-or-alive': '/products/7.jpg',
  'thousand-sunny-sunset': '/products/8.jpg',
  'shadow-clone-jutsu-art': '/products/9.jpg',
  'sharingan-eye-mandala': '/products/10.jpg',
  'village-hidden-in-leaves': '/products/11.jpg',
  'nine-tails-fox-spirit': '/products/12.png',
  'kunai-shuriken-pack': '/products/13.jpg',
  'sage-mode-meditation': '/products/14.png',
  'akatsuki-cloud-pattern': '/products/15.png',
  'ramen-ichiraku-bowl': '/products/16.png',
  'tokyo-graffiti-nights': '/products/17.png',
  'spray-can-samurai': '/products/18.png',
  'koi-dragon-street-mural': '/products/19.png',
  'neon-alley-cat': '/products/20.png',
  'urban-geisha-remix': '/products/21.png',
  'cyberpunk-ronin-2099': '/products/22.png',
  'sticker-bomb-anime-mix': '/products/One piece Nakama.jpg',
  'cherry-blossom-drift': '/products/24.png',
  'anime-eyes-collection': '/products/25.png',
  'mecha-robot-battle': '/products/26.png',
  'kawaii-food-gang': '/products/27.png',
  'sunset-samurai-silhouette': '/products/28.png',
  'dragon-ball-training': '/products/29.png',
  'spirit-mask-festival': '/products/30.png',
  'onigiri-rice-ball-crew': '/products/31.png',
  'manga-panel-explosion': '/products/32.png',
  'bonsai-master': '/products/33.png',
  'pixel-ninja-runner': '/products/34.png',
  'ink-wash-dragon': '/products/35.png',
  'harajuku-street-style': '/products/36.png',
  'demon-slayer-moon': '/products/37.png',
  'lucky-cat-neko-wave': '/products/38.png',
  'anime-sunset-rooftop': '/products/39.png',
  'tanuki-raccoon-spirit': '/products/40.png',
  'kanji-fire-water-earth': '/products/41.png',
  'tokyo-tower-dreamscape': '/products/42.png',
  'shonen-jump-energy': '/products/43.png',
  'sakura-petals-drift': '/products/44.png',
  'vending-machine-glow': '/products/45.png',
  'rogue-ninja-scroll': '/products/46.png',
  'matcha-latte-art': '/products/47.png',
  'wave-off-kanagawa-remix': '/products/48.png',
  'three-sword-style-legend': '/products/49.png',
};

export function getProductImage(product) {
  const slug = product.slug || '';
  return PRODUCT_IMAGE_MAP[slug] || '/products/1.png';
}

export function getProductImageLarge(product) {
  // Same image, browser will scale
  return getProductImage(product);
}
