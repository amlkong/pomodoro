// Pomo the tomato. One SVG shared by the timer window and the desktop pet.
window.POMO_SVG = `
<svg class="pomo-svg" viewBox="0 0 120 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="p-shadow" cx="60" cy="125" rx="30" ry="5" fill="rgba(60,30,30,.18)"/>
  <g class="p-all">
    <g class="p-leg p-leg-l"><rect x="43" y="100" width="9" height="20" rx="4.5" fill="#d9483f"/><ellipse cx="46" cy="121" rx="9" ry="5" fill="#7a3b34"/></g>
    <g class="p-leg p-leg-r"><rect x="68" y="100" width="9" height="20" rx="4.5" fill="#d9483f"/><ellipse cx="74" cy="121" rx="9" ry="5" fill="#7a3b34"/></g>
    <g class="p-body">
      <g class="p-arm p-arm-l"><rect x="6" y="64" width="22" height="9" rx="4.5" fill="#d9483f"/></g>
      <g class="p-arm p-arm-r"><rect x="92" y="64" width="22" height="9" rx="4.5" fill="#d9483f"/></g>
      <ellipse cx="60" cy="68" rx="45" ry="41" fill="#ff6b5e"/>
      <ellipse cx="60" cy="74" rx="45" ry="35" fill="#f4574b" opacity=".45"/>
      <ellipse cx="38" cy="48" rx="13" ry="8" fill="#fff" opacity=".35" transform="rotate(-28 38 48)"/>
      <g class="p-leaf">
        <path d="M60 30 C50 18 38 22 32 28 C42 28 50 34 60 34 C70 34 78 28 88 28 C82 22 70 18 60 30Z" fill="#4fb36a"/>
        <path d="M60 32 C56 20 60 12 64 8 C66 16 66 24 60 32Z" fill="#3d9a57"/>
      </g>
      <ellipse cx="34" cy="80" rx="8" ry="5" fill="#ff9aa8" opacity=".85"/>
      <ellipse cx="86" cy="80" rx="8" ry="5" fill="#ff9aa8" opacity=".85"/>
      <g class="p-eyes">
        <ellipse cx="44" cy="68" rx="5.5" ry="7" fill="#3a2320"/><circle cx="46" cy="65" r="2" fill="#fff"/>
        <ellipse cx="76" cy="68" rx="5.5" ry="7" fill="#3a2320"/><circle cx="78" cy="65" r="2" fill="#fff"/>
      </g>
      <path class="p-mouth" d="M53 80 Q60 88 67 80" fill="none" stroke="#3a2320" stroke-width="3" stroke-linecap="round"/>
      <g class="p-phones">
        <path d="M17 66 C17 18 103 18 103 66" fill="none" stroke="#5b5fc7" stroke-width="6" stroke-linecap="round"/>
        <rect x="8" y="56" width="16" height="26" rx="8" fill="#7b7fe8"/>
        <rect x="96" y="56" width="16" height="26" rx="8" fill="#7b7fe8"/>
      </g>
    </g>
  </g>
</svg>`;
