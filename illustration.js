/* 绘本主题的装饰与动效：
   1) 给卡片注入手绘小插画
   2) 滚动淡入
   3) Hero 插画的轻微视差
   全部为装饰性效果，脚本失败时页面内容照常可读。 */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 手绘小插画（62 × 62，线条统一 2.4px 圆头） ---------- */
  var MOTIFS = {
    book:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#c9717f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10 18c6-3 12-3 18 1v28c-6-4-12-4-18-1z" fill="#fbdbe2"/>' +
      '<path d="M54 18c-6-3-12-3-18 1v28c6-4 12-4 18-1z" fill="#fffaf1"/>' +
      '<path d="M32 19v28"/><path d="M16 26h8M16 32h8"/></svg>',
    compass:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#5f88ad" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="32" cy="32" r="19" fill="#dfeef8"/><path d="M32 15v4M32 45v4M15 32h4M45 32h4"/>' +
      '<path d="M39 25 35 35l-10 4 4-10z" fill="#f3a7b6" stroke="#bf6d80"/></svg>',
    calendar:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#cf9635" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="14" y="18" width="36" height="30" rx="5" fill="#fbe9c8"/>' +
      '<path d="M14 28h36M24 13v8M40 13v8"/><path d="M23 36h6M35 36h6M23 43h6"/></svg>',
    map:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#5f8f70" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 20l12-4 16 5 12-4v27l-12 4-16-5-12 4z" fill="#e2f0e4"/>' +
      '<path d="M24 16v27M40 21v27" stroke="#aed3b7"/>' +
      '<path d="M27 38c4-6 10-4 12-9" stroke="#cf9635" stroke-dasharray="3 4"/></svg>',
    chat:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#bf6d80" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 22c0-3 3-6 6-6h20c3 0 6 3 6 6v10c0 3-3 6-6 6H24l-8 7v-7c-3 0-4-3-4-6z" fill="#fbdbe2"/>' +
      '<path d="M44 34h4c3 0 6 3 6 6v6c0 3-3 6-6 6h-2v5l-6-5" fill="#dfeef8" stroke="#5f88ad"/></svg>',
    bulb:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#cf9635" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M32 14c8 0 14 6 14 14 0 6-4 8-5 12H23c-1-4-5-6-5-12 0-8 6-14 14-14z" fill="#fbe9c8"/>' +
      '<path d="M27 48h10M29 53h6M32 8v3M14 22l3 2M50 22l-3 2"/></svg>',
    sakura:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#bf6d80" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<g fill="#fbdbe2"><circle cx="32" cy="20" r="8"/><circle cx="43" cy="30" r="8"/><circle cx="38" cy="43" r="8"/>' +
      '<circle cx="26" cy="43" r="8"/><circle cx="21" cy="30" r="8"/></g>' +
      '<circle cx="32" cy="32" r="4" fill="#f2b95d" stroke="#cf9635"/></svg>',
    clock:
      '<svg viewBox="0 0 64 64" fill="none" stroke="#5f88ad" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="32" cy="34" r="18" fill="#dfeef8"/><path d="M24 12h16M32 16v-4"/>' +
      '<path d="M32 24v11l7 5"/><circle cx="32" cy="34" r="2" fill="#5f88ad"/></svg>'
  };

  var MOTIF_ORDER = ['book', 'compass', 'calendar', 'map', 'chat', 'bulb', 'sakura', 'clock'];

  function injectMotifs() {
    var cards = document.querySelectorAll('.card, .landing-card');
    for (var i = 0; i < cards.length && i < 24; i++) {
      var card = cards[i];
      if (card.querySelector('.card-motif')) continue;
      var wrap = document.createElement('span');
      wrap.className = 'card-motif';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = MOTIFS[MOTIF_ORDER[i % MOTIF_ORDER.length]];
      card.insertBefore(wrap, card.firstChild);
    }
  }

  /* ---------- 2. 滚动入场动画（只加动画，不隐藏内容） ---------- */
  function initReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(
      '.section, .cards > *, .landing-cards > *, .page-head, .emphasis, .plan-header, .plan-upload, .plan-results'
    ));
    if (prefersReducedMotion || !targets.length) return;

    var pending = targets.filter(function (el) { return !el.classList.contains('illu-in'); });
    var ticking = false;

    function play(el) {
      el.classList.add('illu-in');
    }

    function update() {
      ticking = false;
      var limit = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter(function (el) {
        var box = el.getBoundingClientRect();
        if (box.top < limit * 0.94 && box.bottom > -80) {
          play(el);
          return false;
        }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 3. Hero 插画视差 ---------- */
  function initParallax() {
    var items = document.querySelectorAll('[data-parallax]');
    if (!items.length || prefersReducedMotion) return;
    var ticking = false;

    function update() {
      var y = window.scrollY || window.pageYOffset;
      items.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
        var shift = Math.max(-60, Math.min(60, y * speed));
        el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      });
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function start() {
    injectMotifs();
    initReveal();
    initParallax();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
