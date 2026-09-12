# Game Cloud runtime v1

Every operation is `POST /api/v1/cloud/runtime/{contentId}/{action}` with an authenticated account. In JUMP, use the SDK's `GameCloud.call(action, payload)`: the host verifies iframe source, opaque origin and session nonce, binds the URL to its content, and keeps the token out of the game. Direct networking remains denied by the sandbox CSP.

| Action | Payload | Result |
|---|---|---|
| context | `{}` | projectId, player `{id,name}`, capabilities, scoreTrust |
| scores-list | `{board,offset?}` | entries `{id,name,score,metadata,rank}`, nextOffset |
| scores-submit | `{board,score,metadata?}` | stored personal maximum; server owns player identity |
| save / load | `{slot,data?}` | version / data and version |
| room-create | `{capacity:2..8}` | roomId, hostId, seed |
| room-join | `{roomId}` | room snapshot |
| room-sync | `{roomId,seq,state}` | room snapshot |
| room-start | `{roomId}` | room snapshot with shared startsAt |
| room-leave | `{roomId}` | left |

Room snapshots contain roomId, hostId, seed, startsAt, serverTime and members `{id,name,state,seq,seenAt}`. Use serverTime to avoid dependence on client clocks. seq must increase; rejoining clients resume the server's returned sequence. Host departure closes the room, stale memberships expire after 90 seconds, and rooms expire after two hours. Poll at 500–1000ms. Maximum state 4KB, runtime save 8KB, score metadata 2KB, request 16KB. Boards and slots use 1–64 ASCII alphanumeric or `_-. :` (without spaces).

Scores are client-reported, not anti-cheat verified. Personal maximum upsert and room membership capacity checks are transactional. The legacy Vars API now holds a transaction for first-write locking and updates, with integer overflow rejection. UUID parameters are bound as text before PostgreSQL casts them to UUID.

No developer credentials belong in the game build. Publishing a game does not create an account session. An active project must be linked by the game's actual owner; archived/private/unviewable games are rejected.
