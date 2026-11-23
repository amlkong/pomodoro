// Pomo's brain. Runs in the full-screen overlay and inside the timer window:
// in both cases the page itself is the room he walks around in.
(() => {
  const pet = document.getElementById('pet');
  const flip = document.getElementById('flip');
  const bubble = document.getElementById('bubble');
  const OVERLAY = location.pathname.endsWith('pet.html');

  const WALK_SPEED = 55; // px per second
  const GRAVITY = 2200;
  const NAP_MS = [4 * 60 * 1000, 6 * 60 * 1000]; // how long he stays put during focus
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // Which character is on stage. Everything character-specific (drawing, extra
  // moves, what they say) comes from src/characters/<id>.js
  let charId = '';
  let char = null;
  function setCharacter(id) {
    if (!window.CHARACTERS[id]) id = Object.keys(window.CHARACTERS)[0];
    if (id === charId) return;
    charId = id;
    char = window.CHARACTERS[id];
    flip.innerHTML = char.svg;
    flip.classList.remove('left');
    actUntil = 0;
    actPose = '';
    targetX = null;
    waitUntil = 0;
    setPose('');
  }

  let x = 40;
  let y = 0;            // height above the floor
  let vy = 0;
  let targetX = null;
  let pose = '';
  let mode = 'idle';    // idle, focus, break
  let waitUntil = 0;    // stay put until then
  let actPose = '';     // a short action that plays out before anything else
  let actUntil = 0;
  let restPose = '';    // what to go back to once that action ends
  let focusFresh = false; // a focus round just began: head for the corner first
  let drag = null;
  let hovering = false;
  let bubbleTimer = null;
  let lastNote = 0;

  const petW = () => pet.offsetWidth || 100;
  const petH = () => pet.offsetHeight || 100;
  const maxX = () => Math.max(0, window.innerWidth - petW() - 6);
  const maxY = () => Math.max(0, window.innerHeight - petH() - 12);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setPose(p) {
    if (p === pose) return;
    if (pose) flip.classList.remove(pose);
    pose = p;
    if (p) flip.classList.add(p);
  }

  function act(p, ms) {
    // remember what he was doing, so a nap or a dance carries on afterwards
    if (!actPose) restPose = pose === 'walking' || pose === 'held' ? '' : pose;
    actPose = p;
    actUntil = performance.now() + ms;
    targetX = null;
  }

  function say(text, ms = 3200) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function spawnNote() {
    const n = document.createElement('div');
    n.className = 'note';
    n.textContent = Math.random() < 0.5 ? '♪' : '♫';
    n.style.left = `${x + rand(0.15, 0.8) * petW()}px`;
    n.style.bottom = `${y + petH() * 0.75}px`;
    n.style.color = ['#ff6b5e', '#7b7fe8', '#4fb36a', '#ffb347'][Math.floor(rand(0, 4))];
    n.style.setProperty('--dx', `${rand(-30, 30)}px`);
    n.style.setProperty('--rot', `${rand(-40, 40)}deg`);
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 1900);
  }

  // Decide what to do next once Pomo has arrived somewhere or finished an action.
  function plan(now) {
    if (mode === 'focus') {
      // Settle down for a nap of around five minutes, then wander somewhere
      // new and settle again, so he isn't parked in one corner all round.
      if (focusFresh) {
        focusFresh = false;
        const corner = maxX() - 8;
        if (Math.abs(x - corner) > 4) { targetX = corner; return; }
      }
      if (pose === 'sitting') {
        // pick a spot a fair walk away from here
        const far = maxX() * 0.25;
        let spot = rand(0, maxX());
        for (let i = 0; i < 6 && Math.abs(spot - x) < far; i++) spot = rand(0, maxX());
        targetX = spot;
      } else {
        const [min, max] = (window.POMO_DEBUG && window.POMO_DEBUG.napMs) || NAP_MS;
        setPose('sitting');
        waitUntil = now + rand(min, max);
      }
      return;
    }
    if (mode === 'break') {
      if (pose === 'dancing') {
        const extra = pick(char.breakActions);
        if (extra && Math.random() < 0.3) act(extra.pose, extra.ms);
        else targetX = rand(0, maxX());
      } else {
        setPose('dancing');
        waitUntil = now + rand(5000, 8000);
      }
      return;
    }
    // idle: wander, rest, and show off a little
    if (pose !== '') {
      setPose('');
      waitUntil = now + rand(1500, 4500);
      return;
    }
    const r = Math.random();
    if (r < 0.55) targetX = rand(0, maxX());
    else if (r < 0.9 && char.idleActions.length) {
      const extra = pick(char.idleActions);
      act(extra.pose, extra.ms);
    }
    else waitUntil = now + rand(1500, 3500);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (resize) {
      setPose(''); // stand still while being resized
    } else if (drag) {
      setPose('held');
    } else if (y > 0) {
      vy -= GRAVITY * dt;
      y += vy * dt;
      setPose('held');
      if (y <= 0) {
        y = 0;
        vy = 0;
        setPose('');
        waitUntil = now + 500;
      }
    } else if (now < actUntil) {
      setPose(actPose);
    } else if (actPose) {
      // the little action is over: go back to what he was doing
      actPose = '';
      setPose(restPose);
    } else if (targetX !== null) {
      const dir = Math.sign(targetX - x);
      x += dir * (mode === 'break' ? WALK_SPEED * 1.4 : WALK_SPEED) * dt;
      flip.classList.toggle('left', dir < 0);
      setPose('walking');
      if (Math.abs(targetX - x) < 3) {
        targetX = null;
        plan(now);
      }
    } else if (now >= waitUntil) {
      plan(now);
    }

    if (pose === 'dancing' && now - lastNote > 700) {
      lastNote = now;
      spawnNote();
    }

    x = clamp(x, 0, maxX());
    y = clamp(y, 0, maxY());
    pet.style.transform = `translate(${x}px, ${-y}px)`;
    const bw = bubble.offsetWidth;
    bubble.style.transform = `translate(${clamp(x + petW() / 2 - bw / 2, 6, Math.max(6, window.innerWidth - bw - 6))}px, ${-(y + petH() + 8)}px)`;
    requestAnimationFrame(frame);
  }

  let wasPaused = false;
  function applyState(s) {
    setCharacter(s.settings.character);
    if (!resize) setScale(Number(s.settings.petScale) || 1);
    const next = !s.running ? 'idle' : s.phase === 'focus' ? 'focus' : 'break';
    // paused = stopped partway through a round (not a fresh or finished one)
    const paused = !s.running && s.remainingMs < s.totalMs;
    const resuming = wasPaused && next !== 'idle';
    wasPaused = paused;
    if (next === mode) return;
    mode = next;
    focusFresh = mode === 'focus';
    targetX = null;
    waitUntil = 0;
    if (performance.now() < actUntil) return; // mid celebration, let that finish
    setPose('');
    if (paused) say(pick(char.lines.paused));
    else if (resuming) say(pick(char.lines.resumed));
    else if (mode === 'focus') say(char.lines.focus);
    else if (mode === 'break') say(char.lines.break);
  }

  // In the overlay, clicks only land on Pomo and pass through everywhere else.
  const setHover = (over) => { if (OVERLAY) window.api.petHover(over); };
  pet.addEventListener('mouseenter', () => { hovering = true; setHover(true); });
  pet.addEventListener('mouseleave', () => { hovering = false; if (!drag && !resize) setHover(false); });

  // Pick him up, carry him around, drop him. A plain click is a poke.
  pet.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { ox: e.clientX - x, oy: window.innerHeight - e.clientY - y, sx: e.clientX, sy: e.clientY, moved: false };
  });
  // Resize: a little handle on the top corner, shown on hover. Drag up to grow, down to shrink.
  const grip = document.createElement('div');
  grip.id = 'grip';
  grip.title = 'Drag to resize';
  grip.textContent = '⤢';
  pet.appendChild(grip);
  let resize = null;
  let scale = 1;
  function setScale(v) {
    scale = clamp(v, 0.5, 2.5);
    document.documentElement.style.setProperty('--pet-scale', scale);
  }
  grip.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const bottom = pet.getBoundingClientRect().bottom;
    resize = { bottom, startHeight: Math.max(10, bottom - e.clientY), startScale: scale };
  });

  document.addEventListener('mousemove', (e) => {
    if (resize) {
      setScale(resize.startScale * (resize.bottom - e.clientY) / resize.startHeight);
      return;
    }
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
      drag.moved = true;
      pet.classList.add('grabbed');
    }
    if (!drag.moved) return;
    x = e.clientX - drag.ox;
    y = window.innerHeight - e.clientY - drag.oy;
  });
  document.addEventListener('mouseup', () => {
    if (resize) {
      resize = null;
      window.api.updateSettings({ petScale: Math.round(scale * 100) / 100 });
      if (!hovering) setHover(false);
      return;
    }
    if (!drag) return;
    const wasDragged = drag.moved;
    drag = null;
    vy = 0;
    targetX = null;
    pet.classList.remove('grabbed');
    if (!hovering) setHover(false);
    if (wasDragged) {
      if (y > 40) say(char.lines.dropped, 1500);
    } else {
      act('jumping', 1100);
      say(pick(char.lines.pokes));
    }
  });

  window.api.onPetEvent((e) => {
    if (e.type === 'task-done') {
      act('jumping', 1000);
      say(e.allDone ? char.lines.allDone : pick(char.lines.taskDone), 2200);
    }
    if (e.type === 'phase-end') {
      act('jumping', 3300);
      say(e.from === 'focus' ? char.lines.focusDone : char.lines.breakDone, 4000);
    }
  });
  window.api.onState(applyState);
  window.api.getState().then((s) => {
    applyState(s);
    requestAnimationFrame(frame);
  });
})();
