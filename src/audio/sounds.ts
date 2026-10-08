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
const COIN_SOURCE = require("../../assets/audio/coin-ching-3.wav");
const STAR_TICK_SOURCE = require("../../assets/audio/star-tick.wav");
const SINK_DROP_SOURCE = require("../../assets/audio/sink-drop-4.wav");
const MAIN_MUSIC_SOURCE = require("../../assets/audio/main-music.wav");
const BELT_MUSIC_SOURCE = require("../../assets/audio/belt-music.wav");

let ready = false;
// One persistent music player for the whole app. Tracks swap via replace()
// on this single player, so two loops can never play at once — unlike
// create/remove pairs, where a missed remove (or a Fast Refresh dropping
// the module's player refs) leaves an orphaned loop playing forever.
let musicPlayer: any = null;
let musicTrack: "main" | "belt" | null = null;

function ensureMusicPlayer(): any {
  if (!ready) return null;
  if (!musicPlayer) {
    try {
      musicPlayer = createAudioPlayer(MAIN_MUSIC_SOURCE);
      musicPlayer.loop = true;
      musicPlayer.volume = 0.3;
      musicTrack = "main";
    } catch {
      musicPlayer = null;
    }
  }
  return musicPlayer;
}

function playTrack(track: "main" | "belt") {
  const p = ensureMusicPlayer();
  if (!p) return;
  try {
    if (musicTrack !== track) {
      p.replace(track === "main" ? MAIN_MUSIC_SOURCE : BELT_MUSIC_SOURCE);
      musicTrack = track;
    }
    if (musicMuted) {
      if (p.playing) p.pause();
      return;
    }
    if (!p.playing) p.play();
  } catch {
    // audio unavailable — stay silent
  }
}

export function initSounds() {
  try {
    setAudioModeAsync({ playsInSilentModeIos: true });
    ready = true;
  } catch {
    ready = false;
  }
}

let soundMuted = false;
let musicMuted = false;

export function setSoundMuted(m: boolean) {
  soundMuted = m;
}
export function isSoundMuted() {
  return soundMuted;
}
export function setMusicMuted(m: boolean) {
  musicMuted = m;
  if (!musicPlayer) return;
  try {
    if (m) {
      if (musicPlayer.playing) musicPlayer.pause();
    } else if (!musicPlayer.playing) {
      musicPlayer.play();
    }
  } catch {
    // audio unavailable — stay silent
  }
}
export function isMusicMuted() {
  return musicMuted;
}

function playOne(source: any) {
  if (!ready || soundMuted) return;
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

export function playCoin() {
  playOne(COIN_SOURCE);
}

export function playStarTick() {
  playOne(STAR_TICK_SOURCE);
}

export function playSinkDrop() {
  playOne(SINK_DROP_SOURCE);
}

// Main theme everywhere; belt loop on the belt screen (see GameRoot).
export function playMainMusic() {
  playTrack("main");
}

export function playBeltMusic() {
  playTrack("belt");
}
