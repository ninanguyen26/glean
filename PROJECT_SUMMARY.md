# Glean — Project Summary

## The Idea

**Glean** is a cozy trash-sorting game. Players work shifts on a 2D conveyor belt, sorting trash into the correct bins (compost, recycle, landfill) via tap-to-sort / drag-to-bin.

### Core Loop
- Items travel along a conveyor belt
- Drag items to the correct bin (or tap)
- Multi-material items (bottles) need disassembly first: twist the cap, peel the wrapper, then sort the parts
- Some items need rinsing in the sink before sorting
- Shifts are item-counted (~20 items), not timed

### Progression
- 5-day workweek per city (Mon–Fri)
- Stars per shift (1–3 based on accuracy) unlock the next day and new cities
- XP per correct sort → player levels (200×level thresholds)
- Cash per shift: $20 base (50%+ accuracy only) + $2/correct + streak bonuses
- Streak bonuses: 5/10/15 streak = +$5/$8/$10 + 5 XP each; 20 streak = +$15 + 15 XP
- 3 Tier-1 cities: Portland → Toronto → UK (8/15 star unlocks)
- Cash is banked for v2 (shop/upgrades); v1 is earn-only

### Content Systems
- **Universal items**: 15 base items across all regions
- **Regional items**: Portland, Toronto, UK each have unique pools + signature garbage
- **Seasonal items**: 4 seasons (Spring/Summer/Fall/Winter) selected by device date, 17.5% replace rate, 60/30/10 rarity with soft pity
- **Signature items**: Complex multi-part items (bottles) with disassembly mechanics

### Design Pillars
- Premium upfront, no ads
- Animation/tactile feel is central (Good Pizza Great Pizza visual ref)
- Mistake-as-lesson: first mistake per item type per shift teaches, repeats penalize
- Pause-when-learning: first 2 encounters per mechanic pause the belt

---

## What's Done

### Bottle Disassembly Modal
- 5 sprites for blue bottle (body, cap, no-cap, whole, wrapper)
- 5 sprites for red bottle (-1 variants)
- Twist cap → peel wrapper → sort 3 parts
- Cap chip and wrapper chip detach to sides
- Cap chip now syncs size with SpriteBottle's CAP_W/CAP_H
- Ngoc tunes SpriteBottle.tsx manually

### Belt Presentation
- Item labels removed (cleaner look)
- Regular items at 72pt, bottles at 96pt
- `src/game/spriteSizes.ts`: per-item size/dx/dy tuning for all 110 items, organized by region/season, scales with screen width
- Item drop shadows for depth
- Custom belt.png texture (full-width, subtle rumble animation)
- Danger flash (miss edge) extracted as sibling, centered on belt

### Progression System
- `player_profile` table: cash, XP
- Stars: 90%+ = 3, 70–89% = 2, 50–69% = 1, <50% = 0
- Cash/XP/streak bonuses calculated at shift end
- Summary screen shows cash earned, XP gained, level-up
- Quit forfeits all rewards

### Seasonal System
- 4 date-ranged seasons in `data/seed/seasons.json`
- `getActiveSeason()` selects by device local date
- 36 seasonal items total (9 per season)
- Rarity-weighted draws with pity system
- DB v5 (player_profile added)

### Technical
- Stack: Expo SDK 57, React Native, Skia 2.6.x, Reanimated 4, Gesture Handler, SQLite, EAS OTA
- Repo: `~/Documents/Projs/glean` (Mac only, no local VM copy)
- GitHub: https://github.com/ninanguyen26/glean.git

---

## What's Waiting

### Art (Ngoc's domain)
- **Do not generate sprites** — Ngoc provides all art
- Batch 2 universal sprites removed from code; awaiting Ngoc's PNGs (eggshells, coffee-grounds, leaves, office-paper, tin-can, foam-cup, chip-bag, broken-pen)
- Cigarette butt sprite still missing
- Remaining universal/regional/seasonal art as needed

### Testing
- [ ] Progression device pass: verify stars/XP/cash/level on summary screen
- [ ] FIFO sink stress test
- [ ] Seasonal reseed verification (DB v5)
- [ ] Belt visual check (belt.png, rumble, shadows, item sizes)

### Content
- [ ] Toronto/UK roster reconciliation
- [ ] Winter seasonal art
- [ ] Remaining regional signature items

### Polish
- [ ] Particle tuning
- [ ] Haptics pass
- [ ] Audio (synthesized in-house, Librarian pipeline)
- [ ] Difficulty tuning
- [ ] OTA update verification

### Future (v2)
- Cash spending (shop/upgrades)
- Tokyo/5-stream cities
- Upcycle bench
- Overdrive mode

---

## Key Files

| File | Purpose |
|------|---------|
| `src/game/BeltScreen.tsx` | Main belt loop, shift logic |
| `src/game/SpriteBottle.tsx` | Bottle modal visuals (Ngoc tunes) |
| `src/game/DisassemblyModal.tsx` | Disassembly interaction |
| `src/game/spriteSizes.ts` | Per-item size/position tuning |
| `src/game/sprites.ts` | Sprite registry |
| `src/game/db.ts` | SQLite, seasons, progression |
| `data/seed/items.json` | Item definitions |
| `data/seed/seasons.json` | Seasonal definitions |
| `assets/sprites/` | Item sprites |
| `assets/extra/belt.png` | Belt texture |

---

*Last updated: 2026-10-06*
