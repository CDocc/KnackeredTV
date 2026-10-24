#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Start webpack watch
const webpack = spawn('webpack', ['--mode', 'development', '--watch'], {
  cwd: path.resolve(__dirname),
  stdio: 'inherit',
});

// Give webpack time to compile, then start electron
setTimeout(() => {
  const electron = spawn('electron', ['.'], {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
  });

  electron.on('exit', () => {
    webpack.kill();
    process.exit(0);
  });
}, 3000);

webpack.on('error', (err) => {
  console.error('Webpack error:', err);
  process.exit(1);
});
