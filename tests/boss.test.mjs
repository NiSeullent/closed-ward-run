import test from 'node:test';import assert from 'node:assert/strict';
import {bossAt,bossPattern,createBossState} from '../app/boss.ts';
test('55 commander and 70 leader have different health and avoidable attack patterns',()=>{assert.equal(bossAt(55),'commander');assert.equal(bossAt(70),'leader');assert.equal(bossAt(54),null);assert.ok(createBossState('leader').hp>createBossState('commander').hp);for(let i=0;i<20;i++){assert.equal(bossPattern('commander',i).length,1);assert.equal(bossPattern('leader',i).length,2);assert.equal(new Set(bossPattern('leader',i)).size,2);}});
