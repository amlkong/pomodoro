// Pomo's brain. Runs in the full-screen overlay and inside the timer window:
// in both cases the page itself is the room he walks around in.
(() => {
  const pet = document.getElementById('pet');
  const flip = document.getElementById('flip');
  const bubble = document.getElementById('bubble');
  const OVERLAY = location.pathname.endsWith('pet.html');
  flip.innerHTML = window.POMO_SVG;

  const WALK_SPEED = 55; // px per second
  const GRAVITY = 2200;
  const POSES = ['walking', 'dancing', 'sitting', 'slashing', 'bowing', 'jumping', 'held'];
  const POKES = [
    'hehe that tickles',
    'you are doing great',
    'I am proud of you',
    'one round at a time',
    'drink some water, friend',
    'boop!',
    'I believe in you',
    'a calm mind cuts clean',
  ];

  let x = 40;
  let y = 0;            // height above the floor
  let vy = 0;
  let targetX = null;
  let pose = '';
  let mode = 'idle';    // idle, focus, break
  let waitUntil = 0;    // stay put until then
  let actPose = '';     // a short action that plays out before anything else
  let actUntil = 0;
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
    pose = p;
    flip.classList.remove(...POSES);
    if (p) flip.classList.add(p);
  }

  function act(p, ms) {
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
      const corner = maxX() - 8;
      if (Math.abs(x - corner) > 4) targetX = corner;
      else setPose('sitting');
      return;
    }
    if (mode === 'break') {
      if (pose === 'dancing') {
        if (Math.random() < 0.3) act('slashing', 1500);
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
    else if (r < 0.75) act('slashing', 1500);
    else if (r < 0.9) act('bowing', 1700);
    else waitUntil = now + rand(1500, 3500);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (drag) {
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

  function applyState(s) {
    const next = !s.running ? 'idle' : s.phase === 'focus' ? 'focus' : 'break';
    if (next === mode) return;
    mode = next;
    targetX = null;
    waitUntil = 0;
    if (performance.now() < actUntil) return; // mid celebration, let that finish
    setPose('');
    if (mode === 'focus') say('Focus time. I shall meditate');
    if (mode === 'break') say('Break time! Dance with me');
  }

  // In the overlay, clicks only land on Pomo and pass through everywhere else.
  const setHover = (over) => { if (OVERLAY) window.api.petHover(over); };
  pet.addEventListener('mouseenter', () => { hovering = true; setHover(true); });
  pet.addEventListener('mouseleave', () => { hovering = false; if (!drag) setHover(false); });

  // Pick him up, carry him around, drop him. A plain click is a poke.
  pet.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { ox: e.clientX - x, oy: window.innerHeight - e.clientY - y, sx: e.clientX, sy: e.clientY, moved: false };
  });
  document.addEventListener('mousemove', (e) => {
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
    if (!drag) return;
    const wasDragged = drag.moved;
    drag = null;
    vy = 0;
    targetX = null;
    pet.classList.remove('grabbed');
    if (!hovering) setHover(false);
    if (wasDragged) {
      if (y > 40) say('wheee!', 1500);
    } else {
      act('jumping', 1100);
      say(POKES[Math.floor(Math.random() * POKES.length)]);
    }
  });

  window.api.onPetEvent((e) => {
    if (e.type === 'task-done') {
      act('jumping', 1000);
      say(e.allDone ? 'All done!! Amazing' : ['One down!', 'Nice one!', 'Clean cut!', 'Checked off!'][Math.floor(Math.random() * 4)], 2200);
    }
    if (e.type === 'phase-end') {
      act('jumping', 3300);
      say(e.from === 'focus' ? 'You did it!! Break time' : 'Okay! Let\'s go again', 4000);
    }
  });
  window.api.onState(applyState);
  window.api.getState().then((s) => {
    applyState(s);
    requestAnimationFrame(frame);
  });
})();
