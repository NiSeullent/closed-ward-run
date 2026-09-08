import test from 'node:test';
import assert from 'node:assert/strict';
import {nextHit,collides,clampLane,AMBULANCE_GAPS} from '../app/rules.ts';
test('four collisions produce the requested survival and slowing sequence',()=>{let hits=0;for(const [speed,phase]of[[22,'running'],[16,'running'],[11,'running'],[0,'capture']]){const result=nextHit(hits,0,'running');assert.ok(result);assert.equal(result.speed,speed);assert.equal(result.phase,phase);assert.equal(result.hits,++hits);}assert.equal(nextHit(4,0,'capture'),null);});
test('invulnerability, pause and capture block duplicate damage',()=>{for(const phase of ['ready','paused','capture','over'])assert.equal(nextHit(1,0,phase),null);assert.equal(nextHit(1,.3,'running'),null);});
test('swept collision catches a fast car but ignores adjacent lanes',()=>{assert.equal(collides(0,0,-4,4),true);assert.equal(collides(0,3.65,-4,4),false);assert.equal(collides(0,0,-12,-4),false);assert.equal(collides(0,0,3,5),false);});
test('lane bounds stay on the road and ambulance closes after slowing',()=>{assert.equal(clampLane(-2),-1);assert.equal(clampLane(2),1);assert.equal(clampLane(0),0);assert.ok(AMBULANCE_GAPS[2]<AMBULANCE_GAPS[1]);assert.ok(AMBULANCE_GAPS[3]<AMBULANCE_GAPS[2]);});
