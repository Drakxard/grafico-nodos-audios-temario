export function bindTapAndLongPress(
  element: HTMLElement | SVGElement,
  onTap: () => void,
  onLongPress: () => void,
  longPressMs = 700
) {
  let timer: number | null = null;
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  element.addEventListener('pointerdown', () => {
    timer = window.setTimeout(() => {
      onLongPress();
      timer = null;
    }, longPressMs);
  });
  element.addEventListener('pointerup', () => {
    if (timer) {
      cancel();
      onTap();
    }
  });
  element.addEventListener('pointerleave', cancel);
}
