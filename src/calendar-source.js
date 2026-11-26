// Read-only view of a calendar, from its private iCal link (Google Calendar's
// "Secret address in iCal format", or the equivalent from Outlook or iCloud).
// Events are only ever read. Nothing is created, changed or deleted.
const ical = require('node-ical');

const DAYS_AHEAD = 7;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ITEMS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Accepts https:// and webcal:// links. Anything else is refused.
function normalizeLink(link) {
  const raw = String(link || '').trim().replace(/^webcals?:\/\//i, 'https://');
  let url;
  try { url = new URL(raw); } catch { return ''; }
  return url.protocol === 'https:' && url.hostname.includes('.') ? url.toString() : '';
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const timeText = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayText = (d) => d.toLocaleDateString([], { weekday: 'short' });

// The days Pomo shows: from the start of today to the end of the sixth day after.
function viewWindow(now = new Date()) {
  const from = startOfDay(now);
  return { from, to: new Date(from.getTime() + DAYS_AHEAD * DAY_MS - 1) };
}

// One event -> a row for the list, or null if it falls outside the days in view.
// `end` is the last moment the event covers (for all-day events, the end of its last day).
function eventItem({ id, title, start, end, allDay }, from, to) {
  const text = String(title || '').trim();
  if (!text || !start) return null;
  const last = end || start;
  if (last < from || start > to) return null;

  // show it on the first day in view that it touches
  const shownOn = start < from ? from : startOfDay(start);
  const isToday = dayKey(shownOn) === dayKey(from);
  const multiDay = dayKey(startOfDay(last)) !== dayKey(startOfDay(start));
  let label;
  if (allDay) label = isToday ? (multiDay ? `until ${dayText(last)}` : 'all day') : dayText(shownOn);
  else if (start < from) label = `until ${timeText(last)}`;
  else label = isToday ? timeText(start) : `${dayText(start)} ${timeText(start)}`;

  return {
    id,
    text: text.slice(0, 140),
    label,
    today: isToday,
    sort: `${dayKey(shownOn)}|${allDay || start < from ? '00:00' : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`}`,
  };
}

// Puts rows in day and time order and drops the helper field used for sorting.
const finishItems = (items) => items
  .sort((a, b) => a.sort.localeCompare(b.sort) || a.text.localeCompare(b.text))
  .slice(0, MAX_ITEMS)
  .map(({ sort, ...item }) => item);

// Turns calendar text into a list of events for today and the days after it.
function eventsFromIcs(text, now = new Date()) {
  const { from, to } = viewWindow(now);
  const data = ical.sync.parseICS(text);
  const items = [];
  const seen = new Set();

  for (const event of Object.values(data)) {
    if (!event || event.type !== 'VEVENT' || !event.start) continue;
    if (String(event.status || '').toUpperCase() === 'CANCELLED') continue;
    let instances;
    try {
      // expandOngoing also returns things that began earlier and are still going on
      instances = ical.expandRecurringEvent(event, { from, to, expandOngoing: true });
    } catch {
      continue; // one odd event must not hide the rest of the calendar
    }
    for (const inst of instances) {
      if (!inst.start) continue;
      const title = String((inst.summary && inst.summary.val) || inst.summary || '').trim();
      const allDay = Boolean(inst.isFullDay);
      const id = `${event.uid || title}|${inst.start.toISOString()}`;
      if (seen.has(id)) continue;
      // an all-day event's end is the morning after its last day
      const end = inst.end ? new Date(inst.end.getTime() - (allDay ? 1 : 0)) : inst.start;
      const item = eventItem({ id, title, start: inst.start, end, allDay }, from, to);
      if (!item) continue;
      seen.add(id);
      items.push(item);
    }
  }
  return finishItems(items);
}

async function fetchCalendar(link, now = new Date()) {
  if (!String(link || '').trim()) throw new Error('Your calendar isn\'t connected yet. Click ⚙ and, under Calendar, sign in with Google or paste a private link');
  const url = normalizeLink(link);
  if (!url) throw new Error('That doesn\'t look like a calendar link. It should start with https://');
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch {
    throw new Error('Couldn\'t reach your calendar. Check your internet connection');
  }
  if (res.status === 404 || res.status === 403 || res.status === 401) {
    throw new Error('The calendar link was refused. Copy the "Secret address in iCal format" again');
  }
  if (!res.ok) throw new Error(`Your calendar answered with an error (${res.status})`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('That calendar is too large to read');
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error('That link didn\'t return a calendar. Use the "Secret address in iCal format", not the page link');
  }
  return eventsFromIcs(text, now);
}

module.exports = { fetchCalendar, eventsFromIcs, normalizeLink, viewWindow, eventItem, finishItems };
