import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { getFeaturedProducts, getCategories, getArtists } from '@/lib/api';

const FALLBACK_PRODUCTS = Array.from({ length: 8 }, (_, i) => ({
  id: `fallback-${i}`,
  title: ['Cosmic Explorer', 'Retro Vibes', 'Mountain Sunset', 'Ocean Dreams', 'Pixel Art Hero', 'Neon Nights', 'Wild Flora', 'Abstract Wave'][i],
  slug: `product-${i}`,
  price: (19.99 + i * 2).toFixed(2),
  productType: ['t-shirt', 'hoodie', 'sticker', 'mug', 'phone-case', 'wall-art', 'tote-bag', 'poster'][i],
  artist: { name: ['Luna Studio', 'PixelCraft', 'ArtVenture', 'DesignLab', 'InkDrop', 'Neon Co', 'FloraArt', 'WaveForm'][i], slug: `artist-${i}` },
}));

const FALLBACK_CATEGORIES = [
  { name: 'T-Shirts', slug: 't-shirts', description: 'Premium cotton tees', productCount: 142 },
  { name: 'Hoodies', slug: 'hoodies', description: 'Cozy comfort meets art', productCount: 87 },
  { name: 'Stickers', slug: 'stickers', description: 'Vinyl die-cut stickers', productCount: 234 },
  { name: 'Mugs', slug: 'mugs', description: 'Ceramic art mugs', productCount: 95 },
  { name: 'Phone Cases', slug: 'phone-cases', description: 'Protect with style', productCount: 118 },
  { name: 'Wall Art', slug: 'wall-art', description: 'Gallery-quality prints', productCount: 73 },
];

const CATEGORY_GRADIENTS = {
  't-shirts': 'from-violet-500 to-indigo-600',
  'hoodies': 'from-blue-500 to-cyan-500',
  'stickers': 'from-pink-500 to-rose-500',
  'mugs': 'from-amber-400 to-orange-500',
  'phone-cases': 'from-emerald-500 to-teal-500',
  'wall-art': 'from-fuchsia-500 to-purple-600',
  'tote-bags': 'from-sky-400 to-blue-500',
  'posters': 'from-red-400 to-pink-500',
};

const FALLBACK_ARTISTS = [
  { id: 'a1', name: 'Luna Rodriguez', slug: 'luna-rodriguez', bio: 'Digital illustrator specializing in cosmic and nature themes.', totalSales: 2340 },
  { id: 'a2', name: 'Marcus Chen', slug: 'marcus-chen', bio: 'Pixel art and retro gaming inspired designs.', totalSales: 1890 },
  { id: 'a3', name: 'Aria Patel', slug: 'aria-patel', bio: 'Minimalist botanical and geometric art.', totalSales: 1650 },
];

async function loadData() {
  const results = { products: FALLBACK_PRODUCTS, categories: FALLBACK_CATEGORIES, artists: FALLBACK_ARTISTS };
  try {
    const [productsRes, categoriesRes, artistsRes] = await Promise.allSettled([
      getFeaturedProducts(),
      getCategories(),
      getArtists({ limit: 3, sort: 'popular' }),
    ]);
    if (productsRes.status === 'fulfilled' && productsRes.value?.data?.length) results.products = productsRes.value.data;
    if (categoriesRes.status === 'fulfilled' && categoriesRes.value?.data?.length) results.categories = categoriesRes.value.data;
    if (artistsRes.status === 'fulfilled' && artistsRes.value?.data?.length) results.artists = artistsRes.value.data;
  } catch {
    // Use fallbacks
  }
  return results;
}

export default async function HomePage() {
  const { products, categories, artists } = await loadData();

  return (
    <div>
      {/* Hero Banner */}
      <section className="gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-black/30" />
        <div className="container-page relative z-10 py-20 md:py-28 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-balance">
            Where Art Meets<br />Everyday Life
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Discover unique designs by independent artists, printed on premium products
            and shipped to your door.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/search" className="btn-primary bg-white text-surface-900 hover:bg-surface-100">
              Explore Designs
            </Link>
            <Link href="#categories" className="btn-secondary border-white/30 text-white hover:bg-white/10">
              Browse Categories
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 md:gap-16 mt-12 text-sm">
            <div>
              <div className="text-2xl md:text-3xl font-bold">10K+</div>
              <div className="text-white/60">Designs</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold">500+</div>
              <div className="text-white/60">Artists</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold">50K+</div>
              <div className="text-white/60">Happy Customers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container-page py-12 md:py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-surface-900">Trending Now</h2>
            <p className="text-surface-500 mt-1">The most popular designs this week</p>
          </div>
          <Link href="/search?sort=popular" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            View all &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="bg-surface-50 py-12 md:py-16">
        <div className="container-page">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-surface-900">Shop by Category</h2>
            <p className="text-surface-500 mt-1">Find the perfect canvas for your favorite art</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {categories.slice(0, 6).map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="group relative rounded-xl overflow-hidden aspect-[4/3] card-hover"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_GRADIENTS[cat.slug] || 'from-gray-500 to-gray-600'}`} />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                  <h3 className="text-xl md:text-2xl font-bold mb-1">{cat.name}</h3>
                  <p className="text-sm text-white/70">
                    {cat.productCount || 0} designs
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Artist Spotlight */}
      <section className="container-page py-12 md:py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-surface-900">Artist Spotlight</h2>
          <p className="text-surface-500 mt-1">Meet the creators behind the designs</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {artists.slice(0, 3).map((artist, idx) => {
            const gradients = ['from-brand-500 to-blue-600', 'from-accent-500 to-pink-500', 'from-emerald-500 to-teal-600'];
            return (
              <Link
                key={artist.id || idx}
                href={`/artist/${artist.slug}`}
                className="group block bg-white rounded-xl border border-surface-100 overflow-hidden card-hover"
              >
                {/* Avatar banner */}
                <div className={`h-24 bg-gradient-to-r ${gradients[idx % 3]}`} />
                <div className="px-5 pb-5 -mt-8 relative">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradients[idx % 3]}
                                   border-4 border-white flex items-center justify-center mb-3`}>
                    <span className="text-white text-xl font-bold">
                      {artist.name?.[0] || '?'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-surface-900 group-hover:text-brand-600 transition-colors">
                    {artist.name}
                  </h3>
                  <p className="text-sm text-surface-500 mt-1 line-clamp-2">
                    {artist.bio || 'Independent artist on PrintForge.'}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
                    <span>{artist.totalSales?.toLocaleString() || 0} sales</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-surface-900 py-16">
        <div className="container-page text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Are you an artist?
          </h2>
          <p className="text-surface-400 max-w-lg mx-auto mb-6">
            Join thousands of creators selling their designs on PrintForge.
            Upload your art, we handle the rest.
          </p>
          <Link href="#" className="btn-accent">
            Start Selling Today
          </Link>
        </div>
      </section>
    </div>
  );
}
