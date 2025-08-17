export function attachTapLongPress(
  el: HTMLElement,
  opts: { onTap: () => void; onLongPress: () => void; longPressMs?: number }
) {
  let timer: any;
  let longPressed = false;
  const longMs = opts.longPressMs ?? 700;

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  el.addEventListener('pointerdown', () => {
    longPressed = false;
    timer = setTimeout(() => {
      longPressed = true;
      opts.onLongPress();
    }, longMs);
  });

  el.addEventListener('pointerup', () => {
    if (!longPressed) {
      opts.onTap();
    }
    cancel();
  });

  el.addEventListener('pointerleave', cancel);
}
