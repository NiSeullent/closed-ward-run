import { GameCloud } from './vendor/game-cloud.js';
/** ZUKU content-scoped Game Cloud runtime, including an opaque iframe bridge. */
export const CLOUD_API = 'https://zuzunza.com/api/v1';
export const DEFAULT_PROJECT = 'cnt_ce447b3687804379845bc5bf77c10a14'; // JUMP content ID, filled during provisioning.
export type Score = {
  id: string;
  name: string;
  distance: number;
  stage: number;
};
export type Peer = {
  lane: number;
  distance: number;
  phase: string;
  updated: number;
};
export type Room = {
  roomId: string;
  hostId: string;
  seed: number;
  startsAt: number | null;
  serverTime: number;
  members: {
    id: string;
    name: string;
    state: Peer;
    seq: number;
    seenAt: number;
  }[];
};
export class Cloud {
  constructor(
    public contentId: string,
    private token = '',
  ) {}
  async call<T>(
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    return new GameCloud({
      contentId: this.contentId,
      getToken: () => this.token,
    }).call(action, payload) as Promise<T>;
  }
  context() {
    return this.call<{
      projectId: string;
      player: { id: string; name: string };
    }>('context');
  }
  async scores(offset = 0) {
    const data = await this.call<{
      entries: {
        id: string;
        name: string;
        score: number;
        metadata: { stage?: number };
      }[];
      nextOffset: number | null;
    }>('scores-list', { board: 'closed-run-v2', offset });
    return {
      rows: data.entries.map((r) => ({
        id: r.id,
        name: r.name,
        distance: r.score,
        stage: r.metadata.stage ?? 1,
      })),
      nextOffset: data.nextOffset,
    };
  }
  submit(score: Score) {
    return this.call('scores-submit', {
      board: 'closed-run-v2',
      score: score.distance,
      metadata: { stage: score.stage },
    });
  }
  save(data: unknown) {
    return this.call('save', { slot: 'closed-run-v2', data });
  }
  load() {
    return this.call<{ data: { best?: number } | null; version: number }>(
      'load',
      { slot: 'closed-run-v2' },
    );
  }
}
export function parsePeer(p: unknown): Peer | null {
  if (!p || typeof p !== 'object') return null;
  const v = p as Peer;
  return Number.isFinite(v.distance) &&
    v.distance >= 0 &&
    v.distance <= 36000 &&
    [-1, 0, 1].includes(v.lane) &&
    typeof v.phase === 'string'
    ? v
    : null;
}
