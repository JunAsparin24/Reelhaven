// Local, calendar-based events. These are simulated on this device only —
// they are NOT globally synchronised. A future backend can replace
// activeEvents() with server-scheduled events.
export const LOCAL_EVENTS = [
  {
    id: 'weekend_market', name: 'Weekend Market', icon: 'coin',
    text: 'Local event: fish sell for 20% more on Saturdays and Sundays.',
    active: d => d.getDay() === 0 || d.getDay() === 6,
    effects: { sellBonus: 0.2 },
  },
  {
    id: 'full_moon', name: 'Full Moon Nights', icon: 'moon',
    text: 'Local event: rare fish are a little more common at night (14th–16th of each month).',
    active: d => d.getDate() >= 14 && d.getDate() <= 16,
    effects: { nightLuck: 0.15 },
  },
];

export function activeEvents(date = new Date()) {
  return LOCAL_EVENTS.filter(e => e.active(date));
}

export function eventEffect(key) {
  return activeEvents().reduce((sum, e) => sum + (e.effects[key] || 0), 0);
}
