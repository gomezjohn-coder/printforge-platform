/**
 * In-memory search engine with basic TF-IDF-like relevance scoring.
 *
 * On startup it attempts to fetch products from the product-service service.
 * If that fails (e.g. during local dev) it falls back to built-in demo data.
 */

class SearchEngine {
  constructor(productServiceUrl) {
    this.productServiceUrl = productServiceUrl;
    this.products = [];
    this.invertedIndex = new Map(); // term -> [{ idx, tf }]
    this.documentCount = 0;

    // Seed with demo data immediately so the service is usable without product-service
    this._indexProducts(DEMO_PRODUCTS);
  }

  // ---------------------------------------------------------------------------
  // Catalog loading
  // ---------------------------------------------------------------------------

  /**
   * Fetch products from product-service and re-index.
   */
  async loadCatalog() {
    const url = `${this.productServiceUrl}/api/v1/products`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`product-service responded ${res.status}`);
      const data = await res.json();
      const products = data.products || data;
      if (Array.isArray(products) && products.length > 0) {
        this._indexProducts(products);
        console.log(`[search-engine] indexed ${products.length} products from product-service`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---------------------------------------------------------------------------
  // Indexing
  // ---------------------------------------------------------------------------

  _indexProducts(products) {
    this.products = products.map((p, idx) => ({
      id: p.id,
      title: p.title || p.name || '',
      description: p.description || '',
      category: (p.category || '').toLowerCase(),
      price: p.price || 0,
      artist: p.artist || p.artist_name || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
      popularity: p.popularity || p.sales_count || 0,
      rating: p.rating || 0,
      image_url: p.image_url || p.thumbnail_url || '',
      _idx: idx,
    }));

    this.documentCount = this.products.length;
    this.invertedIndex = new Map();

    for (let i = 0; i < this.products.length; i++) {
      const doc = this.products[i];
      const text = `${doc.title} ${doc.description} ${doc.category} ${doc.tags.join(' ')} ${doc.artist}`.toLowerCase();
      const terms = this._tokenize(text);
      const termFreq = new Map();

      for (const term of terms) {
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
      }

      for (const [term, count] of termFreq) {
        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, []);
        }
        this.invertedIndex.get(term).push({
          idx: i,
          tf: count / terms.length, // normalized term frequency
        });
      }
    }
  }

  _tokenize(text) {
    return text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /**
   * Search with TF-IDF-like relevance scoring.
   *
   * @param {string} query  Search query string
   * @param {object} opts   { category, sort }
   * @returns {Array}        Scored and sorted results
   */
  search(query, { category = '', sort = 'relevance' } = {}) {
    if (!query || query.trim() === '') {
      // No query -- return all products, optionally filtered
      let results = [...this.products];
      if (category) {
        results = results.filter((p) => p.category === category.toLowerCase());
      }
      return this._sortResults(results.map((p) => ({ ...p, score: 0 })), sort);
    }

    const queryTerms = this._tokenize(query.toLowerCase());
    if (queryTerms.length === 0) {
      return [];
    }

    // Compute IDF for each query term
    const scores = new Map(); // idx -> score

    for (const term of queryTerms) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;

      const idf = Math.log(1 + this.documentCount / postings.length);

      for (const { idx, tf } of postings) {
        const current = scores.get(idx) || 0;
        scores.set(idx, current + tf * idf);
      }
    }

    // Build result set
    let results = [];
    for (const [idx, score] of scores) {
      const product = this.products[idx];
      results.push({ ...product, score: Math.round(score * 1000) / 1000 });
    }

    // Category filter
    if (category) {
      results = results.filter((p) => p.category === category.toLowerCase());
    }

    return this._sortResults(results, sort);
  }

  _sortResults(results, sort) {
    switch (sort) {
      case 'popular':
        return results.sort((a, b) => b.popularity - a.popularity);
      case 'price_asc':
        return results.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return results.sort((a, b) => b.price - a.price);
      case 'rating':
        return results.sort((a, b) => b.rating - a.rating);
      case 'newest':
        return results.sort((a, b) => b.id.localeCompare(a.id));
      case 'relevance':
      default:
        return results.sort((a, b) => b.score - a.score);
    }
  }

  getIndexSize() {
    return this.documentCount;
  }
}

// ---------------------------------------------------------------------------
// Demo product catalog (used when product-service is unavailable)
// ---------------------------------------------------------------------------
const DEMO_PRODUCTS = [
  { id: 'prod-001', title: 'Cute Cat Sticker Pack', description: 'Adorable cat illustrations in a vinyl sticker pack', category: 'stickers', price: 8.99, artist: 'Maya Chen', tags: ['cat', 'cute', 'animal', 'vinyl'], popularity: 342, rating: 4.8, image_url: 'https://cdn.printforge.io/products/prod-001/thumb.webp' },
  { id: 'prod-002', title: 'Geometric Mountain Poster', description: 'Minimalist geometric mountain landscape wall art', category: 'posters', price: 24.99, artist: 'Jake Rivera', tags: ['mountain', 'geometric', 'minimalist', 'landscape'], popularity: 256, rating: 4.6, image_url: 'https://cdn.printforge.io/products/prod-002/thumb.webp' },
  { id: 'prod-003', title: 'Botanical Garden Prints Set', description: 'Set of 4 botanical illustrations featuring monstera and fern', category: 'prints', price: 39.99, artist: 'Maya Chen', tags: ['botanical', 'plants', 'monstera', 'fern', 'nature'], popularity: 189, rating: 4.9, image_url: 'https://cdn.printforge.io/products/prod-003/thumb.webp' },
  { id: 'prod-004', title: 'Retro Gaming Stickers', description: 'Pixel art retro gaming controller and console stickers', category: 'stickers', price: 6.99, artist: 'Aisha Patel', tags: ['retro', 'gaming', 'pixel', 'controller', '8bit'], popularity: 412, rating: 4.7, image_url: 'https://cdn.printforge.io/products/prod-004/thumb.webp' },
  { id: 'prod-005', title: 'Space Explorer Phone Case', description: 'Astronaut illustration phone case with matte finish', category: 'phone-cases', price: 19.99, artist: 'Jake Rivera', tags: ['space', 'astronaut', 'phone', 'illustration'], popularity: 178, rating: 4.5, image_url: 'https://cdn.printforge.io/products/prod-005/thumb.webp' },
  { id: 'prod-006', title: 'Watercolor Sunset Canvas', description: 'Hand-painted watercolor sunset over ocean canvas print', category: 'canvas', price: 49.99, artist: 'Maya Chen', tags: ['watercolor', 'sunset', 'ocean', 'handpainted'], popularity: 134, rating: 4.9, image_url: 'https://cdn.printforge.io/products/prod-006/thumb.webp' },
  { id: 'prod-007', title: 'Typography Quote Poster', description: 'Motivational quote in modern typography black and white', category: 'posters', price: 14.99, artist: 'Aisha Patel', tags: ['typography', 'quote', 'motivational', 'minimal'], popularity: 298, rating: 4.4, image_url: 'https://cdn.printforge.io/products/prod-007/thumb.webp' },
  { id: 'prod-008', title: 'Cat in Space Sticker', description: 'Funny cat floating in space with fishbowl helmet sticker', category: 'stickers', price: 3.99, artist: 'Maya Chen', tags: ['cat', 'space', 'funny', 'cute', 'astronaut'], popularity: 567, rating: 4.8, image_url: 'https://cdn.printforge.io/products/prod-008/thumb.webp' },
  { id: 'prod-009', title: 'Abstract Fluid Art Print', description: 'Colorful abstract fluid art pour painting reproduction', category: 'prints', price: 29.99, artist: 'Jake Rivera', tags: ['abstract', 'fluid', 'colorful', 'modern'], popularity: 145, rating: 4.3, image_url: 'https://cdn.printforge.io/products/prod-009/thumb.webp' },
  { id: 'prod-010', title: 'Japanese Wave Phone Case', description: 'Great wave inspired Japanese art phone case', category: 'phone-cases', price: 22.99, artist: 'Aisha Patel', tags: ['japanese', 'wave', 'art', 'ukiyo-e'], popularity: 223, rating: 4.7, image_url: 'https://cdn.printforge.io/products/prod-010/thumb.webp' },
];

module.exports = { SearchEngine };
