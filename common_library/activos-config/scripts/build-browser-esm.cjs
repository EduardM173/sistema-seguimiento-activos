const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const esmOutFile = path.join(distDir, 'browser.esm.js');
const browserOutFile = path.join(distDir, 'browser.js');

const source = `export const ActivosService = Object.freeze({
  BACKEND: 'activos-backend',
  REPORTS: 'activos-reports',
  AUDITORIA: 'activos-auditoria',
  AGENT: 'activos-agent',
});
`;

fs.writeFileSync(esmOutFile, source);
fs.writeFileSync(browserOutFile, source);
