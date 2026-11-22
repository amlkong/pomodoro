// The happy tabby.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.cat = {
  name: 'Tabby',
  emoji: '🐱',
  idleActions: [{ pose: 'swiping', ms: 1500 }, { pose: 'licking', ms: 2400 }, { pose: 'stretching', ms: 1900 }],
  breakActions: [{ pose: 'swiping', ms: 1500 }],
  lines: {
    focus: 'Focus time. I will nap right here',
    break: 'Break time! Play with me',
    focusDone: 'You did it!! Treat time',
    breakDone: 'Okay human, back to work',
    taskDone: ['Purrfect!', 'One down, meow', 'Good human!', 'Yay, meow!'],
    allDone: 'All done!! Treats now?',
    dropped: 'mrow!',
    pokes: [
      'mrrp?',
      'purrrrr',
      'pet me again!',
      'meow',
      'I was napping...',
      'you are doing great, human',
      'treats after this round?',
      'I love it here with you',
    ],
  },
  svg: `
<svg class="char-svg" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="c-shadow" cx="70" cy="144" rx="38" ry="5" fill="rgba(50,35,35,.18)"/>
  <g class="c-all">
    <g class="c-tail">
      <path d="M98 130 C124 132 134 114 126 96" fill="none" stroke="#8c7a66" stroke-width="12" stroke-linecap="round"/>
      <path d="M98 130 C124 132 134 114 126 96" fill="none" stroke="#2f2723" stroke-width="12" stroke-dasharray="5 9" stroke-dashoffset="-8"/>
      <circle cx="126" cy="96" r="6" fill="#2f2723"/>
    </g>
    <ellipse class="c-hind c-hind-l" cx="41" cy="139" rx="10" ry="5" fill="#7a6a58"/>
    <ellipse class="c-hind c-hind-r" cx="99" cy="139" rx="10" ry="5" fill="#7a6a58"/>
    <g class="c-body">
      <ellipse cx="70" cy="108" rx="37" ry="33" fill="#8c7a66"/>
      <ellipse cx="70" cy="116" rx="22" ry="23" fill="#b3a089"/>
      <path d="M35 98 q8 4 13 0 M33 109 q9 4 14 0 M36 120 q8 4 12 0 M105 98 q-8 4 -13 0 M107 109 q-9 4 -14 0 M104 120 q-8 4 -12 0"
            fill="none" stroke="#2f2723" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M52 92 Q70 101 88 92 M57 100 Q70 106 83 100" fill="none" stroke="#2f2723" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
    </g>
    <g class="c-leg c-leg-l">
      <rect x="53" y="106" width="13" height="32" rx="6.5" fill="#96846f"/>
      <path d="M54.5 116 h10 M54.5 123 h10 M54.5 130 h10" stroke="#2f2723" stroke-width="2" stroke-linecap="round" opacity=".75"/>
      <ellipse cx="59.5" cy="139" rx="9.5" ry="5.5" fill="#ab9981"/>
    </g>
    <g class="c-leg c-leg-r">
      <rect x="74" y="106" width="13" height="32" rx="6.5" fill="#96846f"/>
      <path d="M75.5 116 h10 M75.5 123 h10 M75.5 130 h10" stroke="#2f2723" stroke-width="2" stroke-linecap="round" opacity=".75"/>
      <ellipse cx="80.5" cy="139" rx="9.5" ry="5.5" fill="#ab9981"/>
    </g>
    <g class="c-head">
      <g class="c-ear c-ear-l"><path d="M39 50 L41 24 L63 39 Z" fill="#7a6a58"/><path d="M44.5 45 L45.5 32 L57 40 Z" fill="#cfa9a0"/></g>
      <g class="c-ear c-ear-r"><path d="M101 50 L101 15 L77 39 Z" fill="#2f2723"/><path d="M97 45 L97 28 L84 40 Z" fill="#cfa9a0"/></g>
      <ellipse cx="70" cy="62" rx="35" ry="28" fill="#8c7a66"/>
      <path d="M54 39 Q70 31 86 39 Q70 37 54 39 Z" fill="#2f2723"/>
      <path d="M62 37 L63 49 M70 36 L70 50 M78 37 L77 49" stroke="#2f2723" stroke-width="3" stroke-linecap="round"/>
      <path d="M37 63 l9 2 M36.5 70 l9 0 M103 63 l-9 2 M103.5 70 l-9 0" stroke="#2f2723" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse cx="70" cy="67" rx="6.5" ry="9" fill="#a8906e"/>
      <ellipse cx="70" cy="77" rx="14.5" ry="9" fill="#f4efe8"/>
      <ellipse cx="46" cy="72" rx="6" ry="3.6" fill="#ff9aa8" opacity=".55"/>
      <ellipse cx="94" cy="72" rx="6" ry="3.6" fill="#ff9aa8" opacity=".55"/>
      <g class="c-eyes">
        <ellipse cx="55" cy="61" rx="7.5" ry="6.8" fill="#c8cc52"/><ellipse cx="55.6" cy="61.4" rx="3.3" ry="5.2" fill="#1f1a18"/><circle cx="57.2" cy="59" r="1.5" fill="#fff"/>
        <ellipse cx="85" cy="61" rx="7.5" ry="6.8" fill="#c8cc52"/><ellipse cx="84.4" cy="61.4" rx="3.3" ry="5.2" fill="#1f1a18"/><circle cx="86" cy="59" r="1.5" fill="#fff"/>
      </g>
      <path d="M66.3 70.5 L73.7 70.5 L70 74.5 Z" fill="#c98a7a" stroke="#c98a7a" stroke-width="1.2" stroke-linejoin="round"/>
      <path class="c-mouth" d="M64 78.5 Q67.2 82.5 70 78 Q72.8 82.5 76 78.5" fill="none" stroke="#2f2723" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M59 76 L38 72 M59 79.5 L38 82 M81 76 L102 72 M81 79.5 L102 82" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".95"/>
    </g>
    <g class="c-zz" fill="#7b7fe8" font-family="Nunito, 'Segoe UI', sans-serif" font-weight="800">
      <text x="106" y="34" font-size="13">z</text>
      <text x="116" y="22" font-size="17">z</text>
    </g>
  </g>
</svg>`,
};
