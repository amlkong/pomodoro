const pet = document.getElementById('pet');
const flip = document.getElementById('flip');
const bubble = document.getElementById('bubble');
flip.innerHTML = window.POMO_SVG;

const PET_W = 110;
const WALK_SPEED = 55; // px per second
const POKES = [
  'hehe that tickles',
  'you are doing great',
  'proud of you!',
  'one tomato at a time',
  'drink some water?',
  'boop!',
  'I believe in you',
];

let x = 80;
let targetX = null;
let pose = '';        // '', walking, dancing, sitting, jumping
let mode = 'idle';    // idle, focus, break
let waitUntil = 0;    // timestamp: stay put until then
let jumpUntil = 0;
let bubbleTimer = null;
let lastNote = 0;

const maxX = () => window.innerWidth - PET_W - 10;
const rand = (a, b) => a + Math.random() * (b - a);

function setPose(p) {
  if (p === pose) return;
  pose = p;
  flip.classList.remove('walking', 'dancing', 'sitting', 'jumping');
  if (p) flip.classList.add(p);
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
  n.style.left = `${x + rand(20, 80)}px`;
  n.style.color = ['#ff6b5e', '#7b7fe8', '#4fb36a', '#ffb347'][Math.floor(rand(0, 4))];
  n.style.setProperty('--dx', `${rand(-30, 30)}px`);
  n.style.setProperty('--rot', `${rand(-40, 40)}deg`);
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1900);
}

// Decide what to do next once Pomo has arrived somewhere or finished waiting.
function plan(now) {
  if (mode === 'focus') {
    const corner = maxX() - 20;
    if (Math.abs(x - corner) > 4) targetX = corner;
    else setPose('sitting');
    return;
  }
  if (mode === 'break') {
    // dance for a bit, then shuffle somewhere new and dance again
    if (pose === 'dancing') {
      targetX = rand(10, maxX());
    } else {
      setPose('dancing');
      waitUntil = now + rand(5000, 9000);
    }
    return;
  }
  // idle: wander around with little rests
  if (pose === 'walking' || Math.random() < 0.35) {
    setPose('');
    waitUntil = now + rand(2000, 6000);
  } else {
    targetX = rand(10, maxX());
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (now < jumpUntil) {
    setPose('jumping');
  } else if (targetX !== null) {
    const dir = Math.sign(targetX - x);
    const speed = mode === 'break' ? WALK_SPEED * 1.4 : WALK_SPEED;
    x += dir * speed * dt;
    flip.classList.toggle('left', dir < 0);
    setPose('walking');
    if (Math.abs(targetX - x) < 3) {
      targetX = null;
      plan(now);
    }
  } else if (now >= waitUntil) {
    if (pose === 'jumping') setPose('');
    plan(now);
  }

  if (pose === 'dancing' && now - lastNote > 700) {
    lastNote = now;
    spawnNote();
  }

  x = Math.max(0, Math.min(maxX(), x));
  pet.style.transform = `translateX(${x}px)`;
  requestAnimationFrame(frame);
}

function applyState(s) {
  const next = !s.running ? 'idle' : s.phase === 'focus' ? 'focus' : 'break';
  if (next === mode) return;
  mode = next;
  targetX = null;
  waitUntil = 0;
  setPose('');
  if (performance.now() < jumpUntil) return; // celebrating, let that message stay
  if (mode === 'focus') say('Focus time. I\'ll be quiet over here');
  if (mode === 'break') say('Break time! Dance with me');
}

// Let clicks land on Pomo, and pass through everywhere else.
pet.addEventListener('mouseenter', () => window.api.petHover(true));
pet.addEventListener('mouseleave', () => window.api.petHover(false));
pet.addEventListener('click', () => {
  jumpUntil = performance.now() + 1100;
  say(POKES[Math.floor(Math.random() * POKES.length)]);
});

window.api.onPetEvent((e) => {
  if (e.type === 'phase-end') {
    jumpUntil = performance.now() + 3300;
    say(e.from === 'focus' ? 'You did it!! Break time' : 'Okay! Let\'s go again', 4000);
  }
});
window.api.onState(applyState);
window.api.getState().then((s) => {
  x = Math.min(maxX(), 80);
  applyState(s);
  requestAnimationFrame(frame);
});
