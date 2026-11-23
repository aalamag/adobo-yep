// Falling snow + a few gold stars on the page background (decorative).
(function () {
  const host = document.querySelector('.petals');
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const flake = (c) => `<svg viewBox="0 0 24 24"><g stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2"/></g></svg>`;
  const star = '<svg viewBox="0 0 24 24"><path d="M12 1.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.7l7.1-.6z" fill="#FBEBC4" stroke="#D9A441" stroke-width="1"/></svg>';
  let html = '';
  for (let i = 0; i < 26; i++) {
    const size = 9 + Math.random() * 13;
    const art = i % 7 === 0 ? star : flake(i % 3 ? '#BFD2E6' : '#7FA3C8');
    html += `<span style="left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${14 + Math.random() * 10}s;animation-delay:${-Math.random() * 20}s;--drift:${-80 + Math.random() * 120}px">${art}</span>`;
  }
  host.innerHTML = html;
})();
