// Ash the fluffy grey wolf pup.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.wolf = {
  name: 'Ash',
  emoji: '🐺',
  idleActions: [{ pose: 'howling', ms: 2200 }, { pose: 'pouncing', ms: 1500 }],
  breakActions: [{ pose: 'howling', ms: 2200 }, { pose: 'pouncing', ms: 1500 }],
  lines: {
    focus: 'Focus time. I will curl up right here',
    break: 'Break time! Awoo!',
    paused: ["Paused. I will guard your spot", "Taking a breather? Me too"],
    resumed: ["Back on the trail!", "Awoo, let's go"],
    focusDone: 'You did it!! Awoooo',
    breakDone: 'Okay! Back on the trail',
    taskDone: ['Awoo!', 'One down!', 'Good hunt!', 'Nice one!'],
    allDone: 'All done!! Awooooo!',
    dropped: 'yip!',
    pokes: [
      'awoo?',
      'you are doing great',
      'belly rubs after this round?',
      'wag wag wag',
      'I believe in you',
      'boop!',
      'the pack is proud of you',
      'one paw at a time',
    ],
  },
  svg: `
<svg class="char-svg" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="w-shadow" cx="70" cy="144" rx="36" ry="5" fill="rgba(50,35,35,.18)"/>
  <g class="w-all">
    <g class="w-tail">
      <path d="M92 130 C112 134 132 122 128 98 C127 92 121 90 118 95 C113 104 106 112 92 114 Z" fill="#9aa3b5"/>
      <path d="M128 98 C127 92 121 90 118 95 C116 99 115 102 113 105 C119 108 125 106 128 98 Z" fill="#4b5263"/>
      <path d="M94 128 C104 130 112 127 118 121 C110 122 102 121 94 118 Z" fill="#e9ebf0"/>
    </g>
    <ellipse class="w-foot w-foot-l" cx="45" cy="139" rx="10" ry="5.5" fill="#8790a3"/>
    <ellipse class="w-foot w-foot-r" cx="95" cy="139" rx="10" ry="5.5" fill="#8790a3"/>
    <g class="w-body">
      <ellipse cx="70" cy="110" rx="32" ry="30" fill="#9aa3b5"/>
      <path d="M70 86 C84 88 90 102 88 118 C86 132 78 138 70 138 C62 138 54 132 52 118 C50 102 56 88 70 86 Z" fill="#e9ebf0"/>
      <path d="M61 96 l5 5 l4 -5 l4 5 l5 -5" fill="none" stroke="#b9c0cf" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g class="w-leg w-leg-l"><rect x="54" y="108" width="13" height="30" rx="6.5" fill="#e9ebf0"/><ellipse cx="60.500" cy="139" rx="9.500" ry="5.500" fill="#f4f5f8"/></g>
    <g class="w-leg w-leg-r"><rect x="73" y="108" width="13" height="30" rx="6.5" fill="#e9ebf0"/><ellipse cx="79.500" cy="139" rx="9.500" ry="5.500" fill="#f4f5f8"/></g>
    <g class="w-head">
      <g class="w-ear w-ear-l"><path d="M38 50 L38 20 L62 38 Z" fill="#9aa3b5"/><path d="M38.500 32 L38 20 L48 27.500 Z" fill="#4b5263" stroke="#4b5263" stroke-width="2.5" stroke-linejoin="round"/><path d="M43 45 L43 31 L55 40 Z" fill="#e9ebf0"/></g>
      <g class="w-ear w-ear-r"><path d="M102 50 L102 20 L78 38 Z" fill="#9aa3b5"/><path d="M101.500 32 L102 20 L92 27.500 Z" fill="#4b5263" stroke="#4b5263" stroke-width="2.5" stroke-linejoin="round"/><path d="M97 45 L97 31 L85 40 Z" fill="#e9ebf0"/></g>
      <path d="M34 62 L26 70 L35 70 L30 79 L41 76 Z M106 62 L114 70 L105 70 L110 79 L99 76 Z" fill="#9aa3b5"/>
      <ellipse cx="70" cy="62" rx="35" ry="28" fill="#9aa3b5"/>
      <path d="M70 50 C80 50 96 58 98 70 C99 82 86 90 70 90 C54 90 41 82 42 70 C44 58 60 50 70 50 Z" fill="#e9ebf0"/>
      <path d="M70 34 C76 40 78 48 76 56 L64 56 C62 48 64 40 70 34 Z" fill="#9aa3b5"/>
      <ellipse cx="56" cy="50" rx="4" ry="3" fill="#e9ebf0"/>
      <ellipse cx="84" cy="50" rx="4" ry="3" fill="#e9ebf0"/>
      <ellipse cx="46" cy="72" rx="6.500" ry="4.200" fill="#aeb4c4"/>
      <ellipse cx="94" cy="72" rx="6.500" ry="4.200" fill="#aeb4c4"/>
      <g class="w-eyes">
        <ellipse cx="56" cy="62" rx="4.400" ry="5.800" fill="#2a2d38"/><circle cx="57.500" cy="59.800" r="1.600" fill="#fff"/>
        <ellipse cx="84" cy="62" rx="4.400" ry="5.800" fill="#2a2d38"/><circle cx="85.500" cy="59.800" r="1.600" fill="#fff"/>
      </g>
      <g class="w-snout">
        <ellipse cx="70" cy="70" rx="5.200" ry="3.800" fill="#2a2d38"/>
        <path class="w-mouth" d="M63.500 77 Q67 81 70 76.500 Q73 81 76.500 77" fill="none" stroke="#2a2d38" stroke-width="1.900" stroke-linecap="round"/>
        <path class="w-tongue" d="M67 79 Q70 88 73 79 Z" fill="#f08a9b"/>
      </g>
    </g>
    <g class="w-zz" fill="#7b7fe8" font-family="Nunito, 'Segoe UI', sans-serif" font-weight="800">
      <text x="106" y="36" font-size="13">z</text>
      <text x="116" y="24" font-size="17">z</text>
    </g>
    <g class="w-awoo" fill="none" stroke="#7b7fe8" stroke-width="2.6" stroke-linecap="round">
      <path d="M104 30 q6 -5 12 0"/><path d="M108 20 q9 -8 18 0"/>
    </g>
  </g>
</svg>`,
};
