// Aki the lop-eared bunny.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.bunny = {
  name: 'Aki',
  emoji: '🐰',
  idleActions: [{ pose: 'periscoping', ms: 2200 }, { pose: 'munching', ms: 2400 }],
  breakActions: [{ pose: 'periscoping', ms: 2200 }],
  lines: {
    focus: 'Focus time. I will loaf right here',
    break: 'Break time! Binky with me',
    paused: ["Paused. Time for a nibble", "Little pause. I will wait here"],
    resumed: ["Hop back to it!", "Okay, ears up"],
    focusDone: 'You did it!! Treat time',
    breakDone: 'Okay! Hop back to it',
    taskDone: ['Binky!', 'One down!', 'Hop hop!', 'Nice one!'],
    allDone: 'All done!! Big binky!',
    dropped: 'thump!',
    pokes: [
      'nose boop!',
      'you are doing great',
      'is that a treat?',
      'wiggle wiggle',
      'I believe in you',
      'pets please',
      'one hop at a time',
      'so proud of you',
    ],
  },
  svg: `
<svg class="char-svg" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="b-shadow" cx="70" cy="144" rx="36" ry="5" fill="rgba(50,35,35,.18)"/>
  <g class="b-all">
    <circle class="b-tail" cx="101" cy="126" r="9" fill="#d9c7ae"/>
    <ellipse class="b-foot b-foot-l" cx="44" cy="138" rx="12" ry="6" fill="#b8a996"/>
    <ellipse class="b-foot b-foot-r" cx="96" cy="138" rx="12" ry="6" fill="#b8a996"/>
    <g class="b-body">
      <ellipse cx="70" cy="110" rx="34" ry="30" fill="#6f6660"/>
      <ellipse cx="70" cy="112" rx="20" ry="22" fill="#a39078"/>
    </g>
    <g class="b-paw b-paw-l"><ellipse cx="60" cy="130" rx="8" ry="11" fill="#8a7d70"/><ellipse cx="60" cy="138" rx="8.500" ry="5" fill="#cbbba6"/></g>
    <g class="b-paw b-paw-r"><ellipse cx="80" cy="130" rx="8" ry="11" fill="#8a7d70"/><ellipse cx="80" cy="138" rx="8.500" ry="5" fill="#cbbba6"/></g>
    <g class="b-head">
      <ellipse cx="70" cy="64" rx="32" ry="28" fill="#6f6660"/>
      <ellipse cx="70" cy="39" rx="19" ry="8.500" fill="#5d5550"/>
      <g class="b-ear b-ear-l">
        <path d="M50 38 C36 40 27 58 27 80 C27 96 38 101 43 91 C47 80 50 60 54 44 Z" fill="#5d5550"/>
        <path d="M45 50 C38 56 34 68 34 80 C34 88 38 90 40 84 C42 74 44 62 47 53 Z" fill="#7a6e66"/>
      </g>
      <g class="b-ear b-ear-r">
        <path d="M90 38 C104 40 113 58 113 80 C113 96 102 101 97 91 C93 80 90 60 86 44 Z" fill="#5d5550"/>
        <path d="M95 50 C102 56 106 68 106 80 C106 88 102 90 100 84 C98 74 96 62 93 53 Z" fill="#7a6e66"/>
      </g>
      <ellipse cx="70" cy="75" rx="14" ry="10" fill="#d9c7ae"/>
      <ellipse cx="70" cy="67" rx="6" ry="7" fill="#b9a083"/>
      <ellipse cx="50" cy="74" rx="5.500" ry="3.300" fill="#ff9aa8" opacity=".5"/>
      <ellipse cx="90" cy="74" rx="5.500" ry="3.300" fill="#ff9aa8" opacity=".5"/>
      <g class="b-eyes">
        <ellipse cx="55" cy="62" rx="5.200" ry="6.200" fill="#cbbba6"/><ellipse cx="55" cy="62" rx="4.200" ry="5.400" fill="#2a1f1c"/><circle cx="56.500" cy="59.800" r="1.600" fill="#fff"/>
        <ellipse cx="85" cy="62" rx="5.200" ry="6.200" fill="#cbbba6"/><ellipse cx="85" cy="62" rx="4.200" ry="5.400" fill="#2a1f1c"/><circle cx="86.500" cy="59.800" r="1.600" fill="#fff"/>
      </g>
      <g class="b-nose">
        <path d="M66.500 71 Q70 69 73.500 71 Q72 75 70 75 Q68 75 66.500 71 Z" fill="#c98a7a"/>
        <path class="b-mouth" d="M70 75 L70 78 M64.500 80.500 Q67.500 82.500 70 78 Q72.500 82.500 75.500 80.500" fill="none" stroke="#4a3c36" stroke-width="1.700" stroke-linecap="round"/>
      </g>
      <path d="M57 75 L38 72 M57 78.500 L38 81 M83 75 L102 72 M83 78.500 L102 81" stroke="#f4efe8" stroke-width="1.100" stroke-linecap="round" opacity=".85"/>
    </g>
    <g class="b-treat">
      <path d="M62 96 q8 -10 16 0 q-8 9 -16 0 Z" fill="#7fae5a"/>
      <path d="M70 92 v8" stroke="#5e8c40" stroke-width="1.400" stroke-linecap="round"/>
    </g>
    <g class="b-zz" fill="#7b7fe8" font-family="Nunito, 'Segoe UI', sans-serif" font-weight="800">
      <text x="106" y="38" font-size="13">z</text>
      <text x="116" y="26" font-size="17">z</text>
    </g>
  </g>
</svg>`,
};
