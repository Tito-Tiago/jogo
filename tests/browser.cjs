// Opcional: requer Playwright e um Chromium instalado. Não é dependência do jogo.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function run() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
    await context.addInitScript(() => { Math.random = () => .5; });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    const tap = (selector) => page.locator(selector).tap();
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('na-conta-do-hamburguer-v1')));
    const screenshot = async (name) => {
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${name}.png`), fullPage: true });
    };
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'A página não deve transbordar horizontalmente.');

    await page.goto(url);
    await screenshot('setup-desktop');
    await tap('[data-action="add-player"]');
    await page.locator('#name-0').fill('Ana');
    await page.locator('#name-1').fill('Ana');
    await page.locator('#name-2').fill('Carla');
    await tap('#setup-form button[type="submit"]');
    assert.match(await page.locator('#form-error').innerText(), /nomes diferentes/);
    await page.locator('#name-1').fill('Bruno');
    await tap('#setup-form button[type="submit"]');
    await tap('[data-recipe="completo"]');
    await tap('[data-stepper="estimateCost"][data-direction="1"]');
    assert.equal((await state()).players[0].estimateCost, 17);

    await tap('.navigation [data-tab="help"]');
    for (let step = 0; step < 4; step++) await tap('[data-action="tutorial-next"]');
    await tap('.tutorial-controls [data-tab="game"]');
    assert.equal(await page.locator('#estimateCost').inputValue(), '17');
    await tap('#planning-form button[type="submit"]');
    await tap('[data-action="accept-turn"]');
    await tap('#planning-form button[type="submit"]');
    await tap('[data-action="accept-turn"]');
    await tap('[data-recipe="especial"]');
    await tap('#planning-form button[type="submit"]');
    await tap('[data-action="accept-turn"]');
    await screenshot('play-desktop');
    await noOverflow();

    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await screenshot('play-touch');
    // Todos os botões visíveis têm alvos de pelo menos 48 × 48 pixels.
    const smallButtons = await page.locator('button:visible').evaluateAll((buttons) => buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width < 48 || rect.height < 48;
    }).map((button) => button.textContent));
    assert.deepEqual(smallButtons, []);

    await tap('[data-buy="0"][data-source="economical"]');
    await tap('[data-action="cancel-dialog"]');
    assert.equal((await state()).players[0].purchases.length, 0);
    await tap('[data-buy="0"][data-source="economical"]');
    // O segundo evento não pode realizar uma segunda compra.
    await page.locator('[data-action="confirm-dialog"]').evaluate((button) => { button.click(); button.click(); });
    const before = await state();
    assert.equal(before.players[0].purchases.length, 1);
    assert.equal(before.players[0].purchases[0].cost, 3);
    await screenshot('purchase-touch');
    await context.setOffline(true);
    await page.reload();
    assert.ok(await page.locator('#action-dialog').isVisible());
    assert.deepEqual((await state()).players[0].purchases, before.players[0].purchases);
    await tap('[data-action="continue-result"]');
    await tap('[data-action="accept-turn"]');
    assert.equal((await state()).turnIndex, 1);
    await tap('[data-action="finish-player"]');
    await tap('[data-action="confirm-dialog"]');
    assert.equal((await state()).handoff.index, 2);

    let purchases = 1;
    while ((await state()).phase !== 'results') {
      const current = await state();
      if (current.phase === 'handoff') { await tap('[data-action="accept-turn"]'); continue; }
      if (current.pendingResult) { await tap('[data-action="continue-result"]'); continue; }
      await page.locator('[data-buy][data-source="economical"]:not(:disabled)').first().tap();
      await tap('[data-action="confirm-dialog"]');
      purchases++;
      assert.ok(purchases <= 11);
    }
    assert.equal(purchases, 11);
    assert.ok((await state()).players.every((player) => player.finished));
    assert.match(await page.locator('main').innerText(), /Ana venceu/);
    assert.match(await page.locator('main').innerText(), /8,5/);
    await noOverflow();
    await screenshot('results-touch');
    await tap('.navigation [data-tab="concepts"]');
    await noOverflow();
    await tap('.navigation [data-tab="game"]');
    assert.equal((await state()).phase, 'results');
    await tap('[data-action="rematch"]');
    assert.deepEqual((await state()).players.map((player) => player.name), ['Ana', 'Bruno', 'Carla']);
    assert.ok((await state()).players.every((player) => player.purchases.length === 0));
    for (const width of [320, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow();
      await tap('.navigation [data-tab="help"]');
      await noOverflow();
      await tap('.navigation [data-tab="game"]');
    }

    // Outra partida: seis pessoas gastam demais e nenhuma conclui a receita.
    await page.evaluate(() => {
      const next = BurgerRules.newState();
      next.players = Array.from({ length: 6 }, (_, index) => ({ ...BurgerRules.newPlayer(index), recipeId: 'completo' }));
      next.phase = 'play';
      localStorage.setItem('na-conta-do-hamburguer-v1', JSON.stringify(next));
    });
    await page.reload();
    purchases = 0;
    while ((await state()).phase !== 'results') {
      const current = await state();
      if (current.phase === 'handoff') { await tap('[data-action="accept-turn"]'); continue; }
      if (current.pendingResult) { await tap('[data-action="continue-result"]'); continue; }
      const source = current.players[current.turnIndex].purchases.length < 4 ? 'selected' : 'economical';
      await page.locator(`[data-buy][data-source="${source}"]:not(:disabled)`).first().tap();
      if (current.players[current.turnIndex].purchases.length === 3) assert.match(await page.locator('#dialog-content').innerText(), /faltarão moedas/);
      await tap('[data-action="confirm-dialog"]');
      purchases++;
      assert.ok(purchases <= 30);
      assert.ok(await page.evaluate(() => BurgerRules.validState(JSON.parse(localStorage.getItem('na-conta-do-hamburguer-v1')))));
    }
    assert.equal(purchases, 30);
    assert.match(await page.locator('main').innerText(), /Ninguém concluiu/);
    assert.ok((await state()).players.every((player) => player.finished && player.purchases.length === 5));
    assert.deepEqual(errors, []);
    console.log('PASS: partida multijogador por toque, tutorial, orçamento, cancelamento, dupla confirmação, recarga offline, turnos, resultados e layout responsivo.');
  } finally {
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
