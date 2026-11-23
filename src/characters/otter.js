// Pomo the samurai otter.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.otter = {
  name: 'Pomo',
  emoji: '🦦',
  // little things he does on his own: a pose (see otter.css) and how long it lasts
  idleActions: [{ pose: 'slashing', ms: 1500 }, { pose: 'bowing', ms: 1700 }],
  breakActions: [{ pose: 'slashing', ms: 1500 }],
  lines: {
    focus: 'Focus time. I shall meditate',
    break: 'Break time! Dance with me',
    paused: ["Paused. I will keep watch", "A little pause. Breathe in, breathe out"],
    resumed: ["Back to it!", "Onward, friend"],
    focusDone: 'You did it!! Break time',
    breakDone: 'Okay! Let\'s go again',
    taskDone: ['One down!', 'Nice one!', 'Clean cut!', 'Checked off!'],
    allDone: 'All done!! Amazing',
    dropped: 'wheee!',
    pokes: [
      'hehe that tickles',
      'you are doing great',
      'I am proud of you',
      'one round at a time',
      'drink some water, friend',
      'boop!',
      'I believe in you',
      'a calm mind cuts clean',
    ],
  },
  svg: `
<svg class="char-svg" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="o-shadow" cx="70" cy="144" rx="34" ry="5" fill="rgba(50,35,35,.18)"/>
  <g class="o-all">
    <path class="o-tail" d="M84 121 C104 116 124 126 136 139 C120 142 100 141 84 136 Z" fill="#8d7d75"/>
    <ellipse class="o-foot o-foot-l" cx="57" cy="140" rx="9" ry="4.5" fill="#7d6d66"/>
    <ellipse class="o-foot o-foot-r" cx="83" cy="140" rx="9" ry="4.5" fill="#7d6d66"/>
    <g class="o-body">
      <path d="M49 80 C44 100 40 122 42 138 L98 138 C100 122 96 100 91 80 Z" fill="#d3d4e0"/>
      <path d="M42 126 C42 131 42 135 42 138 L98 138 C98 135 98 131 98 126 Z" fill="#bfc0d0"/>
      <path d="M57 82 L77 107 M84 82 L67 101" fill="none" stroke="#3a3540" stroke-width="5" stroke-linecap="round"/>
      <g style="transform-box: view-box" transform="rotate(24 70 112)">
        <rect x="56" y="103.5" width="50" height="5" rx="2.5" fill="#3a3540"/>
        <rect x="46" y="103" width="11" height="6" rx="2" fill="#d8b98a"/>
        <rect x="54" y="110" width="60" height="5.5" rx="2.7" fill="#2f2a33"/>
        <rect x="41" y="109.5" width="13" height="6.5" rx="2" fill="#d8b98a"/>
        <rect x="53" y="108" width="3" height="9.5" rx="1" fill="#c9a24a"/>
      </g>
      <rect x="42" y="108" width="56" height="10" rx="3" fill="#3b5fa8"/>
      <rect x="47" y="115" width="7" height="15" rx="3" fill="#32539a"/>
      <g class="o-arm o-arm-l"><ellipse cx="46" cy="99" rx="8" ry="11" fill="#c4c5d4"/><circle cx="45" cy="109" r="4.8" fill="#9b8b82"/></g>
      <g class="o-arm o-arm-r"><ellipse cx="94" cy="99" rx="8" ry="11" fill="#c4c5d4"/><circle cx="95" cy="109" r="4.8" fill="#9b8b82"/></g>
      <g class="o-blade">
        <rect x="93.4" y="62" width="3.2" height="44" rx="1.6" fill="#eef3f8" stroke="#9aa6b5" stroke-width=".8"/>
        <rect x="90" y="104" width="10" height="2.6" rx="1" fill="#c9a24a"/>
        <rect x="92.5" y="106" width="5" height="12" rx="2" fill="#2f2a33"/>
        <circle cx="95" cy="110" r="4.8" fill="#9b8b82"/>
      </g>
      <path class="o-swoosh" d="M96 58 A52 52 0 0 1 138 112" fill="none" stroke="#ffe9a8" stroke-width="5" stroke-linecap="round"/>
      <g class="o-head">
        <circle cx="40" cy="57" r="7.5" fill="#8d7d75"/><circle cx="40" cy="57" r="3.6" fill="#6f605a"/>
        <circle cx="100" cy="57" r="7.5" fill="#8d7d75"/><circle cx="100" cy="57" r="3.6" fill="#6f605a"/>
        <ellipse cx="70" cy="64" rx="32" ry="24" fill="#9b8b82"/>
        <ellipse cx="70" cy="73" rx="21" ry="14" fill="#f5eee6"/>
        <ellipse cx="47" cy="73" rx="6" ry="3.6" fill="#ff9aa8" opacity=".6"/>
        <ellipse cx="93" cy="73" rx="6" ry="3.6" fill="#ff9aa8" opacity=".6"/>
        <path d="M51 71 L33 68 M51 75 L33 77 M89 71 L107 68 M89 75 L107 77" stroke="#5a4d48" stroke-width="1.2" stroke-linecap="round"/>
        <g class="o-eyes">
          <ellipse cx="55" cy="62" rx="4.6" ry="6.2" fill="#2a2226"/><circle cx="56.6" cy="59.6" r="1.7" fill="#fff"/>
          <ellipse cx="85" cy="62" rx="4.6" ry="6.2" fill="#2a2226"/><circle cx="86.6" cy="59.6" r="1.7" fill="#fff"/>
        </g>
        <path d="M65 66.5 Q70 64.5 75 66.5 Q73 72 70 72 Q67 72 65 66.5Z" fill="#2a2226"/>
        <path class="o-mouth" d="M65 77 Q67.5 80 70 76 Q72.5 80 75 77" fill="none" stroke="#2a2226" stroke-width="1.8" stroke-linecap="round"/>
        <g class="o-hat">
          <path d="M106 46 L109 67 M110 46 L115 62" stroke="#c0392b" stroke-width="3" stroke-linecap="round"/>
          <path d="M20 47 Q70 0 120 47 Q70 59 20 47 Z" fill="#dcbd84"/>
          <path d="M20 47 Q70 59 120 47 Q70 52 20 47 Z" fill="#b8935a"/>
          <path d="M43 30 Q70 37 97 30 M31 40 Q70 49 109 40" fill="none" stroke="#a8844e" stroke-width="2.4" stroke-linecap="round"/>
          <ellipse cx="70" cy="22" rx="6" ry="3" fill="#a8844e"/>
        </g>
      </g>
    </g>
  </g>
</svg>`,
};
