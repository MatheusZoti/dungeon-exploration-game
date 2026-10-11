'use strict';
// Item definitions. Prices are what Wirt and Adria charge; treasures sell for half their value.

const ITEMS = {
  // ---- food
  bread: { name: 'Stale Bread', type: 'food', food: 22, price: 10, stack: 9, desc: 'Hard enough to break a tooth. It will keep you going.' },
  jerky: { name: 'Dried Meat', type: 'food', food: 32, price: 18, stack: 9, desc: 'Salted strips of something that was probably a goat.' },
  apple: { name: 'Withered Apple', type: 'food', food: 12, mind: 2, price: 6, stack: 9, desc: 'Soft, brown, and sweet. A small mercy.' },
  rawmeat: { name: 'Raw Meat', type: 'food', food: 28, raw: true, cook: 'roast', price: 6, stack: 9, desc: 'Fresh from a carcass. Eating it raw is a gamble. Cook it at a fire.' },
  roast: { name: 'Roasted Meat', type: 'food', food: 45, mind: 4, price: 20, stack: 9, desc: 'Charred, greasy and hot. It tastes like being alive.' },
  flesh: { name: 'Strange Flesh', type: 'food', food: 40, mind: -12, raw: true, cook: 'roastflesh', price: 0, stack: 9, desc: 'You know what this is. You are trying very hard not to.' },
  roastflesh: { name: 'Cooked Flesh', type: 'food', food: 55, mind: -8, price: 0, stack: 9, desc: 'It smells like pork. You keep telling yourself that.' },
  mushroom: { name: 'Pale Mushroom', type: 'food', food: 8, gamble: true, price: 4, stack: 9, desc: 'It grows on the dead. It might clear your head. It might poison you.' },
  wine: { name: "Ogden's Wine", type: 'food', food: 4, mind: 15, price: 30, stack: 5, desc: 'The last bottles from the Rising Sun. It takes the edge off.' },

  // ---- medicine
  hpot: { name: 'Potion of Healing', type: 'potion', hp: 22, price: 50, stack: 9, desc: 'Red as heart\'s blood. Closes wounds.' },
  fhpot: { name: 'Potion of Full Healing', type: 'potion', hp: 999, stopBleed: true, price: 160, stack: 5, desc: 'Thick and warm. Heals everything that can still heal.' },
  mpot: { name: 'Potion of Mana', type: 'potion', mind: 30, price: 50, stack: 9, desc: 'Blue as a drowned man\'s lips. Sorcerers drink it for power. You drink it to stay sane.' },
  rpot: { name: 'Potion of Rejuvenation', type: 'potion', hp: 22, mind: 30, price: 120, stack: 5, desc: 'Violet and fizzing. Restores body and mind.' },
  bandage: { name: 'Linen Bandage', type: 'medicine', stopBleed: true, price: 15, stack: 9, desc: 'Binds a wound and stops the bleeding.' },
  splint: { name: 'Splint', type: 'medicine', setBone: true, price: 30, stack: 5, desc: 'Two sticks and a strap. Sets a broken bone.' },
  salve: { name: "Adria's Salve", type: 'medicine', cure: true, price: 60, stack: 5, desc: 'Smells of graves and lavender. Draws out infection and poison.' },
  elixir: { name: 'Elixir of Vitality', type: 'potion', maxHp: 6, hp: 6, price: 400, stack: 3, desc: 'Permanently strengthens the body.' },

  // ---- tools
  torch: { name: 'Torch', type: 'light', fuel: 240, price: 20, stack: 9, desc: 'Pitch-soaked rags on a stick. Light is life down there.' },
  tp: { name: 'Scroll of Town Portal', type: 'scroll', price: 200, stack: 5, desc: 'Opens a gate back to Tristram. The gate stays open until you return through it.' },

  // ---- treasure (value = what the hoard is worth; Wirt pays half)
  chalice: { name: 'Tarnished Chalice', type: 'treasure', value: 60, desc: 'Silver under the black. Someone drank communion wine from this.' },
  ring: { name: 'Gold Ring', type: 'treasure', value: 80, desc: 'Still on the finger when you found it.' },
  icon: { name: 'Gilded Icon', type: 'treasure', value: 120, desc: 'A saint with her eyes scratched out.' },
  ruby: { name: 'Uncut Ruby', type: 'treasure', value: 160, desc: 'It catches the torchlight like a drop of blood.' },
  sapphire: { name: 'Sapphire', type: 'treasure', value: 200, desc: 'Cold and blue and perfect.' },
  reliquary: { name: 'Jeweled Reliquary', type: 'treasure', value: 300, desc: 'Inside is a finger bone. The box is worth more than the saint.' },
  horadric: { name: 'Horadric Relic', type: 'treasure', value: 450, desc: 'Carved with signs older than the church built over it.' },
  skullcup: { name: 'Jeweled Skull', type: 'treasure', value: 600, desc: 'Gold leaf, garnets in the eye sockets. Hellish taste, heavenly price.' },
  crown: { name: 'Crown of Leoric', type: 'treasure', value: 1500, desc: 'The crown of the mad king. It is very heavy, and very beautiful.' },
  soulstone: { name: 'Soulstone', type: 'treasure', value: 99999, desc: 'It is the most beautiful thing you have ever seen.' },

  // ---- weapons (dmg range, acc bonus, kind: slash/blunt/pierce)
  shortsword: { name: 'Worn Short Sword', type: 'weapon', dmg: [3, 7], acc: 0, kind: 'slash', price: 40, desc: 'Notched and dull. It was your father\'s.' },
  dagger: { name: 'Dagger', type: 'weapon', dmg: [2, 6], acc: 12, kind: 'pierce', price: 30, desc: 'Quick and quiet. Good for finding the gaps.' },
  club: { name: 'Spiked Club', type: 'weapon', dmg: [3, 8], acc: -3, kind: 'blunt', price: 45, desc: 'Breaks bones. Skeletons hate it.' },
  axe: { name: 'Hand Axe', type: 'weapon', dmg: [4, 9], acc: -5, kind: 'slash', sever: 10, price: 90, desc: 'A woodsman\'s axe. Good at taking limbs.' },
  mace: { name: 'Mace', type: 'weapon', dmg: [5, 10], acc: -5, kind: 'blunt', price: 120, desc: 'Flanged iron. Crushes skulls.' },
  falchion: { name: 'Falchion', type: 'weapon', dmg: [6, 12], acc: 0, kind: 'slash', price: 220, desc: 'A heavy, curved blade.' },
  morningstar: { name: 'Morning Star', type: 'weapon', dmg: [7, 14], acc: -6, kind: 'blunt', price: 300, desc: 'A spiked ball of iron on a haft.' },
  bastard: { name: 'Bastard Sword', type: 'weapon', dmg: [8, 16], acc: -4, kind: 'slash', twoHand: true, price: 420, desc: 'Needs both hands to swing properly.' },
  warhammer: { name: 'War Hammer', type: 'weapon', dmg: [10, 18], acc: -10, kind: 'blunt', twoHand: true, price: 480, desc: 'Plate armor folds under it.' },
  cleaver: { name: "The Butcher's Cleaver", type: 'weapon', dmg: [8, 17], acc: -2, kind: 'slash', sever: 30, unique: true, price: 0, desc: 'Still sticky. It wants to take things off.' },
  arkaine: { name: 'Blade of the Horadrim', type: 'weapon', dmg: [11, 20], acc: 8, kind: 'slash', unique: true, price: 0, desc: 'Old steel that never dulls. It hums near demons.' },

  // ---- armor (def reduces damage and injury chance)
  rags: { name: 'Traveling Clothes', type: 'armor', def: 0, price: 0, desc: 'Wool and leather, patched many times.' },
  leather: { name: 'Leather Armor', type: 'armor', def: 1, price: 70, desc: 'Boiled leather. Stops a scratch.' },
  studded: { name: 'Studded Leather', type: 'armor', def: 2, price: 160, desc: 'Iron studs on thick hide.' },
  chain: { name: 'Chain Mail', type: 'armor', def: 3, flee: -8, price: 320, desc: 'Heavy rings of steel. Hard to run in.' },
  plate: { name: 'Field Plate', type: 'armor', def: 5, flee: -18, price: 700, desc: 'A knight\'s armor. You will not outrun anything.' },
};
for (const id in ITEMS) ITEMS[id].id = id;

// Loot tables by theme. Weighted lists of [itemId, weight].
const LOOT = {
  common: [['bread', 14], ['jerky', 6], ['apple', 8], ['torch', 12], ['bandage', 10], ['hpot', 6], ['mpot', 5], ['splint', 3], ['wine', 2]],
  treasure: {
    cathedral: [['chalice', 10], ['ring', 8], ['icon', 5], ['ruby', 2]],
    catacombs: [['ring', 6], ['icon', 8], ['ruby', 6], ['reliquary', 3], ['sapphire', 2]],
    caves: [['ruby', 6], ['sapphire', 6], ['reliquary', 5], ['horadric', 3]],
    hell: [['sapphire', 4], ['reliquary', 6], ['horadric', 6], ['skullcup', 5]],
  },
  gear: {
    cathedral: [['dagger', 4], ['club', 5], ['axe', 3], ['leather', 4], ['mace', 1]],
    catacombs: [['axe', 4], ['mace', 4], ['falchion', 2], ['studded', 3], ['leather', 2]],
    caves: [['falchion', 4], ['morningstar', 3], ['chain', 2], ['studded', 2], ['bastard', 1]],
    hell: [['bastard', 3], ['warhammer', 3], ['chain', 2], ['plate', 1], ['morningstar', 2]],
  },
  deep: [['fhpot', 2], ['rpot', 3], ['salve', 3], ['tp', 2], ['elixir', 1]],
};

function itemName(id, qty) {
  const it = ITEMS[id];
  return qty > 1 ? `${it.name} ×${qty}` : it.name;
}
