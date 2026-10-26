const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../package.json');
const app = require('../app/appinfo.json');
const luna = manifest.version.match(/^(\d+\.\d+\.\d+)-luna\.(\d+)$/);
if (luna) {
  if (luna[1] !== app.version) throw Error('La versión de Luna no coincide con el paquete webOS');
  const folder = path.resolve(__dirname, '../dist');
  const source = path.join(folder, app.id + '_' + app.version + '_all.ipk');
  const target = path.join(folder, app.id + '_Luna-' + luna[2] + '_' + app.version + '_all.ipk');
  fs.copyFileSync(source, target);
  console.log('Release experimental: ' + target);
}
