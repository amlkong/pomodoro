// Mochi the round, squishy two-tone kitty.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.mochi = {
  name: 'Mochi',
  emoji: '🍡',
  idleActions: [{ pose: 'rolling', ms: 1700 }, { pose: 'bouncing', ms: 1500 }],
  breakActions: [{ pose: 'bouncing', ms: 1500 }, { pose: 'rolling', ms: 1700 }],
  lines: {
    focus: 'Focus time. I will be a quiet puddle',
    break: 'Break time! Bounce bounce',
    focusDone: 'You did it!! Yay yay',
    breakDone: 'Okay! Let\'s try our best',
    taskDone: ['Yay!', 'One down!', 'So good!', 'Wow wow!'],
    allDone: 'All done!! The best day',
    dropped: 'boing!',
    pokes: [
      'squish!',
      'hehe',
      'you are doing your best',
      'I am soft and I believe in you',
      'boop boop',
      'snack time soon?',
      'so proud of you',
      'wheee',
    ],
  },
  svg: `
<svg class="char-svg" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="m-shadow" cx="70" cy="144" rx="38" ry="5" fill="rgba(50,35,35,.18)"/>
  <g class="m-all">
    <path class="m-tail" d="M104 118 C120 116 130 104 124 92 C120 90 116 92 117 97 C119 104 112 108 102 108 Z" fill="#8fa3c0" stroke="#3d4658" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse class="m-foot m-foot-l" cx="52" cy="138" rx="10" ry="5.5" fill="#fff" stroke="#3d4658" stroke-width="2.5"/>
    <ellipse class="m-foot m-foot-r" cx="88" cy="138" rx="10" ry="5.5" fill="#fff" stroke="#3d4658" stroke-width="2.5"/>
    <g class="m-blob">
      <path d="M38 50 L40 26 L60 40 Z" fill="#8fa3c0" stroke="#3d4658" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M102 50 L100 26 L80 40 Z" fill="#8fa3c0" stroke="#3d4658" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M70 36 C100 36 116 62 116 92 C116 122 98 138 70 138 C42 138 24 122 24 92 C24 62 40 36 70 36 Z" fill="#fff" stroke="#3d4658" stroke-width="2.5"/>
      <path d="M70 37.3 C60 37.3 51 40.5 43.5 46.5 C34 54 28.5 66 26.5 78 C36 76 46 68 54 58 C60 51 66 45 70 44 C74 45 80 51 86 58 C94 68 104 76 113.500 78 C111.500 66 106 54 96.500 46.500 C89 40.500 80 37.300 70 37.300 Z" fill="#8fa3c0"/>
      <g class="m-arm m-arm-l"><ellipse cx="33" cy="104" rx="7" ry="10" fill="#fff" stroke="#3d4658" stroke-width="2.5" style="transform-box: view-box" transform="rotate(20 33 104)"/></g>
      <g class="m-arm m-arm-r"><ellipse cx="107" cy="104" rx="7" ry="10" fill="#fff" stroke="#3d4658" stroke-width="2.5" style="transform-box: view-box" transform="rotate(-20 107 104)"/></g>
      <ellipse cx="44" cy="96" rx="8" ry="5" fill="#ffb3c0" opacity=".8"/>
      <ellipse cx="96" cy="96" rx="8" ry="5" fill="#ffb3c0" opacity=".8"/>
      <g class="m-eyes">
        <ellipse cx="54" cy="84" rx="5" ry="6.4" fill="#2a2a33"/><circle cx="55.8" cy="81.600" r="1.9" fill="#fff"/>
        <ellipse cx="86" cy="84" rx="5" ry="6.4" fill="#2a2a33"/><circle cx="87.8" cy="81.600" r="1.9" fill="#fff"/>
      </g>
      <path d="M67.500 90 L72.500 90 L70 93 Z" fill="#e79aa6" stroke="#e79aa6" stroke-width="1.2" stroke-linejoin="round"/>
      <path class="m-mouth" d="M64 96 Q67 100 70 95.500 Q73 100 76 96" fill="none" stroke="#3d4658" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g class="m-zz" fill="#7b7fe8" font-family="Nunito, 'Segoe UI', sans-serif" font-weight="800">
      <text x="108" y="44" font-size="13">z</text>
      <text x="118" y="32" font-size="17">z</text>
    </g>
  </g>
</svg>`,
};
