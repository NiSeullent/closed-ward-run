import test from 'node:test';import assert from 'node:assert/strict';import {soundtrackForStage} from '../app/soundtrack.ts';
test('phase tracks remain stable between 15/30/50 boundaries',()=>{for(let stage=1;stage<150;stage++)assert.equal(soundtrackForStage(stage),stage>=50?4:stage>=30?3:stage>=15?2:0);});
