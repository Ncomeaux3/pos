import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'POS',
    short_name: 'POS',
    description: 'Personal operating system',
    start_url: '/',
    display: 'standalone',
    // The brand ground, so the splash and the address bar match the page
    // rather than the stock near-black they shipped with.
    background_color: '#07080A',
    theme_color: '#07080A',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
