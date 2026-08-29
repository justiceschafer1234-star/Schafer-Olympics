(() => {
  const stopGesture = (event) => event.preventDefault();

  document.addEventListener('gesturestart', stopGesture, { passive: false });
  document.addEventListener('gesturechange', stopGesture, { passive: false });
  document.addEventListener('gestureend', stopGesture, { passive: false });

  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
})();
