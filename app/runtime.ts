/** ZWF builds are player-only, including when opened outside the JUMP host. */
export function isGameRuntime() {
  return (
    (typeof __ZUKU_RUNTIME__ !== 'undefined' && __ZUKU_RUNTIME__) ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('zwf-session'))
  );
}
