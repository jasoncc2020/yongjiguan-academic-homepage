(function () {
  'use strict';

  document.querySelectorAll('[data-photo-gallery]').forEach(function (gallery) {
    var viewport = gallery.querySelector('.photo-gallery__viewport');
    var track = gallery.querySelector('.photo-gallery__track');
    var strip = gallery.querySelector('.photo-gallery__strip');
    var images = Array.from(strip.querySelectorAll('img'));
    if (images.length < 2) return;

    var loop = strip.cloneNode(true);
    loop.classList.add('photo-gallery__strip--loop');
    loop.setAttribute('aria-hidden', 'true');
    loop.querySelectorAll('a').forEach(function (link) {
      link.tabIndex = -1;
      link.setAttribute('data-fancybox', 'homepage-gallery-loop');
    });
    loop.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
    track.appendChild(loop);

    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var ready = false;
    var visible = !('IntersectionObserver' in window);
    var hovering = false;
    var dragging = false;
    var dragged = false;
    var focused = false;
    var frame = 0;
    var previousTime = 0;
    var position = 0;
    var cycleWidth = 0;
    var resumeAfter = 0;
    var dragX = 0;
    var dragScroll = 0;
    var speed = 28;

    function measure() {
      cycleWidth = strip.getBoundingClientRect().width;
      position = viewport.scrollLeft;
    }

    function canRun() {
      return ready && visible && !document.hidden && !motion.matches &&
        !hovering && !focused && !dragging && cycleWidth > 0;
    }

    function update() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      position = viewport.scrollLeft;
      if (canRun()) frame = requestAnimationFrame(tick);
    }

    function tick(now) {
      frame = 0;
      if (!canRun()) return;
      var elapsed = previousTime ? Math.min(now - previousTime, 64) : 0;
      previousTime = now;
      if (now < resumeAfter || document.querySelector('.fancybox-container')) {
        position = viewport.scrollLeft;
      } else {
        position = (position + elapsed * speed / 1000) % cycleWidth;
        viewport.scrollLeft = position;
      }
      frame = requestAnimationFrame(tick);
    }

    viewport.addEventListener('pointerenter', function (event) {
      if (event.pointerType === 'mouse') { hovering = true; update(); }
    });
    viewport.addEventListener('pointerleave', function () { hovering = false; update(); });
    viewport.addEventListener('focusin', function () { focused = true; update(); });
    viewport.addEventListener('focusout', function (event) {
      focused = viewport.contains(event.relatedTarget);
      update();
    });
    viewport.addEventListener('wheel', function () { resumeAfter = performance.now() + 2500; }, { passive: true });
    viewport.addEventListener('keydown', function (event) {
      if (event.target !== viewport || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') viewport.scrollLeft = 0;
      else if (event.key === 'End') viewport.scrollLeft = strip.scrollWidth - viewport.clientWidth;
      else viewport.scrollLeft += event.key === 'ArrowRight' ? 220 : -220;
      position = viewport.scrollLeft;
    });
    viewport.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) {
        resumeAfter = performance.now() + 2500;
        return;
      }
      dragging = true;
      dragged = false;
      dragX = event.clientX;
      dragScroll = viewport.scrollLeft;
      update();
    });
    window.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var distance = event.clientX - dragX;
      if (Math.abs(distance) > 5) dragged = true;
      if (dragged) {
        event.preventDefault();
        viewport.scrollLeft = dragScroll - distance;
      }
    }, { passive: false });
    function endDrag() {
      dragging = false;
      resumeAfter = performance.now() + 2500;
      update();
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('dragstart', function (event) { event.preventDefault(); });
    viewport.addEventListener('click', function (event) {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    }, true);
    document.addEventListener('visibilitychange', update);
    if (motion.addEventListener) motion.addEventListener('change', function () { measure(); update(); });
    else motion.addListener(function () { measure(); update(); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        update();
      }, { threshold: 0 }).observe(viewport);
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { measure(); update(); }).observe(strip);
    } else window.addEventListener('resize', function () { measure(); update(); });

    Promise.all(images.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    })).then(function () { ready = true; measure(); update(); });
  });
}());
