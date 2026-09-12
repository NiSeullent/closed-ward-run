export function runAudit(game, probe) {
  const passed = [];
  const assert = (ok, msg) => {
    if (!ok) throw new Error(msg);
  };
  const check = (name, fn) => {
    fn();
    passed.push(name);
  };
  const reset = (patch = {}) => {
    game.start(123);
    probe.arrange({
      distance: 0,
      hits: 0,
      lane: 0,
      elapsed: 0,
      speed: 22,
      ...patch,
    });
  };
  check('All story stages, Panmunjeom and every North Korea scenery render', () => {
    const maps = new Set();
    for(let n=1;n<=400;n++) {
      reset({distance:(n-1)*360+1,lane:-1});probe.step();const v=probe.inspect();
      assert(v.state.stage===n, 'stage '+n);assert(v.state.phase==='running','running '+n);
      assert(v.scenery===v.state.zone && v.sceneryMeshes>0,'scenery '+n);maps.add(v.scenery);
      if(n===49)assert(v.state.zone==='판문점','Panmunjeom');
      if(n>=50 && n<80)assert(['북한 국경도로','북한 산악도로','평양 대로','북한 군수기지','아오지 탄광로'].includes(v.state.zone),'North Korea '+n);
    }
    assert(maps.size>90,'world map variety');
  });
  check('400 is playable; clearing it runs hospital dialogue, credits and optional endless', () => {
    reset({distance:399*360+1,lane:-1});probe.step();
    assert(!game.getState().cleared && game.getState().stage===400,'400 is playable');
    reset({distance:400*360-.1,lane:-1});probe.step();
    assert(game.getState().cleared && game.getState().stage===400,'400 clear');
    assert(game.getState().distance===144000,'bounded story');
    assert(game.getState().ending==='hospital','hospital opening');
    game.continueEndless();assert(game.getState().mode==='story','credits gate');
    probe.step(3.1);assert(game.getState().ending==='discharge','nurse dialogue');
    game.skipEnding();assert(game.getState().ending==='credits','credits reachable');
    game.skipEnding();assert(game.getState().ending==='done','credits skip');
    game.continueEndless();assert(game.getState().mode==='endless' && game.getState().phase==='running','endless resumes');
    probe.arrange({mode:'endless',distance:144000,lane:-1});probe.step();
    assert(game.getState().stage===401 && !game.getState().cleared,'endless beyond 400');
    game.boost();probe.step();assert(game.getState().stage===402,'endless dash');
    game.start();assert(game.getState().mode==='story' && game.getState().stage===1,'story restart');
  });
  check('Both bosses hold progression, telegraph damage, accept aimed attacks and cannot be dash-skipped', () => {
    for(const stage of [55,70]) {
      reset({distance:(stage-1)*360+1,lane:-1,invuln:100});probe.step();
      let boss=game.getState().boss;assert(boss && !boss.defeated,'boss '+stage);
      const distance=game.getState().distance;game.boost();probe.step(.1);
      assert(game.getState().distance===distance,'no boss skip');
      const hp=game.getState().boss.hp;
      game.move(1);probe.step(.9);game.attack();assert(game.getState().boss.hp<hp,'aimed attack');
      let count=0;
      while(!game.getState().boss.defeated && count++<100) {
        const state=game.getState();game.move(state.boss.lane-state.lane);probe.step(.4);game.attack();
      }
      assert(game.getState().boss.defeated,'boss defeat');probe.step(.2);
      assert(game.getState().distance>distance,'progress resumes');
    }
    reset({distance:54*360+1,lane:-1});probe.step();probe.step(1.6);
    let boss=game.getState().boss;assert(boss.warning>0&&boss.attackLanes.length===1,'telegraph');
    game.move(boss.attackLanes[0]-game.getState().lane);probe.step(1.5);
    assert(game.getState().hits===1,'telegraphed attack damage');
  });
  check(
    'Left/right branches select different maps; center crashes and moves left',
    () => {
      reset({ distance: 359.9, lane: -1 });
      probe.step();
      const left = game.getState().zone;
      reset({ distance: 359.9, lane: 1 });
      probe.step();
      assert(
        game.getState().zone !== left && game.getState().route === 'right',
        'right route',
      );
      reset({ distance: 359.9 });
      probe.step();
      assert(
        game.getState().lane === -1 &&
          game.getState().hits === 1 &&
          game.getState().route === 'left',
        'center penalty',
      );
    },
  );
  check(
    'Dash skips one stage, consumes meter, protects from blasts and recharges',
    () => {
      reset();
      game.boost();
      assert(
        game.getState().distance === 360 && game.getState().boost === 0,
        'dash',
      );
      probe.blast(0, 0);
      assert(game.getState().hits === 0, 'dash invulnerability');
      game.boost();
      assert(game.getState().distance === 360, 'cooldown');
      probe.step(1.2);
      assert(game.getState().boost > 0, 'recharge');
    },
  );
  check(
    'Near blast damages once and adds wanted level; outside radius is safe',
    () => {
      reset();
      probe.blast(0, -5);
      probe.blast(0, -5);
      assert(game.getState().hits === 1, 'grace and blast');
      reset();
      probe.blast(0, -6.1);
      assert(game.getState().hits === 0, 'outside radius');
    },
  );
  check(
    'Ordinary, speeding, wrong-way and drunk cars all explode on player impact',
    () => {
      for (const kind of ['car', 'speed', 'wrong', 'drunk']) {
        reset();
        if (kind === 'car') probe.car(0, -2);
        else probe.event(kind, 0, kind === 'speed' ? 1 : -2);
        probe.step();
        const v = probe.inspect();
        assert(v.state.hits === 1, `${kind} damage`);
        assert(v.explosions > 0, `${kind} explosion`);
        if (kind === 'speed') assert(!v.speeder, 'speeder removed');
        if (kind === 'wrong') assert(!v.wrong, 'wrongway removed');
      }
    },
  );
  check(
    'Event cars collide with traffic and create damaging nearby explosions',
    () => {
      for (const kind of ['speed', 'wrong', 'drunk']) {
        reset({ lane: 0 });
        probe.car(3.65, -4);
        probe.event(kind, 3.65, kind === 'speed' ? -1 : -7);
        probe.step(0.08);
        const v = probe.inspect();
        assert(v.explosions > 0, `${kind} car-to-car explosion`);
        assert(v.cars[0].hit, `${kind} traffic destroyed`);
        assert(v.state.hits === 1, `${kind} blast damages adjacent player`);
      }
    },
  );
  check('All six item types are physically collectible', () => {
    for (const item of [
      'destroy',
      'throw',
      'emp',
      'shield',
      'medkit',
      'boost',
    ]) {
      reset();
      probe.pickup(item, 0, -1);
      probe.step();
      assert(game.getState().item === item, item);
    }
  });
  check(
    'Destruction item removes cars and barriers without injuring player',
    () => {
      reset({ item: 'destroy' });
      probe.car(0, -4);
      probe.barrier(3.65, -5);
      game.useItem();
      const v = probe.inspect();
      assert(
        v.cars[0].hit && v.hazards === 0 && v.explosions > 0,
        'destruction',
      );
      assert(v.state.hits === 0 && v.state.item === null, 'self protection');
    },
  );
  check('Thrown bomb travels and detonates on its target', () => {
    reset({ item: 'throw' });
    probe.car(0, -25);
    game.useItem();
    assert(probe.inspect().bombs === 1, 'projectile launched');
    probe.step(0.45);
    const v = probe.inspect();
    assert(
      v.cars[0].hit && v.bombs === 0 && v.explosions > 0,
      'projectile impact',
    );
  });
  check(
    'EMP destroys police with visible effects then permits reinforcements',
    () => {
      reset({ item: 'emp', hits: 2 });
      probe.step();
      assert(probe.inspect().police === 2, 'pursuers');
      game.useItem();
      const v = probe.inspect();
      assert(
        v.police === 0 && v.state.police === 0 && v.colors.includes('#00bcf2'),
        'police destruction',
      );
      assert(v.state.hits === 2, 'EMP does not heal');
      probe.step(10.1);
      assert(probe.inspect().police === 2, 'reinforcements');
    },
  );
  check(
    'Shield absorbs one impact, medkit heals, and boost item refills meter',
    () => {
      reset({ item: 'shield' });
      game.useItem();
      probe.blast(0, 0);
      assert(game.getState().hits === 0 && !probe.inspect().shield, 'shield');
      probe.step(1.5);
      probe.blast(0, 0);
      assert(game.getState().hits === 1, 'one charge');
      reset({ hits: 2, item: 'medkit' });
      game.useItem();
      assert(game.getState().hits === 1, 'medkit');
      reset({ boost: 10, item: 'boost' });
      game.useItem();
      assert(game.getState().boost === 100, 'boost item');
    },
  );
  check('Motor-only roads double actual pursuers', () => {
    reset({ hits: 2 });
    probe.step();
    assert(probe.inspect().police === 2, 'ordinary road');
    reset({ distance: 1081, hits: 2 });
    probe.step();
    assert(
      game.getState().zone === '자동차 전용도로' &&
        probe.inspect().police === 4,
      'motor road',
    );
  });
  check(
    'Highway is faster, flooded roads slower and ice changes steering',
    () => {
      reset({ distance: 721, lane: -1 });
      probe.step(1);
      const highway = game.getState().speed;
      reset({ distance: 2521, lane: -1 });
      probe.step(1);
      assert(game.getState().speed < highway, 'flood speed');
      reset({ distance: 1801 });
      game.move(1);
      probe.step(0.08);
      const ice = probe.inspect().x;
      reset({ distance: 1 });
      game.move(1);
      probe.step(0.08);
      assert(probe.inspect().x > ice, 'ice inertia');
    },
  );
  check('World travel keeps stage 80 and 400 physical running speed comparable', () => {
    reset({ distance: 79*360+1, lane: -1 }); probe.step(.5);
    const china=game.getState().speed;
    reset({ distance: 399*360+1, lane: -1 }); probe.step(.5);
    const somalia=game.getState().speed;
    assert(Math.abs(china-somalia)<4 && Math.max(china,somalia)<40,'stable physical speed');
  });
  check('World event warning is harmless; unsafe active lane takes one readable hit', () => {
    reset({distance:80*360+1,lane:0}); probe.step(2.1);
    let event=game.getState().worldEvent;
    assert(event?.phase==='warning' && event.kinds.includes('lantern'),'lantern warning');
    game.move((event.safeLane===-1?1:-1)-game.getState().lane);
    probe.step(2.1); assert(game.getState().hits===0,'full warning window');
    probe.step(.4); assert(game.getState().hits===1,'active event damage');
    probe.step(1.5); assert(game.getState().hits===1,'one hit per encounter');
  });
  check('Marked safe lane suppresses unrelated cars, barriers and police in Somalia', () => {
    reset({distance:384*360+1,lane:-1,hits:2});probe.step(.8);
    const event=game.getState().worldEvent;
    assert(event?.phase==='warning' && event.kinds.length===3,'three event finale');
    game.move(event.safeLane-game.getState().lane);probe.step(.4);
    const x=event.safeLane*3.65;
    probe.car(x,-1);probe.barrier(x,-1);probe.event('wrong',x,-1);
    probe.step(.04);
    let view=probe.inspect();
    assert(view.state.hits===2,'safe lane protects against ordinary threats');
    assert(view.cars.every(c=>!c.visible) && view.hazards===0 && view.police===0 && !view.wrong,'unrelated threats suppressed');
    probe.step(5.7);assert(game.getState().hits===2,'all three active threats retain safe lane');
  });
  check('An event safe center lane crosses the next stage without a surprise fork penalty', () => {
    reset({distance:384*360+1,lane:0});probe.step(.8);
    const event=game.getState().worldEvent;
    assert(event?.safeLane===0 && event.phase==='warning','center lane promise');
    probe.arrange({distance:385*360-.1,lane:0,hits:0,speed:22});
    probe.step(.04);
    assert(game.getState().stage===386,'crossed stage boundary');
    assert(game.getState().hits===0 && game.getState().lane===-1,'safe automatic left fork');
  });
  check('Gravity event can be jumped while the same grounded lane takes damage', () => {
    for(const jumping of [false,true]) {
      reset({distance:110*360+1,lane:-1});probe.step(2.1);
      const event=game.getState().worldEvent;assert(event?.kinds.includes('gravity'),'gravity profile');
      game.move((event.safeLane===-1?1:-1)-game.getState().lane);
      probe.step(2.05);if(jumping)game.jump();probe.step(.4);
      assert(game.getState().hits===(jumping?0:1),'jump decision '+jumping);
    }
  });
  check('Active portal responds to the real boost action by moving to the safe lane', () => {
    reset({distance:81*360+1,lane:-1});probe.step(2.1);
    const event=game.getState().worldEvent;assert(event?.kinds.includes('portal'),'portal profile');
    game.move((event.safeLane===-1?1:-1)-game.getState().lane);probe.step(2.4);
    assert(game.getState().worldEvent?.phase==='active','portal active');
    game.boost();probe.step(.04);
    assert(game.getState().lane===event.safeLane,'portal teleport');
    assert(game.getState().hits===0 && game.getState().boost<5,'boost protects and consumes meter');
  });
  check('Jump clears a barricade and grounded impact damages', () => {
    reset({ jumpHeight: 1.2 });
    probe.barrier(0, -1);
    probe.step();
    assert(game.getState().hits === 0, 'jump clears');
    reset();
    probe.barrier(0, -1);
    probe.step();
    assert(game.getState().hits === 1, 'ground impact');
  });
  check(
    'Four injuries end the run and rival state drives the visible 3D opponent',
    () => {
      reset({ hits: 3 });
      probe.blast(0, 0);
      assert(game.getState().phase === 'capture', 'capture');
      probe.step(4.3);
      assert(game.getState().phase === 'over', 'end');
      reset();
      game.setRival({ lane: 1, distance: 20 });
      probe.step();
      assert(probe.inspect().ghost, 'near rival');
      game.setRival(null);
      probe.step();
      assert(!probe.inspect().ghost, 'rival disconnect');
    },
  );
  check('Soundtrack changes only at 15, 30 and 50; final boss and endless keep North Korea music',()=>{
    for(const [stage,track] of [[1,0],[14,0],[15,2],[29,2],[30,3],[40,3],[49,3],[50,4],[55,4],[70,4]]) {
      reset({distance:(stage-1)*360+1,lane:-1});probe.step();assert(probe.inspect().trackIndex===track,'music '+stage);
    }
    reset({mode:'endless',distance:36000,lane:-1});probe.step();assert(probe.inspect().trackIndex===4,'endless music');
  });
  return { passed: passed.length, checks: passed };
}
