/* Tap-sound manager (expo-audio). Fire-and-forget; no-ops until init.
 * Run `node tools/gen-sounds.js` once so assets/audio/*.wav exist
 * before bundling, and `npx expo install expo-audio` before
 * reloading (the import below needs the native module).
 *
 * A fresh player is minted per sound: reusing one player with
 * seekTo(0)+play() races the native seek and drops every other tap.
 */
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

const TAP_SOURCE = require("../../assets/audio/tap-pop.wav");
const CORRECT_SOURCE = require("../../assets/audio/drop-correct.wav");
const WRONG_SOURCE = require("../../assets/audio/drop-wrong.wav");

let ready = false;

export function initSounds() {
  try {
    setAudioModeAsync({ playsInSilentModeIos: true });
    ready = true;
  } catch {
    ready = false;
  }
}

function playOne(source: any) {
  if (!ready) return;
  try {
    const p = createAudioPlayer(source);
    p.play();
    setTimeout(() => {
      try {
        p.remove();
      } catch {}
    }, 800);
  } catch {
    // audio unavailable — stay silent
  }
}

export function playTap() {
  playOne(TAP_SOURCE);
}

export function playCorrect() {
  playOne(CORRECT_SOURCE);
}

export function playWrong() {
  playOne(WRONG_SOURCE);
}
