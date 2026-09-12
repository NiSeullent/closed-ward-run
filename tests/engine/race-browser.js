async (page) => {
 const p1=page;
 await p1.setViewportSize({width:1000,height:820});
 await p1.goto('http://127.0.0.1:35174/tests/engine/multiplayer.html?user=1');
 const f=p1.frameLocator('#game');
 await f.getByRole('button',{name:'멀티플레이 열기',exact:true}).click();
 await f.getByRole('button',{name:'2인 방 만들기',exact:true}).waitFor();
 await f.getByRole('button',{name:'2인 방 만들기',exact:true}).click();
 await f.locator('output').waitFor();
 const code=(await f.locator('output').innerText()).replace('초대 코드 ','');
 const p2=await p1.context().newPage();await p2.setViewportSize({width:640,height:820});
 await p2.goto('http://127.0.0.1:35174/tests/engine/multiplayer.html?user=2');
 const g=p2.frameLocator('#game');
 await g.getByRole('button',{name:'멀티플레이 열기',exact:true}).click();
 await g.getByRole('button',{name:'2인 방 만들기',exact:true}).waitFor();
 await g.getByRole('textbox',{name:'초대 코드',exact:true}).fill(code);
 await g.getByRole('button',{name:'참가',exact:true}).click();await g.locator('output').waitFor();
 await f.getByRole('button',{name:'함께 출발',exact:true}).click();
 await f.locator('.stage-panel').waitFor({timeout:20000});await g.locator('.stage-panel').waitFor({timeout:20000});
 await f.locator('.phase-running').waitFor(); await g.locator('.phase-running').waitFor();
 await p1.frames().find(f=>f.url().includes('zwf-session=')).waitForFunction(()=>window.engineProbe.inspect().ghost);
 let fail=true;
 await p1.route('**/api/v1/cloud/runtime/**/scores-submit',route=>fail?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{message:'audit save unavailable'}})}):route.continue());
 for(const [p,distance] of [[p1,640],[p2,480]]){
   const frame=p.frames().find(f=>f.url().includes('zwf-session='));
   await frame.evaluate(distance=>{engineProbe.arrange({phase:'running',distance,hits:3,lane:-1,elapsed:20,speed:22});engineProbe.step(.04);engineProbe.blast(-3.65,0);engineProbe.step(4.3);},distance);
 }
 await f.getByText('레이스 결과 · 승리!',{exact:true}).waitFor({timeout:10000});
 await g.getByText('레이스 결과 · 아쉽게 패배',{exact:true}).waitFor({timeout:10000});
 await f.getByRole('button',{name:'랭킹 열기',exact:true}).click();
 await g.getByRole('button',{name:'랭킹 열기',exact:true}).click();
 await f.getByText(/저장 실패 · 재시도 가능/).waitFor({timeout:10000});
 // The save failure must remain visible through subsequent room polls.
 await p1.waitForTimeout(1200);
 if(!await f.getByText(/저장 실패 · 재시도 가능/).isVisible())throw new Error('Polling erased save failure');
 fail=false;await f.getByRole('button',{name:'기록 저장 / 재시도',exact:true}).click();
 await f.getByText('클라우드 기록 저장 완료',{exact:true}).waitFor({timeout:10000});
 await g.getByRole('button',{name:'랭킹 새로고침',exact:true}).click();
 await f.locator('.ranking-list li').filter({hasText:'player1'}).filter({hasText:'640'}).waitFor();
 await g.locator('.ranking-list li').filter({hasText:'player1'}).filter({hasText:'640'}).waitFor();
 await p1.screenshot({path:'output/playwright/race-result-host.png',timeout:30000});
 await p2.screenshot({path:'output/playwright/race-result-guest.png',timeout:30000});
 await f.getByRole('button',{name:'클라우드 랭킹 닫기',exact:true}).click();
 await g.getByRole('button',{name:'클라우드 랭킹 닫기',exact:true}).click();
 await f.getByRole('button',{name:'멀티플레이 열기',exact:true}).click();
 await g.getByRole('button',{name:'멀티플레이 열기',exact:true}).click();
 await g.getByRole('button',{name:'방 나가기',exact:true}).click();
 await f.getByRole('button',{name:'방 나가기',exact:true}).click();
 await p2.close();
 await p1.evaluate(()=>{window.raceAudit={passed:8,checks:['two authenticated players connect','room create/join and shared countdown','live rival progress','independent victory and defeat','save failure remains visible during room polling','manual save retry','both clients read persisted cloud ranking','leave detaches both players']};});
}
