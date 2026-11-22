// Kai the little blue martial-arts pup.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.pup = {
  name: 'Kai',
  emoji: '🥋',
  idleActions: [{ pose: 'punching', ms: 1500 }, { pose: 'kicking', ms: 1500 }],
  breakActions: [{ pose: 'kicking', ms: 1500 }, { pose: 'punching', ms: 1500 }],
  lines: {
    focus: 'Focus time. Training the mind!',
    break: 'Break time! Shake it out',
    focusDone: 'You did it!! Great round',
    breakDone: 'Okay! Next round, let\'s go',
    taskDone: ['Hi-yah!', 'One down!', 'Knocked it out!', 'Strong work!'],
    allDone: 'All done!! Champion!',
    dropped: 'whoa!',
    pokes: [
      'hi-yah!',
      'you are getting stronger',
      'one more round, you got this',
      'breathe in... breathe out',
      'I believe in you!',
      'high five!',
      'train hard, rest well',
      'that tickles!',
    ],
  },
  svg: `
<svg class="char-svg" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="k-shadow" cx="70" cy="144" rx="32" ry="5" fill="rgba(50,35,35,.18)"/>
  <g class="k-all">
    <g class="k-tail">
      <path d="M88 124 C104 118 122 122 130 106 C132 124 118 138 90 136 Z" fill="#5fb8f0"/>
      <path d="M120 116 C126 114 129 110 130 106 C131 114 128 122 122 127 Z" fill="#fff"/>
    </g>
    <g class="k-leg k-leg-l"><rect x="50" y="112" width="13" height="26" rx="6.5" fill="#5fb8f0"/><ellipse cx="55" cy="139" rx="10" ry="5.5" fill="#2e4a7a"/></g>
    <g class="k-leg k-leg-r"><rect x="77" y="112" width="13" height="26" rx="6.5" fill="#5fb8f0"/><ellipse cx="85" cy="139" rx="10" ry="5.5" fill="#2e4a7a"/></g>
    <g class="k-body">
      <ellipse cx="70" cy="106" rx="25" ry="25" fill="#5fb8f0"/>
      <ellipse cx="70" cy="110" rx="15" ry="17" fill="#fff"/>
      <rect x="46" y="112" width="48" height="8" rx="3" fill="#2f2a33"/>
      <rect x="58" y="117" width="6" height="14" rx="3" fill="#2f2a33"/>
    </g>
    <g class="k-head">
      <g class="k-ear k-ear-l"><path d="M40 46 L44 14 L64 34 Z" fill="#5fb8f0"/><path d="M43.2 22 L44 14 L50 20 Z" fill="#2e4a7a" stroke="#2e4a7a" stroke-width="3" stroke-linejoin="round"/></g>
      <g class="k-ear k-ear-r"><path d="M100 46 L96 14 L76 34 Z" fill="#5fb8f0"/><path d="M96.8 22 L96 14 L90 20 Z" fill="#2e4a7a" stroke="#2e4a7a" stroke-width="3" stroke-linejoin="round"/></g>
      <ellipse cx="70" cy="58" rx="33" ry="27" fill="#5fb8f0"/>
      <g class="k-band">
        <path class="k-band-tail" d="M101 44 L122 38 L120 46 Z M101 47 L124 54 L118 58 Z" fill="#e0483e"/>
        <path d="M38 47 Q70 35 102 47 L102 39 Q70 27 38 39 Z" fill="#e0483e"/>
        <circle cx="101" cy="45" r="4.5" fill="#c0392b"/>
      </g>
      <ellipse cx="70" cy="70" rx="15" ry="11" fill="#fff"/>
      <ellipse cx="45" cy="68" rx="5.5" ry="3.3" fill="#ff9aa8" opacity=".6"/>
      <ellipse cx="95" cy="68" rx="5.5" ry="3.3" fill="#ff9aa8" opacity=".6"/>
      <g class="k-eyes">
        <ellipse cx="56" cy="59" rx="4.6" ry="6" fill="#2a2226"/><circle cx="57.6" cy="56.8" r="1.7" fill="#fff"/>
        <ellipse cx="84" cy="59" rx="4.6" ry="6" fill="#2a2226"/><circle cx="85.6" cy="56.8" r="1.7" fill="#fff"/>
      </g>
      <ellipse cx="70" cy="65.5" rx="4.2" ry="3" fill="#2a2226"/>
      <path class="k-mouth" d="M64.5 72 Q67.2 75.5 70 71.5 Q72.8 75.5 75.5 72" fill="none" stroke="#2a2226" stroke-width="1.8" stroke-linecap="round"/>
    </g>
    <g class="k-arm k-arm-l"><rect x="40" y="92" width="11" height="24" rx="5.5" fill="#5fb8f0"/><circle cx="45.5" cy="116" r="6.5" fill="#2e4a7a"/></g>
    <g class="k-arm k-arm-r"><rect x="89" y="92" width="11" height="24" rx="5.5" fill="#5fb8f0"/><circle cx="94.5" cy="116" r="6.5" fill="#2e4a7a"/></g>
    <path class="k-pow" d="M118 92 l5 -9 l1 8 l8 -3 l-5 7 l8 3 l-9 2 l2 8 l-7 -5 l-5 7 l0 -9 l-9 0 Z" fill="#ffd84a"/>
  </g>
</svg>`,
};
