'use strict';
// Text: intro, notes found in the dungeon, shrine effects, whispers, epitaphs.

const LORE = {
  intro: [
    'Tristram burned three nights ago.',
    'King Leoric went mad. His son was taken. The Archbishop led the townsfolk down beneath the cathedral to save the boy, and nobody came back up.',
    'Then the things from below came up instead.',
    'You are not a warrior. You are not a priest, or a sorcerer, or a hero.',
    'You are a man who heard that a dead king\'s church sits on top of a dead king\'s gold.',
    'Nobody is left to stop you from taking it.',
    'Only the dark. And your own hunger.',
  ],

  notes: [
    { title: 'Scrawled on vellum', text: 'Day four. Ran out of oil. I can hear them in the walls, scratching. They know I can\'t see. They wait for the dark. {r}Never let the torch go out.{/}' },
    { title: 'A child\'s drawing', text: 'A stick figure with a crown. Many small red figures around it. Underneath, in a child\'s hand: "Daddy is a king again."' },
    { title: 'Page from a ledger', text: 'Paid to the Archbishop for the blessing of the expedition: 300 gold. Paid for rope, lamps, bread: 40 gold. Paid for my life: everything else.' },
    { title: 'Carved into the wall', text: 'THE GOLD IS REAL. THE GOLD IS REAL. THE GOLD IS REAL. DO NOT GO DEEPER FOR IT.' },
    { title: 'Bloodstained letter', text: 'Gillian, if this finds you, do not wait for me. The Archbishop is not what he seems. He walks ahead of us and the shadows move out of his way.' },
    { title: 'A Horadric fragment', text: '...the Three were bound in stones of soul, and the stones were hidden. The youngest, the Lord of Terror, was buried beneath the earth of Khanduras, and a church raised above him so none would dig.' },
    { title: 'Torn journal page', text: 'Marrow tastes like butter when you are starving. I am not proud. I am alive. That is not the same as proud.' },
    { title: 'Note in Pepin\'s hand', text: 'For wounds from the clawed ones: clean, bind, pray. For the bites of the dead: there is nothing I can do, except the witch\'s salve. Go to Adria. Do not wait.' },
    { title: 'Scratched on a shield', text: 'The fat one wears an apron. If you hear "fresh meat", do not stay to see the rest. RUN.' },
    { title: 'A soldier\'s tally', text: 'Thirty-one marks scratched in rows. The last row is unfinished.' },
    { title: 'Lazarus\'s sermon', text: '"Do not fear the darkness, my children. The darkness has always loved you. It only wishes to come inside."' },
    { title: 'Merchant\'s note', text: 'Shoulda stayed in Westmarch. Found a ruby the size of an egg on level three. Can\'t find the stairs up. The ruby is very pretty in the dark.' },
    { title: 'Prayer card', text: 'Light of Zakarum, keep me. Light of Zakarum, keep me. Light of Zakarum, keep me. Light of' },
    { title: 'Half a map', text: 'The stairs never lead where you think. The deeper levels shift. Trust your own map, not mine.' },
  ],

  cain: {
    first: [
      'Stay awhile and listen...',
      'So. Another one comes to Tristram. Not to save it, I think. You have the look of a man counting coins in his head.',
      'I am Deckard Cain. I am the last of the Horadrim, and the last of many things here.',
      'Beneath the cathedral there is a labyrinth. Leoric\'s madness, his tomb, his guards. Below that, catacombs. Below that, caves. And below all of it, something that should never have woken.',
      'Take this. I have little use for it now. If you insist on going down, I would rather you came back up.',
    ],
    topics: [
      ['The labyrinth', 'The cathedral levels are the shallowest, and the least cruel. The dead walk there, and Fallen Ones, and worse things that came up from below. Keep a torch lit. In the dark, the mind breaks before the body does.'],
      ['The Butcher', 'Some who fled the second level spoke of a room full of hooks, and a voice that called them meat. If you hear it, do not be proud. Run.'],
      ['King Leoric', 'Leoric was a good king once. The darkness took his mind and then his son. He lies in his tomb below the cathedral and does not rest. They say his crown went into the ground with him. If you must face him, bring something heavy. Blades skitter off old bones; a mace breaks them.'],
      ['Food and wounds', 'You will starve faster than you think down there. Carve what you kill, if you can stomach it, and cook it over a fire. Bind bleeding wounds before they drain you. Adria\'s salve draws out the rot from bites.'],
      ['Going deeper', 'Old passages connect the town to the deeper levels. The crypt in the graveyard opens on the catacombs, and the fissure by the river runs down to the caves. Neither will let you in until you have found its other end below.'],
      ['The gold', 'Gold? Yes, there is gold. Leoric\'s, the church\'s, the dead men\'s. The question is not whether there is gold. The question is how deep you are willing to follow it.'],
    ],
    again: ['Stay awhile and listen...', 'You are still alive. Good. That is rarer than gold, these days.', 'Ah, the treasure hunter. Still breathing, I see.'],
  },

  wirt: {
    greet: [
      'Pssst. Over here. Look who\'s still breathing. Wanna buy something? I only deal in gold.',
      'You again? I figured you\'d be meat by now. Let\'s trade.',
      'The town burned and I\'m still here. You know why? Business.',
    ],
    sell: 'Shiny stuff from down there? I\'ll take it. Half what it\'s worth, but half is better than dead.',
  },

  adria: {
    greet: [
      'The darkness below hungers, as do you. I sell what keeps both at bay.',
      'I sensed you coming. You smell of the grave already.',
      'The salve is for bites. The blue is for the mind. The red, for the meat of you.',
    ],
  },

  shrines: [
    { name: 'Mysterious Shrine', heads: 'gift', tails: 'drain' },
    { name: 'Gloomy Shrine', heads: 'mind', tails: 'curse' },
    { name: 'Weird Shrine', heads: 'heal', tails: 'bleed' },
    { name: 'Eldritch Shrine', heads: 'restore', tails: 'drain' },
    { name: 'Divine Shrine', heads: 'restore', tails: 'nothing' },
    { name: 'Spooky Shrine', heads: 'mind', tails: 'terror' },
    { name: 'Tainted Shrine', heads: 'gold', tails: 'curse' },
    { name: 'Fascinating Shrine', heads: 'vigor', tails: 'drain' },
    { name: 'Ornate Shrine', heads: 'gold', tails: 'terror' },
    { name: 'Creepy Shrine', heads: 'vigor', tails: 'bleed' },
  ],

  whispers: [
    'Someone is breathing just behind you.',
    'You hear your name, very softly, from the dark.',
    'Something wet drags across the floor nearby.',
    'You can feel eyes on you.',
    'Did that shadow just move?',
    'Your torch hand will not stop shaking.',
    'You remember a song your mother sang. You cannot remember the words.',
    'A child laughs somewhere below.',
    'The walls are breathing. No. No, they are not.',
    'Turn back, says a voice that sounds like yours.',
  ],

  darkness: [
    'The darkness presses in on you.',
    'You cannot see your own hands.',
    'Every sound in the dark is a claw.',
  ],

  examine: {
    pew: ['An overturned pew, slick with old blood.', 'The pews still face the altar. Nobody is coming to pray.'],
    candelabra: ['Candles, still burning. Someone, or something, keeps lighting them.'],
    hanging: ['A man hangs from a meat hook. He has been carefully, expertly, butchered.', 'Someone\'s father. Someone\'s son. Meat, now.'],
    bookshelf: ['Prayer books, swollen with damp. Most of the pages are glued together with something dark.'],
    graveCross: ['A fresh grave. The earth on it is disturbed from below.', 'No name on this one. There was no one left to carve it.'],
    graveStone: ['"Here lies Farnham\'s liver." Somebody had a sense of humor, once.', 'The name is worn away.'],
    cauldron: ['Something green bubbles in the cauldron. It smells like a swamp and a sickbed.'],
    tree: ['A dead tree. The crows like it.'],
    cart: ['A wrecked cart. Whoever was fleeing with it did not get far.'],
    stake: ['A body, burned at the stake. The townsfolk did this, before the end. Afraid of the wrong things.'],
    rack: ['Griswold\'s weapon rack, half melted.'],
    brazier: ['A brazier of black iron. The fire in it burns without fuel.'],
  },

  depthLines: {
    1: 'The air under the cathedral is cold and smells of candle wax and rot.',
    2: 'Somewhere ahead, a heavy blade chops into a heavy table. Over and over.',
    3: 'The walls here are carved with the royal crest. You are in a king\'s tomb.',
    4: 'Something is pleading in a high little voice, somewhere ahead.',
    5: 'The catacombs. Bones in every niche, stacked like firewood.',
    9: 'Hot, wet air rises from below. The stone itself is sweating.',
    13: 'The stone is red here, and it is warm, and it is not stone.',
    16: 'You feel Him before you see anything. The pressure behind your eyes is unbearable.',
  },

  epitaph: {
    starved: 'You starved to death',
    bled: 'You bled to death',
    madness: 'Your mind broke, and the body followed',
    poison: 'The poison finished you',
    infection: 'The rot in your wounds took you',
    barrel: 'An exploding barrel tore you apart',
    trap: 'A trap killed you',
  },
};
