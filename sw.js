const CACHE_NAME = 'bg-color-generator-cache-v2'; // Bump version to trigger update
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/gh/mdbassit/Coloris@latest/dist/coloris.min.css',
  'https://cdn.jsdelivr.net/gh/mdbassit/Coloris@latest/dist/coloris.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Only handle requests from the same origin
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Adjust path for GitHub Pages subdirectory
  const scopePath = new URL(self.registration.scope).pathname;
  let path = url.pathname;
  if (path.startsWith(scopePath) && scopePath !== '/') {
      path = path.substring(scopePath.length);
      if (!path.startsWith('/')) {
          path = '/' + path;
      }
  }

  // Pattern for solid: /solid-ff0000-1920x1080.png
  const solidPattern = /^\/solid-([a-fA-F0-9]{3,6})-([0-9]+x[0-9]+)\.(png|jpe?g|webp)$/i;
  // Pattern for gradient: /gradient-ff0000-0000ff-90-linear-1920x1080.png
  const gradientPattern = /^\/gradient-([a-fA-F0-9]{3,6})-([a-fA-F0-9]{3,6})-([0-9]{1,3})-(linear|radial)-([0-9]+x[0-9]+)\.(png|jpe?g|webp)$/i;

  const solidMatch = path.match(solidPattern);
  if (solidMatch) {
    event.respondWith(generateSolidImage(solidMatch));
    return;
  }

  const gradientMatch = path.match(gradientPattern);
  if (gradientMatch) {
    event.respondWith(generateGradientImage(gradientMatch));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      }
    )
  );
});

function sanitizeColor(color) {
    return '#' + color;
}

async function generateSolidImage(match) {
    const [, color, dimensions, format] = match;
    const [width, height] = dimensions.split('x').map(Number);
    const hexColor = sanitizeColor(color);

    if (width > 8000 || height > 8000 || width < 1 || height < 1) {
        return new Response('Image dimensions are out of bounds (max 8000x8000).', { status: 400 });
    }

    try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = hexColor;
        ctx.fillRect(0, 0, width, height);

        const mimeType = format.toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${format.toLowerCase()}`;
        const blob = await canvas.convertToBlob({ type: mimeType });

        return new Response(blob, { headers: { 'Content-Type': mimeType } });
    } catch (e) {
        console.error('Solid image generation failed:', e);
        return new Response('Failed to generate image.', { status: 500 });
    }
}

async function generateGradientImage(match) {
    const [, color1, color2, direction, gradientType, dimensions, format] = match;
    const [width, height] = dimensions.split('x').map(Number);
    const hexColor1 = sanitizeColor(color1);
    const hexColor2 = sanitizeColor(color2);
    const angle = parseInt(direction, 10);

    if (width > 8000 || height > 8000 || width < 1 || height < 1) {
        return new Response('Image dimensions are out of bounds (max 8000x8000).', { status: 400 });
    }
    if (angle < 0 || angle > 360) {
        return new Response('Invalid angle. Must be between 0 and 360.', { status: 400 });
    }

    try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');

        let grad;
        if (gradientType === 'linear') {
            const rad = (angle - 90) * Math.PI / 180;
            const x0 = width / 2 + Math.cos(rad) * width / 2;
            const y0 = height / 2 + Math.sin(rad) * height / 2;
            const x1 = width / 2 - Math.cos(rad) * width / 2;
            const y1 = height / 2 - Math.sin(rad) * height / 2;
            grad = ctx.createLinearGradient(x1, y1, x0, y0);
        } else { // radial
            grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
        }
        grad.addColorStop(0, hexColor1);
        grad.addColorStop(1, hexColor2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const mimeType = format.toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${format.toLowerCase()}`;
        const blob = await canvas.convertToBlob({ type: mimeType });

        return new Response(blob, { headers: { 'Content-Type': mimeType } });
    } catch (e) {
        console.error('Gradient image generation failed:', e);
        return new Response('Failed to generate image.', { status: 500 });
    }
}

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});