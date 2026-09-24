import fs from 'node:fs';

const b64 = fs.readFileSync('public/favicon.png').toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#000000" />
  <image href="data:image/png;base64,${b64}" width="64" height="64" />
</svg>
`;

fs.writeFileSync('public/favicon.svg', svg);
console.log('public/favicon.svg updated successfully!');
