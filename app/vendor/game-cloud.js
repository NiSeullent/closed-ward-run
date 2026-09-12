/** Content-scoped ZUKU Cloud client. The JUMP host keeps the account credential. */
export class GameCloud {
  /** @param {{contentId?:string,getToken?:()=>string,apiBase?:string}} options */
  constructor({ contentId = '', getToken = () => '', apiBase = 'https://zuzunza.com/api/v1' } = {}) {
    this.contentId = contentId;
    this.getToken = getToken;
    this.apiBase = apiBase;
    this.playerId = null;
  }
  /** @param {string} action @param {Record<string, unknown>} payload */
  async call(action, payload = {}) {
    const actions = ['context','consent-revoke','scores-list','scores-submit','save','load','room-create','room-join','room-sync','room-leave','room-start'];
    if (!actions.includes(action)) throw new Error('Unsupported Game Cloud action');
    const session = new URLSearchParams(location.search).get('zwf-session');
    if (session && window.parent !== window) {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const cleanup = () => { clearTimeout(timer); removeEventListener('message', listener); };
        const listener = (event) => {
          const d = event.data;
          if (event.source !== parent || d?.channel !== 'zuku-game-cloud' || d.version !== 1 || d.session !== session || d.id !== id) return;
          cleanup();
          if (d.success) { if (action === 'context') this.playerId = d.data.player.id; resolve(d.data); }
          else reject(Object.assign(new Error(d.error?.message || 'Cloud request failed'), {code: d.error?.code || 'CLOUD_ERROR'}));
        };
        // First consent is a human interaction, not an ordinary API timeout.
        const timer = setTimeout(() => { cleanup(); reject(Object.assign(new Error('Cloud connection timed out'), {code:'TIMEOUT'})); }, action === 'context' ? 305000 : 15000);
        addEventListener('message', listener);
        parent.postMessage({ channel:'zuku-game-cloud', version:1, session, id, action, payload }, '*');
      });
    }
    const token = this.getToken();
    const response = await fetch(`${this.apiBase}/cloud/runtime/${encodeURIComponent(this.contentId)}/${action}`, {
      method:'POST', credentials:'omit', headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})},
      body:JSON.stringify({...payload,...(action !== 'context' && this.playerId ? {expectedPlayerId:this.playerId} : {})}), signal:AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw Object.assign(new Error(result.error?.message || `Cloud HTTP ${response.status}`), {code:result.error?.code || 'CLOUD_ERROR'});
    if (action === 'context') this.playerId = result.data.player.id;
    return result.data;
  }
  /** Automatically reuses site login after the game's first site-owned consent. */
  connect({interactive = true} = {}) { return this.call('context', {interactive}); }
  disconnect() { return this.call('consent-revoke'); }
}

/** Clear account-specific UI, then reconnect silently when the host account changes. */
export function watchGameCloudAuth(listener) {
  const session = new URLSearchParams(location.search).get('zwf-session');
  const changed = event => {
    const d = event.data;
    if (session && parent !== window && event.source === parent && d?.channel === 'zuku-game-cloud-auth' && d.version === 1 && d.session === session) listener();
  };
  addEventListener('message', changed);
  return () => removeEventListener('message', changed);
}
