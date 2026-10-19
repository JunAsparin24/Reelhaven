// NPCs and their dialogue. Dialogue entries are checked top to bottom and the
// first whose `when` returns true is used. `ctx` helpers come from dialogue.js.
// `action` opens a feature after the conversation (shop, bridge, travel...).

export const NPCS = {
  mira: {
    id: 'mira', name: 'Mira', role: 'Friendly Fisher',
    look: { skin: '#e8b48f', hair: '#7a4a2c', hairStyle: 'long', shirt: '#5b9be0', pants: '#4f5f86', hat: 'straw' },
    dialogue: [
      { when: c => c.quest === 'q_welcome', lines: [
        'Oh! A new face on Sunny Shores! I’m Mira — I fish, I nap, I fish some more.',
        'Your grandpa’s old cottage is all yours now. It needs a little love, and so does this island.',
        'Stand at the end of a dock or beach and tap Fish. Hold to charge your cast, then wait for the splash!',
        'When the bobber dips, tap fast — then keep the fish inside the green zone. You’ll get the hang of it!',
      ] },
      { when: c => c.quest === 'q_set_sail', lines: [
        'My boat’s been leaking since the great seagull incident. Don’t ask.',
        'Bring me some wood and coins and we’ll patch her up. Coral Cove is just over the horizon!',
      ], action: 'map' },
      { when: c => c.isNight, lines: ['Night fishing is magic. Moon Jellies drift up to say hi after sunset.'] },
      { when: c => c.quest === 'q_hut', lines: ['A Fishing Hut would let me sell you fancy bait. Rowan can help — open Build mode with the hammer!'] },
      { when: () => true, lines: [
        'Rain brings out the Drizzle Darters. Storms bring… stranger things.',
        'Different spots, different fish! Try the pond at dawn sometime.',
        'Need to travel? Tap the boat at the end of the dock.',
      ], random: true },
    ],
  },
  nori: {
    id: 'nori', name: 'Nori', role: 'Shopkeeper',
    look: { skin: '#f6d3b3', hair: '#2e2a36', hairStyle: 'bun', shirt: '#f6b66c', pants: '#97603e', apron: '#fbfbf6' },
    dialogue: [
      { when: c => c.quest === 'q_market_day', lines: ['Fresh fish? I’ll buy anything that swims! Open your Bag and tap Sell whenever you like.'], action: 'shop' },
      { when: () => true, lines: [
        'Welcome to Nori’s! Rods, bait, decor — if it’s not here, you don’t need it.',
        'Back again? My favourite customer! Don’t tell the others.',
        'I’ve heard the Golden Rod can reel in a whale. I’ve also heard whales are very polite about it.',
      ], random: true, action: 'shop' },
    ],
  },
  rowan: {
    id: 'rowan', name: 'Rowan', role: 'Island Builder',
    look: { skin: '#9a6644', hair: '#2e2a36', hairStyle: 'short', shirt: '#e07f7d', pants: '#5f6f86', overalls: '#5b78a8', hat: 'hardhat', beard: '#2e2a36' },
    dialogue: [
      { when: c => !c.flag('bridgeRepaired') && (c.quest === 'q_bridge' || c.questIndex > 5), lines: [
        'That bridge has been broken since the last big storm. Fishers say there’s a hidden lagoon on the other side.',
        'Bring me 15 wood, 6 stone and 100 coins and I’ll have it fixed before lunch.',
      ], action: 'bridge' },
      { when: c => !c.flag('bridgeRepaired'), lines: [
        'Palm trees drop wood if you give ’em a friendly shake. Rocks give stone. Nature’s hardware store!',
        'Once you’re a bit more settled, I could fix that old bridge for you.',
      ] },
      { when: () => true, lines: [
        'Open Build mode with the hammer button. Green means go, red means… maybe somewhere else.',
        'Buildings aren’t just pretty. A Storage Shed holds more fish, a Garden grows bait!',
        'You can move anything you’ve built — tap it in Build mode.',
      ], random: true },
    ],
  },
  pip: {
    id: 'pip', name: 'Pip', role: 'Curious Explorer',
    look: { skin: '#c98d63', hair: '#d79a52', hairStyle: 'spiky', shirt: '#6dbb72', pants: '#97603e', hat: 'explorer', glasses: '#45384f' },
    dialogue: [
      { when: c => c.species < 3, lines: [
        'Hi hi hi! I’m Pip! I’m making a list of EVERY fish in the world. You can help!',
        'Tap the Fish tab to see the encyclopedia. Mystery silhouettes are fish nobody has caught yet!',
      ] },
      { when: c => c.quest === 'q_rare', lines: ['Golden Koi only rise in the pond in the morning. Sleep in the cottage if you need to wait!'] },
      { when: () => true, lines: [
        'Did you know some fish only come out at night? Or in the rain? Fish are so dramatic.',
        'Fishing spots have different fish. Docks, beaches, ponds, reefs… collect ’em all!',
        'I heard the Ancient Sea Turtle only visits patient anglers. Can you imagine?',
      ], random: true },
    ],
  },
  marlo: {
    id: 'marlo', name: 'Marlo', role: 'Reef Diver',
    look: { skin: '#6e4a33', hair: '#e8e2d0', hairStyle: 'short', shirt: '#69cfc9', pants: '#247d91', hat: 'bandana' },
    dialogue: [
      { when: () => true, lines: [
        'Welcome to the Cove! The reef fish are fast — a Coral Rod helps a lot out here.',
        'Tide pools refill with goodies every few minutes. Check them whenever you pass!',
        'Shells and sea glass wash up all the time here. Perfect for decorating!',
      ], random: true },
    ],
  },
  wren: {
    id: 'wren', name: 'Wren', role: 'Mangrove Hermit',
    look: { skin: '#e8b48f', hair: '#e8e2d0', hairStyle: 'long', shirt: '#5b936a', pants: '#6f5d44', hat: 'beanie', glasses: '#2c2433' },
    dialogue: [
      { when: () => true, lines: [
        'The fog keeps secrets. Walk the edges and you might find a hollow nobody else knows.',
        'Mud slows the feet but not the heart. Take your time, young angler.',
        'Glass Eels come out after dark. You will feel them before you see them.',
      ], random: true },
    ],
  },
  luna: {
    id: 'luna', name: 'Luna', role: 'Stargazer',
    look: { skin: '#f6d3b3', hair: '#b9a3d9', hairStyle: 'long', shirt: '#263a58', pants: '#45384f', hat: 'flower' },
    dialogue: [
      { when: () => true, lines: [
        'The bay never sees the sun. The fish here are bright, and very, very stubborn.',
        'The Moonfin rises for anglers who have proven themselves. Glow Bait helps it notice you.',
        'Moon crystals hum when you get close. Listen!',
      ], random: true },
    ],
  },
};
