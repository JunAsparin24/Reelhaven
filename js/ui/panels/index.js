// Panel registry: name -> { title, icon, render(body, ctx), wide?, onClose? }
import { inventoryPanel } from './inventory.js';
import { encyclopediaPanel } from './encyclopedia.js';
import { shopPanel } from './shop.js';
import { buildPanel } from './build.js';
import { mapPanel } from './map.js';
import { questsPanel, ordersPanel } from './quests.js';
import { friendsPanel, profilePanel } from './social.js';
import { settingsPanel } from './settings.js';
import { hallPanel } from './hall.js';

export const PANELS = {
  inventory: inventoryPanel,
  encyclopedia: encyclopediaPanel,
  shop: shopPanel,
  build: buildPanel,
  map: mapPanel,
  quests: questsPanel,
  orders: ordersPanel,
  friends: friendsPanel,
  profile: profilePanel,
  settings: settingsPanel,
  hall: hallPanel,
};
