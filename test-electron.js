const electron = require('electron');
console.log('Electron module keys:', Object.keys(electron));
if (electron.app) {
  console.log('App object found');
  console.log('isPackaged:', electron.app.isPackaged);
} else {
  console.log('App object NOT found');
}
process.exit(0);
