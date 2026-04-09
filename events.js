// events.js  –  Grow-a-Garden
// Random events: fire from Firebase, display on screen, apply mutations.

window.Events = (() => {

  let activeEvents = {}; // eventId -> eventData
  let listenerAttached = false;

  // ── START LISTENING ───────────────────────────────────────
  function init() {
    if (listenerAttached) return;
    listenerAttached = true;

    // Poll every 15s instead of persistent onValue listener (avoids long-poll hammering)
    async function pollEvents() {
      try {
        const snap = await DB.get(DB.ref('gag/events'));
        activeEvents = {};
        if (snap.exists()) {
          snap.forEach(child => {
            const ev = child.val();
            if (ev.active) activeEvents[child.key] = ev;
          });
        }
        renderEventDisplay();
      } catch(e) {}
    }
    setTimeout(pollEvents, 3000);
    setInterval(pollEvents, 15000);
  }

  // ── DISPLAY EVENT PILLS ───────────────────────────────────
  function renderEventDisplay() {
    const container = document.getElementById('eventDisplay');
    if (!container) return;
    container.innerHTML = '';

    Object.values(activeEvents).forEach(ev => {
      const pill = document.createElement('div');
      pill.className = 'event-pill';
      pill.textContent = `${ev.icon || '⚡'} ${ev.name}`;
      pill.title = ev.description || '';
      pill.onclick = () => {
        UI.showNotif(`⚡ ${ev.name}: ${ev.description || ''}`, 'admin');
      };
      container.appendChild(pill);
    });
  }

  // ── GETTERS ───────────────────────────────────────────────
  function getActive() {
    return Object.values(activeEvents);
  }

  // ── RANDOM AUTO-EVENTS ────────────────────────────────────
  // Every 5–15 minutes, trigger a random event for 2–4 minutes.
  // Only runs if no event is already active.
  let autoEventTimer = null;
  function startAutoEvents() {
    scheduleNextAutoEvent();
  }

  function scheduleNextAutoEvent() {
    const delayMs = (5 + Math.random() * 10) * 60 * 1000; // 5-15 mins
    autoEventTimer = setTimeout(async () => {
      if (Object.keys(activeEvents).length === 0) {
        await fireRandomEvent();
      }
      scheduleNextAutoEvent();
    }, delayMs);
  }

  async function fireRandomEvent() {
    const evList = DATA.EVENTS;
    const ev     = evList[Math.floor(Math.random() * evList.length)];
    const key    = ev.id;
    const durMs  = ev.duration * 1000;

    await DB.set(DB.ref(`gag/events/${key}`), {
      ...ev,
      active:    true,
      startedAt: Date.now(),
      endsAt:    Date.now() + durMs
    });

    // Auto-end after duration
    setTimeout(() => endEvent(key), durMs);
  }

  async function endEvent(key) {
    await DB.update(DB.ref(`gag/events/${key}`), { active: false });
  }

  // ── ADMIN: MANUAL START ───────────────────────────────────
  async function adminStartEvent(eventId, durationSecs) {
    const evDef = DATA.getEventById(eventId);
    if (!evDef) return;
    const durMs = (durationSecs || evDef.duration) * 1000;

    await DB.set(DB.ref(`gag/events/${eventId}`), {
      ...evDef,
      active:    true,
      startedAt: Date.now(),
      endsAt:    Date.now() + durMs
    });

    setTimeout(() => endEvent(eventId), durMs);
    UI.showNotif(`⚡ Event started: ${evDef.name}`, 'admin');
  }

  async function adminEndEvent(eventId) {
    await endEvent(eventId);
    UI.showNotif('Event ended', '');
  }

  return {
    init, getActive, startAutoEvents,
    adminStartEvent, adminEndEvent, endEvent, fireRandomEvent,
  };
})();