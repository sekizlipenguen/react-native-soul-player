/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-video', () => 'Video');
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@sekizlipenguen/react-native-soul-player', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props: object, _ref: unknown) => (
      <View testID="mock-soul-player" {...props} />
    )),
  };
});

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
