import Link from 'next/link';

const FOOTER_LINKS = {
  Shop: [
    { label: 'T-Shirts', href: '/category/t-shirts' },
    { label: 'Hoodies', href: '/category/hoodies' },
    { label: 'Stickers', href: '/category/stickers' },
    { label: 'Phone Cases', href: '/category/phone-cases' },
    { label: 'Wall Art', href: '/category/wall-art' },
  ],
  Company: [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Press', href: '#' },
  ],
  Support: [
    { label: 'Help Center', href: '#' },
    { label: 'Returns', href: '#' },
    { label: 'Shipping Info', href: '#' },
    { label: 'Contact Us', href: '#' },
  ],
  Artists: [
    { label: 'Sell on PrintForge', href: '#' },
    { label: 'Artist Resources', href: '#' },
    { label: 'Artist Program', href: '#' },
    { label: 'Guidelines', href: '#' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-surface-900 text-surface-300 mt-16">
      <div className="container-page py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">PF</span>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Print<span className="text-brand-400">Forge</span>
              </span>
            </Link>
            <p className="text-sm text-surface-400 leading-relaxed">
              A marketplace for independent artists to sell their designs on premium products.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold text-white text-sm mb-3">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-surface-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-surface-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-surface-500">
            &copy; {new Date().getFullYear()} PrintForge. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-surface-500">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-white transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
