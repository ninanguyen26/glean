import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GameRoot } from '../game/GameRoot';
import { initSounds } from '../audio/sounds';

// Phase 6: progression shell — map -> rules -> shift -> summary.
export default function Index() {
  useEffect(() => {
    initSounds();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GameRoot />
    </GestureHandlerRootView>
  );
}
