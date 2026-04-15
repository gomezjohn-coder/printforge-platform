import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { getFeaturedProducts, getArtists } from '@/lib/api';

const FALLBACK_PRODUCTS = [
  { id: 1, slug: 'cosmic-adventure-tee', title: 'Cosmic Adventure', artist: { name: 'StarGazer' }, price: 29.99, productType: 't-shirt' },
  { id: 2, slug: 'retro-waves-hoodie', title: 'Retro Waves', artist: { name: 'NeonDreams' }, price: 44.99, productType: 'hoodie' },
  { id: 3, slug: 'pixel-cat-sticker', title: 'Pixel Cat', artist: { name: 'PixelPaws' }, price: 3.99, productType: 'sticker' },
  { id: 4, slug: 'mountain-sunrise-poster', title: 'Mountain Sunrise', artist: { name: 'WildBrush' }, price: 18.99, productType: 'poster' },
  { id: 5, slug: 'abstract-phone-case', title: 'Abstract Flow', artist: { name: 'ColorSplash' }, price: 24.99, productType: 'phone-case' },
  { id: 6, slug: 'coffee-lover-mug', title: 'Coffee Lover', artist: { name: 'MugLife' }, price: 14.99, productType: 'mug' },
  { id: 7, slug: 'botanical-tote', title: 'Botanical Garden', artist: { name: 'LeafyArt' }, price: 22.99, productType: 'tote-bag' },
  { id: 8, slug: 'gaming-setup-art', title: 'Gaming Setup', artist: { name: 'RetroPixel' }, price: 15.99, productType: 'wall-art' },
];

const CATEGORIES = [
  { name: 'T-Shirts', slug: 't-shirts', icon: '01' },
  { name: 'Hoodies', slug: 'hoodies', icon: '02' },
  { name: 'Stickers', slug: 'stickers', icon: '03' },
  { name: 'Phone Cases', slug: 'phone-cases', icon: '04' },
  { name: 'Wall Art', slug: 'wall-art', icon: '05' },
  { name: 'Mugs', slug: 'mugs', icon: '06' },
  { name: 'Tote Bags', slug: 'tote-bags', icon: '07' },
  { name: 'Posters', slug: 'posters', icon: '08' },
];

const FALLBACK_ARTISTS = [
  { id: 1, slug: 'studioartist', name: 'Studio Artist', bio: 'Digital art and illustration', totalSales: 1250, designCount: 48 },
  { id: 2, slug: 'pixelmaster', name: 'Pixel Master', bio: 'Retro gaming and pixel art', totalSales: 980, designCount: 35 },
  { id: 3, slug: 'naturelens', name: 'Nature Lens', bio: 'Nature photography and prints', totalSales: 750, designCount: 62 },
  { id: 4, slug: 'urbansketch', name: 'Urban Sketch', bio: 'Street art and urban design', totalSales: 620, designCount: 29 },
];

export default async function HomePage() {
  const [products, artists] = await Promise.all([
    getFeaturedProducts().catch(() => null),
    getArtists().catch(() => null),
  ]);

  const displayProducts = products?.data?.slice(0, 8) || products?.slice?.(0, 8) || FALLBACK_PRODUCTS;
  const displayArtists = artists?.data?.slice(0, 4) || artists?.slice?.(0, 4) || FALLBACK_ARTISTS;

  return (
    <main className="bg-white">

      {/* HERO — Clean, minimal, white */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 pt-16 pb-24 md:pt-24 md:pb-32">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-widest text-gray-400 uppercase mb-4">
              Anime &middot; Street Art &middot; Indie Creators
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-[0.95] tracking-tight">
              Wear your
              <br />
              <span className="text-brand-500">obsession.</span>
            </h1>
            <p className="text-lg text-gray-500 mt-6 max-w-md leading-relaxed">
              Original anime fan art, street murals, and indie designs
              by independent artists. Printed on demand. Shipped worldwide.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/search"
                className="inline-flex items-center px-8 py-3.5 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-colors"
              >
                Explore Designs
              </Link>
              <Link
                href="/search?q=new"
                className="inline-flex items-center px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-full border-2 border-gray-900 hover:bg-gray-50 transition-colors"
              >
                What&apos;s New
              </Link>
            </div>
          </div>
        </div>
        {/* Abstract decorative element */}
        <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block">
          <div className="absolute top-12 right-12 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-12 right-48 w-48 h-48 bg-yellow-400/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-24 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl" />
        </div>
      </section>

      {/* TRENDING — Grid with numbered section */}
      <section className="border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-2">Curated</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Trending Now</h2>
            </div>
            <Link href="/search" className="text-sm font-medium text-gray-900 hover:text-brand-500 transition-colors underline underline-offset-4">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES — Minimal grid with numbers */}
      <section className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="mb-10">
            <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-2">Browse</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Shop by Category</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-900 transition-all duration-300 hover:shadow-lg"
              >
                <span className="text-6xl font-black text-gray-100 group-hover:text-brand-500/20 transition-colors absolute top-4 right-4">
                  {cat.icon}
                </span>
                <div className="relative pt-8">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand-500 transition-colors">
                    {cat.name}
                  </h3>
                  <span className="inline-flex items-center text-sm text-gray-400 mt-2 group-hover:text-gray-600 transition-colors">
                    Shop now
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ARTISTS — Horizontal scroll cards */}
      <section className="border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-2">Creators</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Featured Artists</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {displayArtists.map((artist, i) => (
              <Link
                key={artist.id}
                href={`/artist/${artist.slug}`}
                className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-900 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center text-white text-xl font-bold mb-4 group-hover:bg-brand-500 transition-colors">
                  {artist.name.charAt(0)}
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{artist.name}</h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{artist.bio}</p>
                <div className="flex gap-4 mt-4 text-xs text-gray-500">
                  <span className="font-semibold">{artist.totalSales || 0} sales</span>
                  <span>{artist.designCount || 0} designs</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* VALUE PROPS — Three column, ultra clean */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            <div>
              <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
                <span className="text-sm font-bold">01</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Fan Art & Originals</h3>
              <p className="text-gray-400 leading-relaxed">
                Anime-inspired, street art, and indie designs by independent creators. No stock art.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
                <span className="text-sm font-bold">02</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Premium Print Quality</h3>
              <p className="text-gray-400 leading-relaxed">
                Vibrant DTG printing on ethically sourced materials. Colors that pop and last.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
                <span className="text-sm font-bold">03</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Support Real Artists</h3>
              <p className="text-gray-400 leading-relaxed">
                Every purchase puts money in an artist&apos;s pocket. Real talent, real support.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
