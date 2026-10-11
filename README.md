# Beneath Tristram

A prototype survival-horror dungeon crawler in the style of **Fear & Hunger**, set in the world of the first **Diablo**.

Tristram has burned. You are not a hero. You have no class and no destiny. You are a greedy treasure hunter who heard that a dead king's church sits on top of a dead king's gold. There is no winning here. There is only how deep you dare to go, and whether you come back up.

## Play

Open `index.html` in a browser. There is no build step and nothing to install.

A one-file build can be made with `node tools/bundle.mjs`. It writes `dist/beneath-tristram.html`.

| Key | Action |
| --- | --- |
| Arrows / WASD | Move, navigate menus |
| Z / Space / Enter | Act: talk, open, search, confirm |
| X / Esc | Pack and menu, back |
| Tab / M | Automap overlay |
| Shift | Hurry text along |
| N | Toggle sound |

On touch screens an on-screen pad appears.

## What is in the prototype

**The town.** The ruins of Tristram are a hub, not a safe haven.
- Deckard Cain gives lore and hints.
- Wirt sells supplies and buys your treasure at half its value.
- Adria sells potions, salves and Town Portal scrolls.
- A campfire in the ruined Rising Sun lets you sleep and save.
- A loose stone in the old well hides your hoard.
- The road south lets you leave Tristram for good.

**The dungeon.** Sixteen procedurally generated levels go down through the Cathedral, the Catacombs, the Caves and Hell. The graveyard crypt opens a shortcut to level 5 and the river fissure one to level 9, once you have found their other ends from below. Each level keeps its state, and the dead stir again whenever you sleep in town.

**Survival.** You track several things at once:
- Life, Mind, Hunger and torch fuel.
- Darkness eats your mind. A low mind brings whispers, red eyes in the dark, phantom monsters and paralysing terror in combat.
- Wounds bleed, bites get infected, acid poisons, and bones break.
- Limbs can be cut off and stay lost. A lost right arm means fighting off-hand. Lost legs mean crawling.
- Food comes from Wirt, from barrels and from what you kill. Carve beasts for meat, or carve people for something worse, and cook it at the campfire.

**Combat.** Combat is turn-based and front-view. You target a body part:
- Head and torso kill.
- Arms disarm: each attack belongs to a limb, so cutting off the arm that holds the axe stops the axe.
- Legs and wings cripple, and a crippled monster cannot chase you.

Weapon types matter. Slashing takes limbs, blunt crushes skulls and skeletons, piercing finds the heart. You can guard, use items, run, or throw your purse away to escape for certain.

**Greed.** Gold glints in the dark to lure you deeper, and you pick it up whether you want to or not. The heavier your purse, the more monsters hear you and the harder it is to run. You can only save by sleeping in town or by paying a bloodstained altar.

**The coin.** Fear & Hunger's coin flip decides many risky moments:
- forcing a trapped chest
- reaching into a corpse
- praying at a shrine
- diving away from an exploding barrel
- eating a pale mushroom
- surviving the Butcher's cleaver

**Diablo 1 set pieces:**
- The Butcher's room of hooks on level 2 ("Ah... fresh meat!").
- King Leoric's tomb on level 3, where he raises the dead and guards his crown.
- Gharbad the Weak's bargain on level 4.
- The Lord of Terror on level 16, and a soulstone you probably should not pick up.

**Endings.** You will most likely die. You can leave Tristram with whatever you hoarded, and the ending judges how much it was. Or you can reach the bottom.

## Code layout

Plain JavaScript loaded as classic scripts. Everything is drawn at runtime: there are no image or sound files.

| File | Purpose |
| --- | --- |
| `src/core.js` | Constants, seeded RNG, clock, input |
| `src/gfx.js` | Canvas helpers, pixel-art post-processing, text and windows |
| `src/art.js` | Procedural tilesets for each theme, decals, character sprites |
| `src/objects.js` | Map object sprites |
| `src/monsters.js` | Monster data and layered combat sprites (one layer per body part) |
| `src/items.js` | Items, gear, treasure and loot tables |
| `src/lore.js` | Intro, notes, dialogue, shrine effects, epitaphs |
| `src/mapgen.js` | Town layout and dungeon generation (rooms, caves, special rooms) |
| `src/light.js` | Shadowcasting field of view, static lights, dithered darkness |
| `src/audio.js` | Web Audio ambience, a plucked-string town theme, sound effects |
| `src/ui.js` | Message boxes, choices, the coin flip, toasts, fades |
| `src/player.js` | Player stats, injuries, survival upkeep, item use |
| `src/world.js` | Exploration, monster AI, interactions, level changes, rendering |
| `src/combat.js` | Turn-based body-part combat |
| `src/menu.js` | Pack menu, town services, shops, stash |
| `src/save.js` | Save and load (localStorage) |
| `src/scenes.js` | Title, intro and ending screens |
| `src/main.js` | Boot, main loop, scene flow, touch controls |

## Credits

This is a non-commercial fan prototype. Diablo, Tristram and its characters belong to Blizzard Entertainment. Fear & Hunger is by Miro Haverinen. All art, sound and text here are original and generated in code.
