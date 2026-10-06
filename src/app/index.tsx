import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SpikeScreen } from '../spike/SpikeScreen';

// Phase 1 feel spike: single bottle, twist/peel/sort. Replaced by the real
// belt screen in phase 2.
export default function Index() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SpikeScreen />
    </GestureHandlerRootView>
  );
}
