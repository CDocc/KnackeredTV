const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

module.exports = [
  // Preload script
  {
    mode: isProduction ? 'production' : 'development',
    devtool: isDevelopment ? 'source-map' : false,
    name: 'preload',
    entry: './src/main/preload.ts',
    output: {
      path: path.resolve('./dist/main'),
      filename: 'preload.cjs',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    target: 'electron-preload',
    externalsPresets: { node: true },
    externals: {
      'better-sqlite3': 'better-sqlite3',
      'crypto-js': 'crypto-js',
      'm3u8-parser': 'm3u8-parser',
      'axios': 'axios',
    },
    optimization: isProduction ? {
      minimizer: [new TerserPlugin()],
    } : {},
  },

  // Main process - DO NOT BUNDLE, just copy TypeScript
  {
    mode: 'development',
    devtool: false,
    name: 'main',
    entry: './src/main/index.ts',
    output: {
      path: path.resolve('./dist/main'),
      filename: '[name].cjs',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: 'tsconfig.json',
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve('./src'),
      },
    },
    target: 'electron-main',
    externalsPresets: { node: true },
    externals: [
      (({ request }, callback) => {
        if (
          /better-sqlite3|crypto-js|axios|m3u8-parser/.test(request)
        ) {
          return callback(null, `require("${request}")`);
        }
        callback();
      }),
    ],
    optimization: {
      minimize: false,
    },
  },

  // Renderer process
  {
    mode: isProduction ? 'production' : 'development',
    devtool: isDevelopment ? 'source-map' : false,
    name: 'renderer',
    entry: './src/renderer/index.tsx',
    output: {
      path: path.resolve('./dist/renderer'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.png$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/[name][ext]' },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve('./src'),
      },
    },
    target: 'electron-renderer',
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        favicon: './assets/knfav.png',
      }),
    ],
    optimization: isProduction ? {
      minimizer: [new TerserPlugin()],
    } : {},
  },
];

