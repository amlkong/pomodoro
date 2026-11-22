// Maple the red panda.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.panda = {
  name: 'Maple',
  emoji: '🍁',
  idleActions: [{ pose: 'armsup', ms: 1800 }, { pose: 'wiggling', ms: 1600 }],
  breakActions: [{ pose: 'armsup', ms: 1800 }],
  lines: {
    focus: 'Focus time. I will curl up here',
    break: 'Break time! Wiggle with me',
    focusDone: 'You did it!! Snack break',
    breakDone: 'Okay! Back up the tree we go',
    taskDone: ['Yay!', 'One down!', 'So proud!', 'Nice work!'],
    allDone: 'All done!! You are amazing',
    dropped: 'eep!',
    pokes: [
      'hi hi hi!',
      'you are doing so well',
      'rawr! (I am very scary)',
      'bamboo snack later?',
      'I believe in you',
      'boop!',
      'look at my tail',
      'one step at a time',
    ],
  },
  svg: `
<svg class="char-svg" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="r-shadow" cx="70" cy="144" rx="36" ry="5" fill="rgba(50,35,35,.18)"/>
  <g class="r-all">
    <g class="r-tail">
      <path d="M92 128 C120 132 136 112 122 88" fill="none" stroke="#e8873a" stroke-width="22" stroke-linecap="round"/>
      <path d="M92 128 C120 132 136 112 122 88" fill="none" stroke="#a9552a" stroke-width="22" stroke-dasharray="7 10" stroke-dashoffset="-12"/>
      <circle cx="122" cy="88" r="11" fill="#a9552a"/>
    </g>
    <ellipse class="r-foot r-foot-l" cx="56" cy="139" rx="10" ry="5.5" fill="#4a2e25"/>
    <ellipse class="r-foot r-foot-r" cx="84" cy="139" rx="10" ry="5.5" fill="#4a2e25"/>
    <g class="r-body">
      <ellipse cx="70" cy="110" rx="30" ry="30" fill="#e8873a"/>
      <ellipse cx="70" cy="118" rx="19" ry="20" fill="#4a2e25"/>
    </g>
    <g class="r-head">
      <path class="r-ear" d="M37 52 L33 25 L60 37 Z" fill="#f6e6cf" stroke="#4a2e25" stroke-width="4" stroke-linejoin="round"/>
      <path class="r-ear" d="M103 52 L107 25 L80 37 Z" fill="#f6e6cf" stroke="#4a2e25" stroke-width="4" stroke-linejoin="round"/>
      <ellipse cx="70" cy="62" rx="37" ry="28" fill="#e8873a"/>
      <ellipse cx="43" cy="71" rx="11" ry="9" fill="#f6e6cf"/>
      <ellipse cx="97" cy="71" rx="11" ry="9" fill="#f6e6cf"/>
      <path d="M53 66 Q47 74 48 84 M87 66 Q93 74 92 84" fill="none" stroke="#b8602c" stroke-width="4.5" stroke-linecap="round"/>
      <ellipse cx="55" cy="50" rx="5" ry="6.5" fill="#f6e6cf" style="transform-box: view-box" transform="rotate(-18 55 50)"/>
      <ellipse cx="85" cy="50" rx="5" ry="6.5" fill="#f6e6cf" style="transform-box: view-box" transform="rotate(18 85 50)"/>
      <ellipse cx="70" cy="75" rx="14" ry="10" fill="#f6e6cf"/>
      <ellipse cx="45" cy="76" rx="5" ry="3" fill="#ff9aa8" opacity=".6"/>
      <ellipse cx="95" cy="76" rx="5" ry="3" fill="#ff9aa8" opacity=".6"/>
      <g class="r-eyes">
        <ellipse cx="56" cy="63" rx="4.2" ry="5" fill="#2a1d18"/><circle cx="57.4" cy="61" r="1.5" fill="#fff"/>
        <ellipse cx="84" cy="63" rx="4.2" ry="5" fill="#2a1d18"/><circle cx="85.4" cy="61" r="1.5" fill="#fff"/>
      </g>
      <path d="M65.5 69 Q70 67 74.5 69 Q73 74 70 74 Q67 74 65.5 69Z" fill="#2a1d18"/>
      <path class="r-mouth" d="M64.5 78 Q67.2 81.5 70 77.5 Q72.8 81.5 75.5 78" fill="none" stroke="#2a1d18" stroke-width="1.8" stroke-linecap="round"/>
    </g>
    <g class="r-arm r-arm-l"><ellipse cx="49" cy="106" rx="7.5" ry="15" fill="#4a2e25"/></g>
    <g class="r-arm r-arm-r"><ellipse cx="91" cy="106" rx="7.5" ry="15" fill="#4a2e25"/></g>
    <g class="r-zz" fill="#7b7fe8" font-family="Nunito, 'Segoe UI', sans-serif" font-weight="800">
      <text x="106" y="36" font-size="13">z</text>
      <text x="116" y="24" font-size="17">z</text>
    </g>
  </g>
</svg>`,
};
