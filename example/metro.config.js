const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const packageRoot = path.resolve(__dirname, '..');

/**
 * Local package playground — watches the parent library without publishing.
 */
const config = {
  watchFolders: [packageRoot],
  resolver: {
    extraNodeModules: {
      '@sekizlipenguen/react-native-soul-player': packageRoot,
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
      'react-native-video': path.resolve(__dirname, 'node_modules/react-native-video'),
      '@react-native-community/slider': path.resolve(
        __dirname,
        'node_modules/@react-native-community/slider',
      ),
    },
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
