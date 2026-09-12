/** JUMP expands the trusted host so dialogs and exit controls remain reachable. */
export async function toggleGameFullscreen(
  element: HTMLElement,
): Promise<boolean> {
  const session = new URLSearchParams(location.search).get('zwf-session');
  if (session && parent !== window) {
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const id = crypto.randomUUID();
        const listener = (event: MessageEvent) => {
          const data = event.data;
          if (
            event.source !== parent ||
            data?.channel !== 'zuku-game-view' ||
            data.version !== 1 ||
            data.session !== session ||
            data.id !== id
          )
            return;
          cleanup();
          resolve(Boolean(data.fullscreen));
        };
        const cleanup = () => {
          clearTimeout(timer);
          removeEventListener('message', listener);
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('fullscreen host unavailable'));
        }, 1800);
        addEventListener('message', listener);
        parent.postMessage(
          {
            channel: 'zuku-game-view',
            version: 1,
            session,
            id,
            action: 'fullscreen',
          },
          '*',
        );
      });
    } catch {
      /* Older hosts still allow native iframe fullscreen. */
    }
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return false;
  }
  if (element.requestFullscreen && document.fullscreenEnabled) {
    await element.requestFullscreen();
    return true;
  }
  element.classList.toggle('game-frame--expanded');
  return element.classList.contains('game-frame--expanded');
}
