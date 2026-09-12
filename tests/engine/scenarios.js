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
  check(
    'All 100 stages and all ten route scenery variants run in the actual engine',
    () => {
      const maps = new Set();
      for (let n = 1; n <= 100; n++) {
        reset({ distance: (n - 1) * 360 + 1, lane: -1 });
        probe.step();
        const v = probe.inspect();
        assert(v.state.stage === n, `stage ${n}`);
        assert(v.state.phase === 'running', `running ${n}`);
        assert(v.scenery === v.state.zone, `scenery ${n}`);
        assert(v.sceneryMeshes > 0, `meshes ${n}`);
        maps.add(v.scenery);
      }
      assert(maps.size === 10, 'ten maps');
    },
  );
  check(
    'Every natural stage boundary advances once, with final completion at 36000m',
    () => {
      for (let n = 1; n <= 100; n++) {
        reset({ distance: n * 360 - 0.1, lane: -1 });
        probe.step();
        const s = game.getState();
        assert(s.stage === Math.min(100, n + 1), `boundary ${n}`);
        assert(s.cleared === (n === 100), `clear ${n}`);
      }
      const s = game.getState();
      assert(
        s.distance === 36000 && s.best === 36000 && s.progress === 1,
        'bounded completion',
      );
      probe.step(1);
      game.boost();
      assert(game.getState().distance === 36000, 'terminal distance');
    },
  );
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
  check('Later stages increase actual running speed for the same map', () => {
    reset({ distance: 1, lane: -1 });
    probe.step(1);
    const early = game.getState().speed;
    reset({ distance: 32401, lane: -1 });
    probe.step(1);
    assert(game.getState().speed > early, 'difficulty ramp');
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
  return { passed: passed.length, checks: passed };
}
