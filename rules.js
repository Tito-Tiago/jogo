(function (root) {
  'use strict';
  const BUDGET = 24;
  const RECIPES = [
    { id: 'classico', name: 'Clássico', description: 'O essencial, bem feito.', ingredients: ['Pão', 'Carne', 'Queijo', 'Molho'], bonus: 0 },
    { id: 'especial', name: 'Especial', description: 'Um pouco mais de desafio.', ingredients: ['Pão', 'Carne', 'Queijo', 'Molho', 'Alface'], bonus: .5 },
    { id: 'completo', name: 'Completo', description: 'Mais camadas, mais planejamento.', ingredients: ['Pão', 'Carne', 'Queijo', 'Molho', 'Alface', 'Tomate'], bonus: 1 }
  ];
  const SOURCES = {
    economical: { name: 'Econômica', cost: 3, min: 2, max: 12, mean: 7 },
    selected: { name: 'Selecionada', cost: 5, min: 7, max: 12, mean: 9.5 }
  };
  const EVENTS = [
    { id: 'inflacao', name: 'Inflação no mercado', effect: 'Compras econômicas custam 1 moeda a mais nesta rodada.', concept: 'Mudanças de preços podem afastar o custo real da estimativa.' },
    { id: 'promocao', name: 'Promoção do fornecedor', effect: 'Cada compra desta rodada custa 1 moeda a menos.', concept: 'Condições favoráveis podem reduzir o gasto em relação ao previsto.' },
    { id: 'indisponivel', name: 'Fornecedor indisponível', effect: 'A procedência selecionada está indisponível nesta rodada.', concept: 'Dependências e restrições podem exigir mudanças no planejamento.' },
    { id: 'defeito', name: 'Ingrediente defeituoso', effect: 'O último ingrediente comprado de cada jogador perde 1 ponto de qualidade, até o mínimo de 2.', concept: 'Falhas descobertas depois da entrega podem afetar a qualidade.' },
    { id: 'escopo', name: 'Mudança de escopo', effect: 'Antes de comprar, você pode optar pela próxima receita maior.', concept: 'Novos requisitos podem agregar valor, mas exigem mais recursos.' },
    { id: 'otimista', name: 'Estimativa otimista', effect: 'Antes de comprar, você pode escolher rolar os dados duas vezes e aceitar o segundo resultado.', concept: 'Buscar um resultado melhor também pode trazer um novo risco.' },
    { id: 'inspecao', name: 'Inspeção de qualidade', effect: 'Antes de comprar, você pode pagar 1 moeda para acrescentar 1 ponto à qualidade, até 12.', concept: 'Garantia de qualidade tem custo e precisa ser avaliada no orçamento.' },
    { id: 'negociacao', name: 'Negociação antecipada', effect: 'Compras selecionadas custam 4 moedas nesta rodada.', concept: 'Negociações podem reduzir custos sem alterar o escopo.' },
    { id: 'lote', name: 'Lote de qualidade duvidosa', effect: 'Compras econômicas perdem 1 ponto de qualidade, até o mínimo de 2.', concept: 'O preço de aquisição não é o único fator na avaliação de qualidade.' },
    { id: 'revisao', name: 'Revisão de estimativa', effect: 'Você pode registrar uma nova previsão de gasto antes de comprar.', concept: 'Reestimar usa novas informações sem apagar a previsão original.' }
  ];
  const eventCost = (sourceId, eventId) => Math.max(1, SOURCES[sourceId].cost + (eventId === 'inflacao' && sourceId === 'economical' ? 1 : 0) - (eventId === 'promocao' || (eventId === 'negociacao' && sourceId === 'selected') ? 1 : 0));
  function drawEvent(state, random = Math.random) {
    if (!state.eventDeck || !state.eventDeck.length) {
      state.eventDeck = EVENTS.map((event) => event.id);
      for (let i = state.eventDeck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [state.eventDeck[i], state.eventDeck[j]] = [state.eventDeck[j], state.eventDeck[i]];
      }
    }
    state.currentEvent = state.eventDeck.pop();
    state.eventHistory = state.eventHistory || [];
    state.eventHistory.push({ round: state.round, id: state.currentEvent });
    if (state.currentEvent === 'defeito') state.players.forEach((player) => {
      const item = player.purchases.at(-1);
      if (item) { item.quality = Math.max(2, item.quality - 1); item.adjustment = item.quality - item.dice.reduce((sum, value) => sum + value, item.sourceId === 'selected' ? 6 : 0); }
    });
  }
  const recipe = (player) => RECIPES.find((item) => item.id === player.recipeId);
  const spent = (player) => player.purchases.reduce((sum, item) => sum + item.cost, 0);
  const balance = (player) => BUDGET - spent(player);
  const remaining = (player) => recipe(player).ingredients.filter((name) => !player.purchases.some((item) => item.ingredient === name));
  const complete = (player) => remaining(player).length === 0;
  const average = (player) => player.purchases.length ? player.purchases.reduce((sum, item) => sum + item.quality, 0) / player.purchases.length : 0;
  const score = (player) => complete(player) ? average(player) + recipe(player).bonus : null;
  function roll(sourceId, random = Math.random) {
    if (!Object.hasOwn(SOURCES, sourceId)) throw new Error('Procedência inválida.');
    const die = () => Math.floor(random() * 6) + 1;
    const dice = sourceId === 'economical' ? [die(), die()] : [die()];
    return { dice, quality: dice.reduce((sum, value) => sum + value, 0) + (sourceId === 'selected' ? 6 : 0) };
  }
  function buy(player, ingredient, sourceId, random = Math.random, options = {}) {
    const source = Object.hasOwn(SOURCES, sourceId) ? SOURCES[sourceId] : null;
    const eventId = options.eventId;
    const cost = source ? eventCost(sourceId, eventId) + (options.inspect && eventId === 'inspecao' ? 1 : 0) : 0;
    if (player.finished || !source || (eventId === 'indisponivel' && sourceId === 'selected') || !remaining(player).includes(ingredient) || balance(player) < cost) throw new Error('Compra não permitida.');
    let result = roll(sourceId, random);
    if (options.reroll && eventId === 'otimista') result = roll(sourceId, random);
    const base = result.quality;
    result.quality = Math.max(2, Math.min(12, base + (options.inspect && eventId === 'inspecao' ? 1 : 0) - (eventId === 'lote' && sourceId === 'economical' ? 1 : 0)));
    result = { ingredient, sourceId, cost, ...result, adjustment: result.quality - base };
    player.purchases.push(result);
    player.finished = complete(player) || balance(player) < SOURCES.economical.cost;
    return result;
  }
  function nextPlayer(players, currentIndex) {
    for (let distance = 1; distance <= players.length; distance++) {
      const index = (currentIndex + distance) % players.length;
      if (!players[index].finished) return index;
    }
    return -1;
  }
  function ranking(players) {
    return [...players].sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1));
  }
  function newPlayer(index) {
    return { id: index + 1, name: `Jogador ${index + 1}`, recipeId: 'classico', estimateCost: 16, estimateLow: 7, estimateHigh: 12, purchases: [], finished: false };
  }
  function newState() {
    return { version: 1, phase: 'setup', players: [newPlayer(0), newPlayer(1)], planningIndex: 0, turnIndex: 0, round: 1, pendingResult: null, handoff: null };
  }
  function validState(state) {
    if (!state || state.version !== 1 || !['setup', 'planning', 'handoff', 'play', 'results'].includes(state.phase)) return false;
    if (!Array.isArray(state.players) || state.players.length < 2 || state.players.length > 6) return false;
    if (!Number.isInteger(state.round) || state.round < 1) return false;
    const eventIds = new Set(EVENTS.map((event) => event.id));
    if (state.currentEvent !== undefined && !eventIds.has(state.currentEvent)) return false;
    if (state.eventDeck !== undefined && (!Array.isArray(state.eventDeck) || state.eventDeck.some((id) => !eventIds.has(id)) || new Set(state.eventDeck).size !== state.eventDeck.length)) return false;
    if (state.eventHistory !== undefined && (!Array.isArray(state.eventHistory) || state.eventHistory.some((entry) => !entry || !eventIds.has(entry.id) || !Number.isInteger(entry.round) || entry.round < 1 || entry.round > state.round))) return false;
    if (![state.planningIndex, state.turnIndex].every((i) => Number.isInteger(i) && i >= 0 && i < state.players.length)) return false;
    const validPlayers = state.players.every((player, index) => {
      if (!player || player.id !== index + 1 || typeof player.name !== 'string' || player.name.length > 24 || !recipe(player) || typeof player.finished !== 'boolean' || !Array.isArray(player.purchases)) return false;
      if (![player.estimateCost, player.estimateLow, player.estimateHigh].every(Number.isFinite)) return false;
      if (player.revisedEstimate !== undefined && (!Number.isInteger(player.revisedEstimate) || player.revisedEstimate < 0 || player.revisedEstimate > BUDGET)) return false;
      if (player.scopeRound !== undefined && (!Number.isInteger(player.scopeRound) || player.scopeRound < 1 || player.scopeRound > state.round)) return false;
      if (player.estimateCost < 0 || player.estimateCost > BUDGET || player.estimateLow < 2 || player.estimateHigh > 12 || player.estimateLow > player.estimateHigh) return false;
      const names = new Set();
      for (const item of player.purchases) {
        if (!item) return false;
        const source = Object.hasOwn(SOURCES, item.sourceId) ? SOURCES[item.sourceId] : null;
        if (!source || !Number.isInteger(item.cost) || item.cost < 1 || item.cost > source.cost + 1 || !recipe(player).ingredients.includes(item.ingredient) || names.has(item.ingredient)) return false;
        if (!Array.isArray(item.dice) || item.dice.length !== (item.sourceId === 'economical' ? 2 : 1) || !item.dice.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)) return false;
        if (!Number.isInteger(item.adjustment || 0) || item.quality < 2 || item.quality > 12 || item.quality !== item.dice.reduce((sum, value) => sum + value, item.sourceId === 'selected' ? 6 : 0) + (item.adjustment || 0)) return false;
        names.add(item.ingredient);
      }
      return spent(player) <= BUDGET;
    });
    if (!validPlayers) return false;
    if (state.phase === 'handoff' && (!state.handoff || !['planning', 'play'].includes(state.handoff.kind) || !Number.isInteger(state.handoff.index) || !state.players[state.handoff.index])) return false;
    if (state.pendingResult && (state.phase !== 'play' || state.pendingResult.playerIndex !== state.turnIndex || state.pendingResult.purchaseIndex !== state.players[state.turnIndex].purchases.length - 1 || state.pendingResult.purchaseIndex < 0)) return false;
    if (state.phase === 'results' && !state.players.every((player) => player.finished)) return false;
    return true;
  }
  const api = { BUDGET, RECIPES, SOURCES, EVENTS, eventCost, drawEvent, recipe, spent, balance, remaining, complete, average, score, roll, buy, nextPlayer, ranking, newPlayer, newState, validState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BurgerRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
