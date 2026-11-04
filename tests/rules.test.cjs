const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rules.js');

test('baralho percorre todos os eventos sem repetição e salva histórico', () => {
  const state = R.newState();
  for (let round = 1; round <= R.EVENTS.length; round++) {
    state.round = round;
    R.drawEvent(state, () => 0.5);
    assert.ok(R.validState(state));
  }
  assert.equal(new Set(state.eventHistory.map((item) => item.id)).size, R.EVENTS.length);
  state.round++;
  R.drawEvent(state, () => 0.5);
  assert.equal(state.eventHistory.length, R.EVENTS.length + 1);
  assert.ok(R.validState(state));
});

test('eventos alteram preços, disponibilidade e qualidade sem ultrapassar o orçamento', () => {
  const player = R.newPlayer(0);
  R.buy(player, 'Pão', 'economical', () => 0, { eventId: 'inflacao' });
  assert.equal(player.purchases[0].cost, 4);
  R.buy(player, 'Carne', 'selected', () => 0, { eventId: 'promocao' });
  assert.equal(player.purchases[1].cost, 4);
  assert.throws(() => R.buy(player, 'Queijo', 'selected', () => 0, { eventId: 'indisponivel' }));
  R.buy(player, 'Queijo', 'economical', () => 0.5, { eventId: 'inspecao', inspect: true });
  assert.equal(player.purchases[2].cost, 4);
  assert.equal(player.purchases[2].quality, 9);
  R.buy(player, 'Molho', 'economical', () => 0, { eventId: 'lote' });
  assert.equal(player.purchases[3].quality, 2);
  const state = R.newState();
  state.players[0] = player;
  assert.ok(R.validState(state));
});

test('defeito afeta o último ingrediente e preserva validação do sorteio', () => {
  const state = R.newState();
  R.buy(state.players[0], 'Pão', 'selected', () => 0);
  state.eventDeck = ['defeito'];
  R.drawEvent(state);
  assert.equal(state.players[0].purchases[0].quality, 6);
  assert.equal(state.players[0].purchases[0].adjustment, -1);
  assert.ok(R.validState(state));
});

test('mesa inicial tem dois participantes e orçamento independente', () => {
  const state = R.newState();
  assert.equal(state.players.length, 2);
  R.buy(state.players[0], 'Pão', 'selected', () => 0);
  assert.equal(R.balance(state.players[0]), 19);
  assert.equal(R.balance(state.players[1]), 24);
  assert.ok(R.validState(state));
});

test('sorteios respeitam mínimos e máximos das duas procedências', () => {
  assert.deepEqual(R.roll('economical', () => 0), { dice: [1, 1], quality: 2 });
  assert.deepEqual(R.roll('economical', () => .99999), { dice: [6, 6], quality: 12 });
  assert.deepEqual(R.roll('selected', () => 0), { dice: [1], quality: 7 });
  assert.deepEqual(R.roll('selected', () => .99999), { dice: [6], quality: 12 });
  assert.throws(() => R.roll('inexistente'));
  assert.throws(() => R.roll('__proto__'));
});

test('distribuições exatas têm as médias divulgadas', () => {
  let economicSum = 0;
  let selectedSum = 0;
  for (let a = 0; a < 6; a++) {
    selectedSum += R.roll('selected', () => (a + .5) / 6).quality;
    for (let b = 0; b < 6; b++) {
      const values = [(a + .5) / 6, (b + .5) / 6];
      economicSum += R.roll('economical', () => values.shift()).quality;
    }
  }
  assert.equal(economicSum / 36, 7);
  assert.equal(selectedSum / 6, 9.5);
});

test('não permite ingrediente duplicado, inexistente ou procedência inválida', () => {
  const player = R.newPlayer(0);
  R.buy(player, 'Pão', 'economical', () => 0);
  assert.throws(() => R.buy(player, 'Pão', 'selected'));
  assert.throws(() => R.buy(player, 'Tomate', 'selected'));
  assert.throws(() => R.buy(player, 'Carne', 'invalida'));
  assert.equal(player.purchases.length, 1);
  assert.equal(R.spent(player), 3);
});

test('todas as receitas são possíveis dentro do orçamento e recebem bônus correto', () => {
  for (const recipe of R.RECIPES) {
    const player = { ...R.newPlayer(0), recipeId: recipe.id };
    recipe.ingredients.forEach((ingredient) => R.buy(player, ingredient, 'economical', () => 0));
    assert.ok(R.complete(player));
    assert.ok(player.finished);
    assert.equal(R.average(player), 2);
    assert.equal(R.score(player), 2 + recipe.bonus);
    assert.ok(R.balance(player) >= 0);
    assert.throws(() => R.buy(player, 'Pão', 'economical'));
  }
});

test('compra acima do saldo é bloqueada sem alterar o jogador', () => {
  const player = { ...R.newPlayer(0), recipeId: 'completo' };
  R.recipe(player).ingredients.slice(0, 4).forEach((ingredient) => R.buy(player, ingredient, 'selected', () => 0));
  assert.equal(R.balance(player), 4);
  assert.throws(() => R.buy(player, 'Alface', 'selected'));
  assert.equal(R.balance(player), 4);
  assert.equal(player.purchases.length, 4);
});

test('Especial pode concluir com quatro selecionadas e uma econômica', () => {
  const player = { ...R.newPlayer(0), recipeId: 'especial' };
  R.recipe(player).ingredients.slice(0, 4).forEach((ingredient) => R.buy(player, ingredient, 'selected', () => 0));
  assert.equal(R.balance(player), 4);
  // Ainda consegue concluir economicamente, mas não comprar outra selecionada.
  assert.throws(() => R.buy(player, 'Alface', 'selected'));
  R.buy(player, 'Alface', 'economical', () => 0);
  assert.ok(R.complete(player));
  assert.equal(R.balance(player), 1);
});

test('saldo abaixo de três encerra automaticamente sem receita completa', () => {
  const player = { ...R.newPlayer(0), recipeId: 'completo' };
  const ingredients = R.recipe(player).ingredients;
  // Três selecionadas e três econômicas completariam a receita com 24 moedas.
  // Quatro selecionadas e uma econômica deixam só uma moeda e faltará tomate.
  ingredients.slice(0, 4).forEach((ingredient) => R.buy(player, ingredient, 'selected', () => 0));
  R.buy(player, ingredients[4], 'economical', () => 0);
  assert.equal(player.finished, true);
  assert.equal(R.balance(player), 1);
  assert.equal(R.complete(player), false);
  assert.equal(R.score(player), null);
  assert.throws(() => R.buy(player, ingredients[5], 'economical'));
});

test('Completo com três selecionadas e três econômicas usa exatamente 24 moedas', () => {
  const player = { ...R.newPlayer(0), recipeId: 'completo' };
  R.recipe(player).ingredients.forEach((ingredient, index) => R.buy(player, ingredient, index < 3 ? 'selected' : 'economical', () => 0));
  assert.equal(R.complete(player), true);
  assert.equal(R.balance(player), 0);
});

test('receita incompleta não recebe pontuação nem bônus', () => {
  const player = R.newPlayer(0);
  R.buy(player, 'Pão', 'selected', () => .999);
  player.finished = true;
  assert.equal(R.score(player), null);
  assert.throws(() => R.buy(player, 'Carne', 'economical'));
});

test('turnos pulam quem encerrou e terminam quando todos encerraram', () => {
  const players = [R.newPlayer(0), R.newPlayer(1), R.newPlayer(2)];
  players[1].finished = true;
  assert.equal(R.nextPlayer(players, 0), 2);
  assert.equal(R.nextPlayer(players, 2), 0);
  players[0].finished = true;
  assert.equal(R.nextPlayer(players, 2), 2);
  players[2].finished = true;
  assert.equal(R.nextPlayer(players, 2), -1);
});

test('ranking não compara qualidade parcial com receita completa e preserva empates', () => {
  const players = [R.newPlayer(0), R.newPlayer(1), R.newPlayer(2)];
  R.buy(players[0], 'Pão', 'selected', () => .999);
  for (const player of players.slice(1)) {
    R.recipe(player).ingredients.forEach((name) => R.buy(player, name, 'economical', () => 0));
  }
  const sorted = R.ranking(players);
  assert.equal(sorted[0].id, 2);
  assert.equal(sorted[1].id, 3);
  assert.equal(sorted[2].id, 1);
  assert.equal(R.score(sorted[0]), R.score(sorted[1]));
});

test('validação aceita progresso e sorteio pendente legítimos', () => {
  const state = R.newState();
  state.phase = 'play';
  R.buy(state.players[0], 'Pão', 'economical', () => 0);
  state.pendingResult = { playerIndex: 0, purchaseIndex: 0 };
  assert.ok(R.validState(JSON.parse(JSON.stringify(state))));
});

test('validação rejeita saves corrompidos', () => {
  const mutate = (callback) => {
    const state = R.newState();
    callback(state);
    assert.equal(R.validState(state), false);
  };
  assert.equal(R.validState(null), false);
  mutate((s) => { s.version = 0; });
  mutate((s) => { s.phase = 'inexistente'; });
  mutate((s) => { s.players[0].recipeId = 'inexistente'; });
  mutate((s) => { s.players[0] = null; });
  mutate((s) => { s.players[0].purchases = [null]; });
  mutate((s) => { s.players[0].estimateLow = 13; });
  mutate((s) => { s.turnIndex = 10; });
  mutate((s) => { s.phase = 'handoff'; s.handoff = { kind: 'play', index: -1 }; });
  mutate((s) => { s.phase = 'results'; });
  mutate((s) => { R.buy(s.players[0], 'Pão', 'economical', () => 0); s.players[0].purchases[0].quality = 99; });
  mutate((s) => { s.phase = 'play'; s.pendingResult = { playerIndex: 0, purchaseIndex: 0 }; });
});

test('partida completa com seis pessoas termina e conserva cada orçamento', () => {
  const players = Array.from({ length: 6 }, (_, index) => ({ ...R.newPlayer(index), recipeId: R.RECIPES[index % 3].id }));
  let current = 0;
  let moves = 0;
  while (current !== -1) {
    const player = players[current];
    const canSelect = R.balance(player) - R.SOURCES.selected.cost >= (R.remaining(player).length - 1) * R.SOURCES.economical.cost;
    R.buy(player, R.remaining(player)[0], canSelect ? 'selected' : 'economical', () => .5);
    current = R.nextPlayer(players, current);
    moves++;
    assert.ok(moves <= 30);
  }
  assert.equal(moves, 30);
  assert.ok(players.every((player) => R.complete(player) && R.balance(player) >= 0));
});
