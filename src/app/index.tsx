import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GameRoot } from '../game/GameRoot';

// Phase 6: progression shell — map -> rules -> shift -> summary.
export default function Index() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GameRoot />
    </GestureHandlerRootView>
  );
}
