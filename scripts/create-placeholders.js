// This script creates placeholder images for development
// Run with: node scripts/create-placeholders.js

const fs = require('fs');
const path = require('path');

// Base64 encoded 1x1 transparent PNG
const transparentPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const images = [
  'hero.jpg',
  'service-1.jpg',
  'service-2.jpg',
  'service-3.jpg',
  'service-4.jpg',
  'service-5.jpg',
  'service-6.jpg',
  'about.jpg',
  'gallery-1.jpg',
  'gallery-2.jpg',
  'gallery-3.jpg',
  'gallery-4.jpg',
  'gallery-5.jpg',
  'gallery-6.jpg',
  'gallery-7.jpg',
  'gallery-8.jpg',
  'gallery-9.jpg',
];

const imagesDir = path.join(__dirname, '../public/images');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

images.forEach(image => {
  const filePath = path.join(imagesDir, image);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, transparentPNG);
    console.log(`Created placeholder: ${image}`);
  }
});

console.log('Placeholder images created successfully!');
console.log('Please replace these with actual images before deployment.');

