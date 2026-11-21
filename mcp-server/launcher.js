const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('../node_modules/tsx/dist/cjs/index.cjs');
require('./index.ts');
