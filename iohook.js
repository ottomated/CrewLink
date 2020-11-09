const path = require('path');
const runtime = process.versions['electron'] ? 'electron' : 'node';
const essential = runtime + '-v' + process.versions.modules + '-' + process.platform + '-' + process.arch;
const modulePath = path.join(__dirname, 'builds', essential, 'build', 'Release', 'iohook.node');
console.info('The path is:', modulePath);
