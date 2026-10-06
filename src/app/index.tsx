import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BeltScreen } from '../game/BeltScreen';

// Phase 2: core belt loop. The phase-1 spike lives on in src/spike/
// and gets rebuilt as the production disassembly modal in phase 3.
export default function Index() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BeltScreen />
    </GestureHandlerRootView>
  );
}
