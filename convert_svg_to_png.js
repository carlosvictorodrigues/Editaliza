const fs = require('fs');
const path = require('path');

// Simple SVG to PNG conversion using canvas (if available) or create data URI fallback
function createPNGFavicon(size, outputPath) {
    // Create a simple SVG string
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${Math.round(size * 0.05)}" y="${Math.round(size * 0.05)}" 
        width="${size - Math.round(size * 0.1)}" height="${size - Math.round(size * 0.1)}" 
        rx="${Math.round(size * 0.1)}" ry="${Math.round(size * 0.1)}" fill="#0528f2"/>
  <text x="${size/2}" y="${size * 0.7}" font-family="Arial, sans-serif" 
        font-size="${Math.round(size * 0.6)}" font-weight="bold" 
        fill="white" text-anchor="middle">E</text>
</svg>`;

    // For now, save as SVG and we'll manually convert
    const svgPath = outputPath.replace('.png', '.svg');
    fs.writeFileSync(svgPath, svg);
    console.log(`Created SVG: ${svgPath}`);
    
    return svgPath;
}

// Create the favicon files
const publicDir = path.join(__dirname, 'public');

console.log('Creating favicon files...');

// Create different sizes
const sizes = [
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 32, name: 'favicon.png' }, // Main favicon
    { size: 48, name: 'favicon-48x48.png' }
];

sizes.forEach(({ size, name }) => {
    const outputPath = path.join(publicDir, name);
    createPNGFavicon(size, outputPath);
});

console.log('\nFavicon files created!');
console.log('Note: SVG files were created. To convert to PNG:');
console.log('1. Open each SVG file in a browser');
console.log('2. Take a screenshot or use browser dev tools to save as PNG');
console.log('3. Or use an online SVG to PNG converter');
console.log('\nFiles created in public/ directory:');
sizes.forEach(({ name }) => {
    console.log(`- ${name.replace('.png', '.svg')}`);
});