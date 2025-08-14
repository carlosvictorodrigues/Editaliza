const fs = require('fs');
const path = require('path');

// Create minimal PNG files with brand colors
// This creates a very simple PNG using basic PNG structure

function createSimplePNG(width, height, outputPath) {
    // For this implementation, we'll create an SVG that can be manually converted
    // and provide instructions for PNG creation
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .bg { fill: #0528f2; }
      .text { fill: white; font-family: Arial, sans-serif; font-weight: bold; text-anchor: middle; }
    </style>
  </defs>
  <rect x="1" y="1" width="${width-2}" height="${height-2}" rx="${Math.max(1, width*0.1)}" class="bg"/>
  <text x="${width/2}" y="${height*0.7}" font-size="${Math.max(8, width*0.6)}" class="text">E</text>
</svg>`;

    // Save SVG
    const svgPath = outputPath.replace('.png', '_final.svg');
    fs.writeFileSync(svgPath, svg);
    
    // Create HTML converter for this specific size
    const html = `<!DOCTYPE html>
<html>
<head><title>Favicon ${width}x${height}</title></head>
<body style="margin:0; padding:20px; font-family: Arial;">
    <h3>Favicon ${width}x${height} - Editaliza</h3>
    <div style="display: inline-block; border: 1px solid #ccc; background: white;">
        ${svg}
    </div>
    <br><br>
    <canvas id="canvas" width="${width}" height="${height}" style="border: 1px solid #ccc; image-rendering: pixelated; zoom: 10;"></canvas>
    <br><br>
    <button onclick="downloadPNG()" style="background: #0528f2; color: white; border: none; padding: 10px 20px; cursor: pointer;">
        Download ${width}x${width} PNG
    </button>
    
    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        // Draw favicon
        ctx.fillStyle = '#0528f2';
        ctx.fillRect(1, 1, ${width-2}, ${height-2});
        
        // Draw text
        ctx.fillStyle = 'white';
        ctx.font = 'bold ${Math.max(8, width*0.6)}px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E', ${width/2}, ${height/2});
        
        function downloadPNG() {
            const link = document.createElement('a');
            link.download = '${outputPath.split(/[\\\\\/]/).pop()}';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    </script>
</body>
</html>`;

    const htmlPath = outputPath.replace('.png', '_converter.html');
    fs.writeFileSync(htmlPath, html);
    
    console.log(`Created converter: ${path.basename(htmlPath)}`);
    return htmlPath;
}

// Create favicons
const publicDir = path.join(__dirname, 'public');

console.log('Creating PNG favicon converters...\n');

const sizes = [
    { width: 16, height: 16, name: 'favicon-16x16.png' },
    { width: 32, height: 32, name: 'favicon-32x32.png' },
    { width: 32, height: 32, name: 'favicon.png' },
    { width: 48, height: 48, name: 'favicon-48x48.png' }
];

const converters = [];

sizes.forEach(({ width, height, name }) => {
    const outputPath = path.join(publicDir, name);
    const converter = createSimplePNG(width, height, outputPath);
    converters.push(path.basename(converter));
});

console.log('\n✅ Favicon converter files created!');
console.log('\n📋 Instructions:');
console.log('1. Open each *_converter.html file in your browser');
console.log('2. Click the "Download" button in each file');
console.log('3. Save the downloaded PNG files to the public/ folder');
console.log('\nConverter files created:');
converters.forEach(file => console.log(`- ${file}`));

console.log('\n🎯 Required PNG files to create:');
sizes.forEach(({ name }) => console.log(`- ${name}`));

console.log('\n🎨 Brand colors used:');
console.log('- Background: #0528f2 (Editaliza blue)');
console.log('- Text: white');
console.log('- Font: Arial Bold');