import path from 'path';
import * as webpack from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';

const envMode = process.env.NODE_ENV ?? 'development';
const isDev = envMode === 'development';
const entryTag = isDev ? '-dev.ts' : '.ts';
const entryPoint = `./scripts/render${entryTag}`;
console.log(`Webpacking in '${envMode}' mode with '${entryPoint}'`);

export const config: webpack.Configuration = {
  context: path.resolve(__dirname),
  devtool: 'inline-source-map',
  entry: entryPoint,
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  output: {
    filename: 'render.js',
    path: path.resolve(__dirname, '.dist/scripts'),
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  externals: {
    marked: 'marked',
    mermaid: 'mermaid',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'mermaid-render.html'),
          to: path.resolve(__dirname, '.dist/mermaid-render.html'),
        },
        {
          from: path.resolve(__dirname, 'package.json'),
          to: path.resolve(__dirname, '.dist/package.json'),
        },
        { from: path.resolve(__dirname, 'marketplace'), to: path.resolve(__dirname, '.dist/marketplace') },
        { from: path.resolve(__dirname, 'styles'), to: path.resolve(__dirname, '.dist/styles') },
      ],
    }),
  ],
};

export default config;
