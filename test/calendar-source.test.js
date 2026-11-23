const test = require('node:test');
const assert = require('node:assert');
const { fetchCalendar, eventsFromIcs, normalizeLink } = require('../src/calendar-source');

// "Now" is a fixed Monday at 10:00 local time, so the tests behave the same in any time zone.
const NOW = new Date(2026, 10, 23, 10, 0, 0);
const pad = (n) => String(n).padStart(2, '0');
// local date/time -> the "floating" form used in calendar files (no time zone attached)
const local = (dayOffset, h, m = 0) => {
  const d = new Date(2026, 10, 23 + dayOffset, h, m);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
};
const date = (dayOffset) => {
  const d = new Date(2026, 10, 23 + dayOffset);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};
const cal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((lines, i) => ['BEGIN:VEVENT', `UID:e${i}`, ...lines, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const titles = (items) => items.map((i) => i.text);

test('today\'s events come first, in time order, with all-day ones on top', () => {
  const items = eventsFromIcs(cal(
    ['SUMMARY:Lunch with Sam', `DTSTART:${local(0, 12, 30)}`, `DTEND:${local(0, 13, 30)}`],
    ['SUMMARY:Team standup', `DTSTART:${local(0, 9, 30)}`, `DTEND:${local(0, 9, 45)}`],
    ['SUMMARY:Rent due', `DTSTART;VALUE=DATE:${date(0)}`, `DTEND;VALUE=DATE:${date(1)}`],
    ['SUMMARY:Dentist', `DTSTART:${local(2, 15)}`, `DTEND:${local(2, 16)}`],
  ), NOW);
  assert.deepStrictEqual(titles(items), ['Rent due', 'Team standup', 'Lunch with Sam', 'Dentist']);
  assert.deepStrictEqual(items.map((i) => i.today), [true, true, true, false]);
  assert.strictEqual(items[0].label, 'all day');
  assert.match(items[1].label, /^0?9[:.]30/);
  assert.match(items[3].label, /^\S+ 0?(3|15)[:.]00/); // weekday then the time
});

test('events outside the coming week are left out', () => {
  const items = eventsFromIcs(cal(
    ['SUMMARY:Yesterday', `DTSTART:${local(-1, 9)}`, `DTEND:${local(-1, 10)}`],
    ['SUMMARY:In six days', `DTSTART:${local(6, 9)}`, `DTEND:${local(6, 10)}`],
    ['SUMMARY:In eight days', `DTSTART:${local(8, 9)}`, `DTEND:${local(8, 10)}`],
  ), NOW);
  assert.deepStrictEqual(titles(items), ['In six days']);
});

test('repeating events show each time they happen, and skipped dates stay skipped', () => {
  const items = eventsFromIcs(cal(
    ['SUMMARY:Gym', `DTSTART:${local(-14, 18)}`, `DTEND:${local(-14, 19)}`, 'RRULE:FREQ=DAILY', `EXDATE:${local(1, 18)}`],
  ), NOW);
  assert.strictEqual(items.length, 6); // seven days in view, one skipped
  assert.strictEqual(items[0].today, true);
  assert.ok(items.slice(1).every((i) => !i.today));
});

test('a multi-day event that began earlier still shows today, once', () => {
  const items = eventsFromIcs(cal(
    ['SUMMARY:Conference', `DTSTART;VALUE=DATE:${date(-1)}`, `DTEND;VALUE=DATE:${date(3)}`],
  ), NOW);
  assert.deepStrictEqual(titles(items), ['Conference']);
  assert.strictEqual(items[0].today, true);
  assert.match(items[0].label, /^until /);
});

test('an all-day event that ended yesterday does not leak into today', () => {
  const items = eventsFromIcs(cal(
    ['SUMMARY:Yesterday only', `DTSTART;VALUE=DATE:${date(-1)}`, `DTEND;VALUE=DATE:${date(0)}`],
  ), NOW);
  assert.deepStrictEqual(items, []);
});

test('cancelled and untitled events are skipped, and one broken event does not hide the rest', () => {
  const items = eventsFromIcs(cal(
    ['SUMMARY:Cancelled thing', 'STATUS:CANCELLED', `DTSTART:${local(0, 11)}`, `DTEND:${local(0, 12)}`],
    [`DTSTART:${local(0, 13)}`, `DTEND:${local(0, 14)}`],
    ['SUMMARY:No start time'],
    ['SUMMARY:Real one', `DTSTART:${local(0, 15)}`, `DTEND:${local(0, 16)}`],
  ), NOW);
  assert.deepStrictEqual(titles(items), ['Real one']);
});

test('links: https and webcal are accepted, anything else is refused', () => {
  assert.strictEqual(normalizeLink('webcal://calendar.google.com/calendar/ical/x/private-abc/basic.ics'), 'https://calendar.google.com/calendar/ical/x/private-abc/basic.ics');
  assert.match(normalizeLink('  https://calendar.google.com/calendar/ical/x/basic.ics '), /^https:\/\/calendar\.google\.com/);
  assert.strictEqual(normalizeLink('http://calendar.google.com/x.ics'), '');
  assert.strictEqual(normalizeLink('file:///C:/secrets.txt'), '');
  assert.strictEqual(normalizeLink('not a link'), '');
});

test('fetching: reads the link and turns it into events', async () => {
  let asked = '';
  global.fetch = async (url) => {
    asked = url;
    return { status: 200, ok: true, text: async () => cal(['SUMMARY:Standup', `DTSTART:${local(0, 9)}`, `DTEND:${local(0, 10)}`]) };
  };
  const items = await fetchCalendar('webcal://calendar.google.com/calendar/ical/me/private-abc/basic.ics', NOW);
  assert.deepStrictEqual(titles(items), ['Standup']);
  assert.match(asked, /^https:\/\/calendar\.google\.com/);
});

test('fetching: each kind of problem gets a clear message', async () => {
  await assert.rejects(fetchCalendar('', NOW), /isn't connected yet/);
  await assert.rejects(fetchCalendar('http://example.com/a.ics', NOW), /doesn't look like a calendar link/);
  global.fetch = async () => ({ status: 404, ok: false, text: async () => '' });
  await assert.rejects(fetchCalendar('https://calendar.google.com/x.ics', NOW), /refused/);
  global.fetch = async () => ({ status: 200, ok: true, text: async () => '<html>Sign in to Google</html>' });
  await assert.rejects(fetchCalendar('https://calendar.google.com/x', NOW), /didn't return a calendar/);
  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(fetchCalendar('https://calendar.google.com/x.ics', NOW), /Couldn't reach your calendar/);
});
