const keys = new Set();
let mLeftDown = false;
let mRightDown = false;
let ducking = false;

export function setupInput(onJump) {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  const touchTop = document.createElement('div');
  touchTop.id = 'touch-top';
  const touchBottom = document.createElement('div');
  touchBottom.id = 'touch-bottom';
  document.body.appendChild(touchTop);
  document.body.appendChild(touchBottom);

  function onTopStart(e) {
    if (isTouchOnInteractive(e)) return;
    e.preventDefault();
    onJump();
  }
  function onBottomStart(e) {
    if (isTouchOnInteractive(e)) return;
    e.preventDefault();
    e.stopPropagation();
    ducking = true;
  }
  function isTouchOnInteractive(e) {
    const touch = e.touches && e.touches[0];
    if (!touch) {
      const t = e.target;
      if (t.closest && t.closest('#ui, #menu, #overlay, #panel, .mbtn, button')) return true;
      return false;
    }
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return false;
    if (el.closest && el.closest('#ui, #menu, #overlay, #panel, .mbtn, button')) return true;
    return false;
  }
  function onTouchEnd(e) {
    ducking = false;
  }
  [
    [touchTop, 'touchstart', onTopStart],
    [touchTop, 'touchend', onTouchEnd],
    [touchBottom, 'touchstart', onBottomStart],
    [touchBottom, 'touchend', onTouchEnd],
    [touchBottom, 'touchmove', (e) => e.preventDefault()],
  ].forEach(([el, t, fn]) =>
    el.addEventListener(t, fn, { passive: t === 'touchstart' || t === 'touchmove' ? false : true })
  );

  const mLeft = document.getElementById('m-left');
  const mRight = document.getElementById('m-right');
  const mJump = document.getElementById('m-jump');

  function bindMobile(el, fn) {
    if (!el) return;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(true);
    }, { passive: false });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(false);
    });
    el.addEventListener('touchcancel', () => fn(false));
  }
  bindMobile(mLeft, (v) => { mLeftDown = v; });
  bindMobile(mRight, (v) => { mRightDown = v; });
  bindMobile(mJump, (v) => {
    if (v) {
      onJump();
    }
  });

  return {
    get down() {
      return keys.has('ArrowDown') || keys.has('KeyS') || ducking;
    },
    get left() { return keys.has('ArrowLeft') || keys.has('KeyA') || mLeftDown; },
    get right() { return keys.has('ArrowRight') || keys.has('KeyD') || mRightDown; },
    get jump() {
      return keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW');
    },
    resetDuck() { ducking = false; },
    isPressed(code) {
      return keys.has(code);
    },
  };
}
