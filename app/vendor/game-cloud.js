/** Content-scoped ZUKU Cloud client. The JUMP host keeps the account credential. */
export class GameCloud {
  /** @param {{contentId?:string,getToken?:()=>string,apiBase?:string}} options */
  constructor({ contentId = '', getToken = () => '', apiBase = 'https://zuzunza.com/api/v1' } = {}) {
    this.contentId = contentId;
    this.getToken = getToken;
    this.apiBase = apiBase;
  }
  /** @param {string} action @param {Record<string, unknown>} payload */
  async call(action, payload = {}) {
    const actions = ['context','scores-list','scores-submit','save','load','room-create','room-join','room-sync','room-leave','room-start'];
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
          if (d.success) resolve(d.data); else reject(new Error(d.error?.message || 'Cloud request failed'));
        };
        const timer = setTimeout(() => { cleanup(); reject(new Error('Cloud connection timed out')); }, 12000);
        addEventListener('message', listener);
        parent.postMessage({ channel:'zuku-game-cloud', version:1, session, id, action, payload }, '*');
      });
    }
    const token = this.getToken();
    const response = await fetch(`${this.apiBase}/cloud/runtime/${encodeURIComponent(this.contentId)}/${action}`, {
      method:'POST', credentials:'omit', headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})},
      body:JSON.stringify(payload), signal:AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error?.message || `Cloud HTTP ${response.status}`);
    return result.data;
  }
}
