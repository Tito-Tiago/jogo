/* Interface local: sem dependências, chamadas de rede ou servidor. */
(() => {
  'use strict';
  const R = window.BurgerRules;
  const KEY = 'na-conta-do-hamburguer-v1';
  const main = document.querySelector('#main');
  const dialog = document.querySelector('#action-dialog');
  const dialogContent = document.querySelector('#dialog-content');
  const announcement = document.querySelector('#announcement');
  let state = R.newState();
  let activeTab = 'game';
  let tutorialStep = 0;
  let confirmAction = null;
  let dialogKind = null;
  let storageAvailable = true;
  const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value, digits = 1) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
  const points = (value) => number(value, 2);
  const signed = (value) => `${value > 0 ? '+' : ''}${number(value)}`;
  const ingredientArt = { 'Pão': '🍞', 'Carne': '🥩', 'Queijo': '🧀', 'Molho': '🍅', 'Alface': '🥬', 'Tomate': '🍅' };

  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (R.validState(parsed)) state = parsed;
      else announcement.textContent = 'O progresso anterior não era compatível. Uma nova partida foi preparada.';
    }
  } catch {
    storageAvailable = false;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    document.querySelector('#storage-warning').hidden = storageAvailable;
  }

  function announce(text) { announcement.textContent = text; }
  function focusMain() { main.focus({ preventScroll: true }); }
  function setTab(tab) {
    activeTab = tab;
    render();
    focusMain();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function progress(step) {
    return `<div class="progress-line" aria-label="Etapas da partida"><span class="${step === 1 ? 'active' : ''}">01 · Mesa</span><span aria-hidden="true">→</span><span class="${step === 2 ? 'active' : ''}">02 · Planejamento</span><span aria-hidden="true">→</span><span class="${step === 3 ? 'active' : ''}">03 · Compras</span><span aria-hidden="true">→</span><span class="${step === 4 ? 'active' : ''}">04 · Resultado</span></div>`;
  }
  function numericField(label, field, value, min, max, step, help = '') {
    return `<div class="field"><label for="${field}">${label}</label><span class="stepper"><button type="button" class="square" data-stepper="${field}" data-direction="-1" aria-label="Diminuir ${label.toLowerCase()}">−</button><input id="${field}" name="${field}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${value}" required${help ? ` aria-describedby="${field}-help"` : ''}><button type="button" class="square" data-stepper="${field}" data-direction="1" aria-label="Aumentar ${label.toLowerCase()}">+</button></span>${help ? `<small class="muted" id="${field}-help">${help}</small>` : ''}</div>`;
  }

  function renderSetup() {
    return `${progress(1)}
      <section class="hero panel" aria-labelledby="welcome-title">
        <div class="hero-copy"><span class="eyebrow">MULTIJOGADOR LOCAL · 2 A 6 PARTICIPANTES</span><h2 id="welcome-title">O melhor hambúrguer<br>começa no planejamento.</h2><p>Escolham suas receitas, façam uma previsão e comprem por turnos. O desafio: equilibrar custo, risco e qualidade com apenas 24 moedas.</p><div class="pills"><span class="pill">Uma tela, todo mundo joga</span><span class="pill">Toque para comprar</span><span class="pill">Cada um com seu orçamento</span></div></div>
        <div class="burger-art" aria-hidden="true"><span class="bun-top"></span><span class="lettuce"></span><span class="cheese"></span><span class="patty"></span><span class="bun-bottom"></span></div>
      </section>
      <div class="grid-two"><section class="panel"><div class="section-heading"><h3>Quem está na mesa?</h3><div class="counter"><button class="square" type="button" data-action="remove-player" aria-label="Remover último participante" ${state.players.length === 2 ? 'disabled' : ''}>−</button><output aria-label="Quantidade de participantes">${state.players.length}</output><button class="square" type="button" data-action="add-player" aria-label="Adicionar participante" ${state.players.length === 6 ? 'disabled' : ''}>+</button></div></div>
      <form id="setup-form"><div class="name-list">${state.players.map((player, index) => `<label class="field" for="name-${index}">Participante ${index + 1}<input id="name-${index}" name="name-${index}" value="${esc(player.name)}" maxlength="24" placeholder="Nome do jogador ou equipe" autocomplete="off" required></label>`).join('')}</div><p class="muted"><small>Podem ser pessoas ou equipes. Os nomes devem ser diferentes.</small></p><p id="form-error" class="error" role="alert" hidden></p><button class="primary wide" type="submit">Preparar a partida <span aria-hidden="true">→</span></button></form></section>
      <aside class="panel"><span class="eyebrow">ANTES DE COMEÇAR</span><h3>Uma compra por turno.</h3><ol class="numbered"><li>Cada participante escolhe sua receita e registra uma estimativa.</li><li>Na sua vez, compre um ingrediente. A qualidade é sorteada na hora.</li><li>Conclua a receita e compare sua pontuação — e sua previsão — com as dos colegas.</li></ol><button type="button" class="text-button" data-tab="help">Primeira vez? Abra o tutorial ↗</button></aside></div>`;
  }

  function renderPlanning() {
    const player = state.players[state.planningIndex];
    const recipe = R.recipe(player);
    return `${progress(2)}<section class="panel">
      <div class="planning-head"><div><span class="eyebrow">PLANEJAMENTO ${state.planningIndex + 1} DE ${state.players.length}</span><h2>${esc(player.name)}, qual é o plano?</h2><p class="recipe-description">Escolha o que entregar e estime antes de comprar. Todos podem escolher a mesma receita.</p></div><span class="badge">Orçamento: 24 moedas</span></div>
      <h3>1. Escolha a receita</h3><div class="grid-three" role="group" aria-label="Receita">${R.RECIPES.map((item) => `<button type="button" class="recipe-card ${player.recipeId === item.id ? 'selected' : ''}" data-recipe="${item.id}" aria-pressed="${player.recipeId === item.id}"><span class="check" aria-hidden="true">${player.recipeId === item.id ? '●' : '○'}</span><span class="card-kicker">CARTA DE RECEITA</span><span class="recipe-art" aria-hidden="true">🍔</span><strong>${item.name}</strong><small>${item.ingredients.join(' · ')}</small><span class="recipe-footer"><span>${item.ingredients.length} ingredientes</span><span>Bônus +${number(item.bonus)}</span></span></button>`).join('')}</div>
      <hr class="divider"><h3>2. Registre sua estimativa</h3><p class="muted">O gasto previsto não é uma meta: é sua previsão. A faixa abaixo se refere à <strong>qualidade média</strong>, antes do bônus.</p>
      <form id="planning-form"><div class="form-fields">${numericField('Gasto previsto', 'estimateCost', player.estimateCost, 0, 24, 1, 'Moedas que você acredita que vai gastar.')}${numericField('Qualidade mínima prevista', 'estimateLow', player.estimateLow, 2, 12, .5, 'Limite inferior da sua faixa esperada.')}${numericField('Qualidade máxima prevista', 'estimateHigh', player.estimateHigh, 2, 12, .5, 'Limite superior da sua faixa esperada.')}</div>
      <div class="source-info"><div><strong>Econômica · 3 moedas</strong><p>Qualidade: 2 dados (2–12). Média esperada: 7.</p></div><div><strong>Selecionada · 5 moedas</strong><p>Qualidade: 1 dado + 6 (7–12). Média esperada: 9,5.</p></div></div>
      <p class="note">Para o <strong>${recipe.name}</strong>, comprar tudo econômico custa <strong>${recipe.ingredients.length * R.SOURCES.economical.cost}</strong> moedas; tudo selecionado custa <strong>${recipe.ingredients.length * R.SOURCES.selected.cost}</strong>. Uma mistura fica entre esses valores. Seu limite continua sendo 24 moedas.</p>
      <p id="form-error" class="error" role="alert" hidden></p><div class="actions end"><button class="text-button" type="button" data-tab="help">Preciso de ajuda</button><button class="primary" type="submit">Confirmar meu planejamento →</button></div></form></section>`;
  }

  function renderHandoff() {
    const next = state.players[state.handoff.index];
    const planning = state.handoff.kind === 'planning';
    return `${progress(planning ? 2 : 3)}<section class="panel centered"><div class="handoff-icon" aria-hidden="true">↗</div><span class="eyebrow">${planning ? 'PRÓXIMO PLANEJAMENTO' : `RODADA ${state.round} · PASSE A VEZ`}</span><h2>Agora é com<br>${esc(next.name)}.</h2><p class="muted">${planning ? 'Passe a tela para este participante escolher a receita e registrar sua previsão.' : 'Na sua vez, compre um ingrediente da sua receita. Cada participante usa apenas as próprias moedas.'}</p><button class="primary wide" data-action="accept-turn">${planning ? 'Fazer meu planejamento' : 'Começar meu turno'} →</button><button type="button" class="text-button wide" data-tab="help">Consultar regras</button></section>`;
  }

  function renderPlayerCard(player, index) {
    return `<div class="player-card ${index === state.turnIndex ? 'current' : ''}"><span class="player-number">${index === state.turnIndex ? 'VEZ ATUAL' : `PARTICIPANTE ${index + 1}`}</span><div class="player-top"><strong>${esc(player.name)}</strong><span>${R.balance(player)} moedas</span></div><p>${R.recipe(player).name} · ${player.purchases.length}/${R.recipe(player).ingredients.length} ingredientes</p>${player.finished ? `<p>${R.complete(player) ? '✓ Receita concluída' : 'Participação encerrada'}</p>` : ''}</div>`;
  }

  function renderPlay() {
    const player = state.players[state.turnIndex];
    const recipe = R.recipe(player);
    const event = R.EVENTS.find((item) => item.id === state.currentEvent);
    const available = Object.entries(R.SOURCES).some(([id]) => !(state.currentEvent === 'indisponivel' && id === 'selected') && R.balance(player) >= R.eventCost(id, state.currentEvent));
    return `${progress(3)}<div class="game-layout"><aside class="panel game-sidebar"><h3 class="dashboard-label">A mesa</h3><p class="muted"><small>Rodada ${state.round} · Uma compra por turno</small></p><div class="player-list">${state.players.map(renderPlayerCard).join('')}</div></aside>
      <section class="panel"><div class="game-top"><div><span class="eyebrow">SUA VEZ · RODADA ${state.round}</span><h2>${esc(player.name)}</h2><p class="muted">${recipe.name} · Bônus +${number(recipe.bonus)} ao concluir</p></div><div class="balance"><small>SALDO DISPONÍVEL</small><strong>${R.balance(player)}</strong> <span>moedas</span></div></div>
      <div class="planning-summary"><span>Seu gasto previsto<strong>${number(player.estimateCost)} moedas</strong></span><span>Sua faixa de qualidade média<strong>${number(player.estimateLow)} a ${number(player.estimateHigh)}</strong></span><span>Gasto até agora<strong>${R.spent(player)} moedas</strong></span></div>
      ${event ? `<article class="event-card"><div><span class="card-kicker">🂠 CARTA DE EVENTO · RODADA ${state.round}</span><h3>${event.name}</h3><p>${event.effect}</p><p class="event-concept"><strong>Na estimativa de custos:</strong> ${event.concept}</p></div></article>` : ''}
      ${state.currentEvent === 'escopo' && player.recipeId !== 'completo' && player.scopeRound !== state.round ? '<button type="button" data-action="expand-scope">Avaliar mudança de escopo →</button>' : ''}
      ${state.currentEvent === 'revisao' ? `<form id="revision-form" class="event-option"><label for="revision">Nova previsão de gasto (0 a 24 moedas)</label><input id="revision" type="number" min="0" max="24" step="1" required value="${player.revisedEstimate ?? player.estimateCost}"><button type="submit">Registrar revisão</button>${player.revisedEstimate != null ? `<small>Previsão revisada: ${number(player.revisedEstimate)} moedas. Original: ${number(player.estimateCost)}.</small>` : ''}</form>` : ''}
      ${state.currentEvent === 'inspecao' ? '<label class="event-option"><input id="inspect-option" type="checkbox"> Pagar 1 moeda para inspecionar a compra deste turno</label><p id="purchase-error" class="error" role="alert" hidden></p>' : ''}
      ${state.currentEvent === 'otimista' ? '<label class="event-option"><input id="reroll-option" type="checkbox"> Rolar duas vezes e aceitar o segundo resultado</label>' : ''}
      <hr class="divider"><div class="section-heading"><h3>Escolha um ingrediente</h3><button type="button" class="text-button help-link" data-tab="help">Como funciona a qualidade?</button></div>
      <p class="muted"><small>A compra é confirmada antes do sorteio. Não há devolução nem substituição nesta versão.</small></p>
      <div class="ingredient-hand">${recipe.ingredients.map((ingredient, index) => {
        const bought = player.purchases.find((item) => item.ingredient === ingredient);
        return `<div class="ingredient-group"><h4>${ingredient}</h4><div class="card-choices">${bought ? `<div class="purchase-card is-bought"><span class="card-kicker">CARTA ADQUIRIDA</span><div class="ingredient-art" aria-hidden="true">${ingredientArt[ingredient] || '🍽️'}</div><strong>${ingredient}</strong><div class="bought"><span>✓ ${R.SOURCES[bought.sourceId].name}<br>${bought.cost} moedas gastas</span><span class="quality">${number(bought.quality)} de qualidade</span></div></div>` : Object.entries(R.SOURCES).map(([id, source]) => { const cost = R.eventCost(id, state.currentEvent); return `<button type="button" class="purchase-card source-button ${id === 'selected' ? 'accent' : ''}" data-buy="${index}" data-source="${id}" ${R.balance(player) < cost || player.finished || (state.currentEvent === 'indisponivel' && id === 'selected') ? 'disabled' : ''} aria-label="Comprar ${ingredient}, procedência ${source.name.toLowerCase()}, ${cost} moedas"><span class="card-kicker">${source.name}</span><span class="ingredient-art" aria-hidden="true">${ingredientArt[ingredient] || '🍽️'}</span><span class="card-ingredient">${ingredient}</span><strong>${cost} moedas</strong><small>${state.currentEvent === 'indisponivel' && id === 'selected' ? 'Indisponível nesta rodada' : `Qualidade base ${source.min}–${source.max} · média ${number(source.mean)}`}</small></button>`; }).join('')}</div></div>`;
      }).join('')}</div>
      ${R.balance(player) < R.remaining(player).length * R.SOURCES.economical.cost && !player.finished ? '<p class="note warning">Seu saldo não cobre todos os ingredientes restantes pelos preços básicos. Eventos futuros podem alterar os custos.</p>' : ''}
      <div class="actions">${!available ? '<button type="button" data-action="pass-turn">Passar a vez: nenhuma compra disponível</button>' : ''}<button type="button" class="text-button" data-action="finish-player">Encerrar minha participação</button></div></section></div>
      <div class="actions end"><button type="button" class="text-button danger" data-action="reset">Reiniciar a mesa</button></div>`;
  }

  function renderResults() {
    const ranked = R.ranking(state.players);
    const best = R.score(ranked[0]);
    const winners = best === null ? [] : ranked.filter((player) => Math.abs(R.score(player) - best) < 1e-9 && R.complete(player));
    const title = winners.length ? `${winners.map((player) => esc(player.name)).join(' e ')} ${winners.length > 1 ? 'venceram!' : 'venceu!'}` : 'Hoje, a receita ficou pelo caminho.';
    return `${progress(4)}<section class="score-hero"><span class="eyebrow">${winners.length > 1 ? 'EMPATE NA COZINHA' : 'CONTA FECHADA'}</span><h2>${title}</h2><p>${winners.length ? `Melhor pontuação: <strong>${points(best)}</strong> pontos. Agora comparem as decisões, não só o placar.` : 'Ninguém concluiu a receita. Comparem as compras e pensem em como ajustar o próximo planejamento.'}</p><div class="pills"><span class="pill">Pontuação = qualidade média + bônus</span><span class="pill">Só receitas completas entram na disputa</span></div></section>
      <div class="grid-two">${ranked.map((player) => {
        const completed = R.complete(player);
        const avg = R.average(player);
        const inside = completed && avg >= player.estimateLow && avg <= player.estimateHigh;
        return `<article class="panel result-card"><header><div><span class="eyebrow">${completed ? '✓ RECEITA CONCLUÍDA' : 'RECEITA INCOMPLETA'}</span><h3>${esc(player.name)}</h3><small class="muted">${R.recipe(player).name} · ${player.purchases.length}/${R.recipe(player).ingredients.length} ingredientes</small></div><div class="result-score"><strong>${completed ? points(R.score(player)) : '—'}</strong><small>${completed ? 'pontos finais' : 'sem pontuação'}</small></div></header>
        <div class="metrics"><div class="metric"><small>Gasto previsto → real</small><strong>${number(player.estimateCost)} → ${R.spent(player)} moedas</strong><p>${player.revisedEstimate != null ? `Previsão revisada: ${number(player.revisedEstimate)} moedas<br>` : ''}Diferença da previsão original: ${signed(R.spent(player) - player.estimateCost)} moedas<br>Saldo não usado: ${R.balance(player)}</p></div><div class="metric"><small>Faixa prevista → qualidade média ${completed ? 'real' : 'parcial'}</small><strong>${number(player.estimateLow)}–${number(player.estimateHigh)} → ${player.purchases.length ? points(avg) : '—'}</strong><p>${completed ? `${inside ? 'Dentro' : 'Fora'} da faixa prevista.<br>Bônus de receita: +${number(R.recipe(player).bonus)}` : 'Receita incompleta: sem bônus e sem comparação final da faixa.'}</p></div></div>
        <ul class="history" aria-label="Histórico de compras de ${esc(player.name)}">${player.purchases.length ? player.purchases.map((item) => `<li><span>${item.ingredient} · ${R.SOURCES[item.sourceId].name}</span><span class="nowrap">${item.cost} moedas · Q ${item.quality}</span></li>`).join('') : '<li>Nenhuma compra realizada.</li>'}</ul></article>`;
      }).join('')}</div><section class="panel" style="margin-top:24px"><span class="eyebrow">HISTÓRICO DA PARTIDA</span><h3>Eventos da mesa</h3><ol class="rules-list">${(state.eventHistory || []).map((entry) => `<li>Rodada ${entry.round}: ${R.EVENTS.find((item) => item.id === entry.id)?.name || 'Evento desconhecido'}</li>`).join('') || '<li>Nenhum evento registrado.</li>'}</ol></section><section class="panel" style="margin-top:24px"><span class="eyebrow">CONVERSA DEPOIS DA PARTIDA</span><h3>O que vocês fariam diferente?</h3><ul class="rules-list"><li>O gasto mudou em relação ao plano? Por quê?</li><li>Pagar mais pela qualidade mínima compensou nesta partida?</li><li>Uma boa decisão pode produzir um resultado ruim por acaso?</li><li>O bônus da receita maior compensou o uso do orçamento?</li></ul><div class="actions"><button type="button" class="primary" data-action="rematch">Jogar novamente com esta mesa</button><button type="button" data-action="reset">Configurar outra mesa</button><button type="button" class="text-button" data-tab="concepts">Relacionar com a disciplina ↗</button></div></section>`;
  }

  const tutorial = [
    { title: 'Sentem à mesma mesa.', text: 'Cadastrem de 2 a 6 jogadores ou equipes. Todos usam a mesma tela, por turnos, e cada um recebe 24 moedas. Não é um orçamento compartilhado.', example: 'Ana tem 24 moedas. Bruno também tem 24. Uma compra de Ana não diminui o dinheiro de Bruno.' },
    { title: 'Defina a entrega antes da compra.', text: 'Cada participante escolhe uma receita e registra o gasto previsto e a faixa de qualidade média esperada. Os ingredientes obrigatórios são o escopo da entrega.', example: 'O Clássico precisa de pão, carne, queijo e molho. Tudo econômico custa 12 moedas; tudo selecionado, 20.' },
    { title: 'Preço e qualidade podem mudar.', text: 'O preço básico da econômica é 3 moedas e o da selecionada é 5. Uma carta de evento é revelada a cada rodada e pode alterar preços, qualidade ou decisões.', example: 'Sem evento, econômica: dados 2 + 5 = qualidade 7. Selecionada: dado 2 + 6 = qualidade 8. A média esperada não é uma promessa.' },
    { title: 'Compre uma vez e passe a tela.', text: 'No seu turno, toque na procedência de um ingrediente e confirme. Veja os dados e passe a vez. Participantes que concluíram ou encerraram deixam de receber turnos.', example: 'Ana compra o pão. Bruno compra a carne. Depois, a vez volta a Ana. Não é possível comprar de novo o mesmo ingrediente.' },
    { title: 'Feche a receita e compare.', text: 'Receita completa: some a qualidade dos ingredientes, divida pela quantidade e adicione o bônus. Vence a maior pontuação. Pontuações exatamente iguais empatam; saldo não desempata.', example: 'Clássico com qualidades 7, 8, 9 e 10: média 8,5 + bônus 0 = 8,5 pontos. Depois, compare gasto e faixa previstos com o resultado real.' }
  ];

  function renderHelp() {
    const step = tutorial[tutorialStep];
    return `<div class="section-heading"><div><span class="eyebrow">AJUDA SEM SAIR DA PARTIDA</span><h2>Regras e tutorial</h2></div><button type="button" data-tab="game">← Voltar ao jogo</button></div><p class="muted">Seu progresso é mantido ao trocar de aba. Você pode consultar esta página a qualquer momento.</p>
      <div class="grid-two"><section class="panel tutorial-box"><div class="tutorial-count">TUTORIAL · ${tutorialStep + 1} DE ${tutorial.length}</div><h3>${step.title}</h3><p>${step.text}</p><p class="note">${step.example}</p><div class="tutorial-controls"><button type="button" data-action="tutorial-back" ${tutorialStep === 0 ? 'disabled' : ''}>← Anterior</button><div class="tutorial-dots" aria-hidden="true">${tutorial.map((_, index) => `<span class="${index === tutorialStep ? 'active' : ''}"></span>`).join('')}</div>${tutorialStep === tutorial.length - 1 ? '<button type="button" class="primary" data-tab="game">Vamos jogar →</button>' : '<button type="button" class="primary" data-action="tutorial-next">Próximo →</button>'}</div></section>
      <section class="panel"><h3>Resumo da mesa</h3><ul class="rules-list"><li>De 2 a 6 jogadores ou equipes, por turnos.</li><li>24 moedas para cada participante. Não há empréstimos.</li><li>Uma compra por turno. Todos podem escolher a mesma receita.</li><li>Compra confirmada não tem devolução nem substituição.</li><li>Quem conclui a receita deixa de comprar. Quem fica com menos de 3 moedas sem concluir é encerrado automaticamente.</li><li>Também é possível encerrar voluntariamente, sem pontuação se a receita estiver incompleta.</li><li>Vence a maior pontuação entre receitas completas. Empates são compartilhados.</li></ul></section></div>
      <section class="panel" style="margin-top:24px"><h3>As duas procedências</h3><div class="table-wrap"><table><caption class="sr-only">Preços e distribuições de qualidade</caption><thead><tr><th>Procedência</th><th>Custo</th><th>Sorteio</th><th>Faixa</th><th>Média esperada</th></tr></thead><tbody><tr><td>Econômica</td><td>3 moedas</td><td>2 dados de 6 faces</td><td>2–12</td><td>7</td></tr><tr><td>Selecionada</td><td>5 moedas</td><td>1 dado de 6 faces + 6</td><td>7–12</td><td>9,5</td></tr></tbody></table></div><p class="muted"><small>Dados justos e independentes. Na econômica, somas próximas de 7 são mais prováveis do que 2 ou 12. A selecionada tem qualidade mínima maior, mas não garante superar toda compra econômica.</small></p>
      <h3>Receitas e pontuação</h3><div class="table-wrap"><table><caption class="sr-only">Ingredientes e bônus de cada receita</caption><thead><tr><th>Receita</th><th>Ingredientes obrigatórios</th><th>Bônus</th></tr></thead><tbody>${R.RECIPES.map((item) => `<tr><td>${item.name}</td><td>${item.ingredients.join(', ')}</td><td>+${number(item.bonus)}</td></tr>`).join('')}</tbody></table></div><p class="note"><strong>Pontuação = (soma da qualidade ÷ quantidade de ingredientes) + bônus.</strong> O placar é exibido com até duas casas decimais, mas comparado sem arredondamento. Bônus são valores iniciais de teste, não uma medida universal de valor.</p></section>`;
  }

  function renderConcepts() {
    return `<div class="section-heading"><div><span class="eyebrow">DA COZINHA PARA A DISCIPLINA</span><h2>O que está em jogo?</h2></div><button type="button" data-tab="game">← Voltar ao jogo</button></div><p class="muted">Uma simulação introdutória de decisões de custo e risco — não um modelo completo de estimativa de software.</p>
      <div class="grid-two"><article class="panel"><h3>Escopo, tamanho e custo</h3><p>A receita define o que deve ser entregue. Mais ingredientes exigem mais recursos, mas contar ingredientes <strong>não equivale</strong> a medir pontos de função ou linhas de código.</p><p class="note">Pergunta para a mesa: duas entregas do mesmo tamanho necessariamente têm o mesmo custo?</p></article>
      <article class="panel"><h3>Estimativa ≠ orçamento ≠ resultado</h3><p><strong>Estimativa</strong> é sua previsão. <strong>Orçamento</strong> é o limite de 24 moedas. <strong>Resultado</strong> é o que foi gasto e entregue. O gasto real pode diferir da previsão se as escolhas de compra mudarem.</p><p class="note">Os preços básicos são conhecidos, mas cartas de evento podem alterá-los. O sorteio dos dados afeta a qualidade.</p></article>
      <article class="panel"><h3>Risco e incerteza</h3><p>Uma faixa expressa resultados possíveis ou esperados; não promete um valor específico. A procedência selecionada eleva o mínimo de qualidade. A econômica economiza recursos com maior variabilidade.</p><p>Em software, o risco também pode vir de requisitos instáveis, tecnologia, experiência e comunicação. Os dados são uma simplificação desses fatores.</p></article>
      <article class="panel"><h3>Qualidade e valor</h3><p>A qualidade é o desempenho dos ingredientes. A pontuação mistura qualidade média com um bônus definido pelas regras para a complexidade da receita.</p><p>Saldo restante não dá pontos. O bônus precisa ser calibrado em partidas de teste: se for excessivo ou insuficiente, uma receita pode dominar as escolhas.</p></article>
      <article class="panel"><h3>Comparar para aprender</h3><p>Depois da partida, comparem gasto previsto e real, faixa esperada e qualidade obtida. Um sorteio isolado não prova que a estratégia era boa ou ruim. Repitam partidas e discutam os padrões.</p><p class="note">Objetivo: justificar escolhas considerando escopo, orçamento, custo, risco, qualidade e benefício esperado.</p></article>
      <article class="panel"><h3>O que este protótipo não representa</h3><p>Não há estimativa de horas, duração, produtividade, métodos formais de medição de software ou acompanhamento de marcos.</p><p>Também <strong>não implementa Análise de Valor Agregado formal</strong>: faltam valor planejado, valor agregado e custo real acompanhados ao longo do tempo.</p></article></div>
      <section class="panel" style="margin-top:24px"><h3>Referências da proposta</h3><p class="muted">As mecânicas são analogias didáticas inspiradas na discussão apresentada. Os links abaixo abrem fontes externas e precisam de internet.</p><ul class="reference-list"><li><a href="https://www.mheducation.com/highered/mhp/product/practical-software-project-estimation-toolkit-estimating-software-development-effort-duration.html" target="_blank" rel="noopener noreferrer">Hill — Practical Software Project Estimation</a></li><li><a href="https://www.mheducation.com/highered/mhp/product/estimating-software-costs.html" target="_blank" rel="noopener noreferrer">Jones — Estimating Software Costs</a></li><li><a href="https://www.microsoftpressstore.com/articles/article.aspx?p=2191414" target="_blank" rel="noopener noreferrer">McConnell — discussão sobre estimativas</a></li><li><a href="https://repositorio.ufc.br/handle/riufc/49759" target="_blank" rel="noopener noreferrer">Braga — fatores que afetam estimativas de esforço</a></li><li><a href="https://ricardo-vargas.com/pt/books/analise-de-valor-agregado-em-projetos-5a-edicao/" target="_blank" rel="noopener noreferrer">Vargas — Análise de Valor Agregado em Projetos</a></li></ul></section>`;
  }

  function render() {
    document.querySelectorAll('.navigation [data-tab]').forEach((button) => {
      if (button.dataset.tab === activeTab) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.querySelector('#storage-warning').hidden = storageAvailable;
    if (activeTab === 'help') main.innerHTML = renderHelp();
    else if (activeTab === 'concepts') main.innerHTML = renderConcepts();
    else main.innerHTML = ({ setup: renderSetup, planning: renderPlanning, handoff: renderHandoff, play: renderPlay, results: renderResults })[state.phase]();
    if (activeTab === 'game' && state.pendingResult && !dialog.open) showResult();
  }

  function formError(message) {
    const error = document.querySelector('#form-error');
    error.textContent = message;
    error.hidden = false;
  }

  function syncSetup() {
    state.players.forEach((player, index) => {
      const input = document.querySelector(`#name-${index}`);
      if (input) player.name = input.value.slice(0, 24);
    });
  }

  function readPlan() {
    const values = ['estimateCost', 'estimateLow', 'estimateHigh'].map((key) => {
      const input = document.getElementById(key);
      return input && input.value !== '' ? Number(input.value) : NaN;
    });
    if (!values.every(Number.isFinite)) return null;
    const [estimateCost, estimateLow, estimateHigh] = values;
    if (estimateCost < 0 || estimateCost > 24 || estimateLow < 2 || estimateHigh > 12 || estimateLow > estimateHigh) return null;
    return { estimateCost, estimateLow, estimateHigh };
  }

  function handoff(kind, index) {
    state.phase = 'handoff';
    state.handoff = { kind, index };
    save();
    render();
    focusMain();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function advanceTurn() {
    const next = R.nextPlayer(state.players, state.turnIndex);
    state.pendingResult = null;
    if (next === -1) {
      state.phase = 'results';
      save();
      render();
      focusMain();
      window.scrollTo({ top: 0, behavior: 'instant' });
      announce('Partida concluída. Confira os resultados e compare as previsões.');
    } else {
      if (next <= state.turnIndex) { state.round++; R.drawEvent(state); }
      handoff('play', next);
    }
  }

  function closeDialog() {
    dialog.close();
    dialogKind = null;
    confirmAction = null;
  }

  function confirm(title, content, label, action, danger = false) {
    dialogKind = 'confirmation';
    confirmAction = action;
    dialogContent.innerHTML = `<h2 id="dialog-title">${title}</h2>${content}<div class="actions end"><button type="button" data-action="cancel-dialog" autofocus>Cancelar</button><button type="button" class="${danger ? 'danger' : 'primary'}" data-action="confirm-dialog">${label}</button></div>`;
    dialog.showModal();
  }

  function showResult() {
    const player = state.players[state.pendingResult.playerIndex];
    const purchase = player.purchases[state.pendingResult.purchaseIndex];
    const selected = purchase.sourceId === 'selected';
    dialogKind = 'result';
    confirmAction = null;
    dialogContent.innerHTML = `<span class="eyebrow">COMPRA REALIZADA · ${esc(player.name)}</span><h2 id="dialog-title">${purchase.ingredient} na conta!</h2><p class="muted">${R.SOURCES[purchase.sourceId].name} · ${purchase.cost} moedas gastas</p><div class="dice" role="img" aria-label="${selected ? `Dado ${purchase.dice[0]}, mais 6` : `Dados ${purchase.dice.join(' e ')}`}">${purchase.dice.map((die) => `<span class="die" aria-hidden="true">${die}</span>`).join('<span aria-hidden="true">+</span>')}${selected ? '<span aria-hidden="true">+ 6</span>' : ''}</div>${purchase.adjustment ? `<p class="roll-label">Ajuste do evento: ${signed(purchase.adjustment)}</p>` : ''}<p class="roll-quality">${purchase.quality}</p><p class="roll-label">pontos de qualidade</p><p class="note">${R.complete(player) ? 'Receita concluída! Sua pontuação será comparada quando todos terminarem.' : player.finished ? 'Seu saldo não permite outra compra. A receita ficou incompleta e sua participação foi encerrada.' : `Saldo: ${R.balance(player)} moedas. Faltam ${R.remaining(player).length} ingredientes para concluir.`}</p><button type="button" class="primary wide" data-action="continue-result" autofocus>${state.players.every((item) => item.finished) ? 'Ver resultados' : 'Passar a vez'} →</button>`;
    dialog.showModal();
    announce(`Compra realizada: ${purchase.ingredient}, qualidade ${purchase.quality}, saldo ${R.balance(player)} moedas.`);
  }

  function requestPurchase(index, sourceId) {
    if (state.phase !== 'play' || state.pendingResult) return;
    const player = state.players[state.turnIndex];
    const ingredient = R.recipe(player).ingredients[index];
    const source = R.SOURCES[sourceId];
    const inspect = state.currentEvent === 'inspecao' && !!document.querySelector('#inspect-option')?.checked;
    const reroll = state.currentEvent === 'otimista' && !!document.querySelector('#reroll-option')?.checked;
    const cost = source ? R.eventCost(sourceId, state.currentEvent) + (inspect ? 1 : 0) : 0;
    if (!ingredient || !source || !R.remaining(player).includes(ingredient) || R.balance(player) < cost || player.finished || (state.currentEvent === 'indisponivel' && sourceId === 'selected')) {
      if (source && inspect && R.balance(player) < cost) { const error = document.querySelector('#purchase-error'); error.textContent = 'Saldo insuficiente para esta compra com inspeção. Desmarque a inspeção ou escolha outra carta.'; error.hidden = false; }
      return;
    }
    const newBalance = R.balance(player) - cost;
    const minRemaining = (R.remaining(player).length - 1) * R.SOURCES.economical.cost;
    confirm(`Comprar ${ingredient.toLowerCase()}?`, `<p><strong>${source.name}</strong> · ${cost} moedas${inspect ? ' (inclui inspeção)' : ''}<br>Qualidade base sorteada: ${source.min} a ${source.max}${reroll ? ' · segundo sorteio obrigatório' : ''}.</p><p>Seu saldo após a compra: <strong>${newBalance} moedas.</strong></p>${newBalance < minRemaining ? `<p class="note warning">Atenção: pelo preço normal econômico, os ingredientes restantes custam ${minRemaining} moedas. Eventos futuros podem alterar esse valor.</p>` : ''}<p class="muted"><small>A qualidade só é revelada após a confirmação. Esta compra não pode ser desfeita.</small></p>`, 'Confirmar e sortear', () => {
      R.buy(player, ingredient, sourceId, Math.random, { eventId: state.currentEvent, inspect, reroll });
      state.pendingResult = { playerIndex: state.turnIndex, purchaseIndex: player.purchases.length - 1 };
      save();
      render();
    });
  }

  function reset(keepPlayers) {
    const names = state.players.map((player) => player.name);
    state = R.newState();
    if (keepPlayers) state.players = names.map((name, index) => ({ ...R.newPlayer(index), name }));
    save();
    setTab('game');
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.tab) return setTab(button.dataset.tab);
    if (button.dataset.stepper) {
      const input = document.getElementById(button.dataset.stepper);
      const step = Number(input.step);
      const base = input.value === '' ? Number(input.min) : Number(input.value);
      input.value = Math.max(Number(input.min), Math.min(Number(input.max), Math.round((base + Number(button.dataset.direction) * step) * 100) / 100));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      announce(`${input.closest('.field').querySelector('label').textContent}: ${input.value}`);
      return;
    }
    if (button.dataset.recipe) {
      const plan = readPlan();
      if (plan) Object.assign(state.players[state.planningIndex], plan);
      state.players[state.planningIndex].recipeId = button.dataset.recipe;
      save();
      render();
      main.querySelector(`[data-recipe="${button.dataset.recipe}"]`).focus({ preventScroll: true });
      return;
    }
    if (button.dataset.buy !== undefined) return requestPurchase(Number(button.dataset.buy), button.dataset.source);
    switch (button.dataset.action) {
      case 'add-player':
      case 'remove-player':
        syncSetup();
        if (button.dataset.action === 'add-player' && state.players.length < 6) state.players.push(R.newPlayer(state.players.length));
        else if (button.dataset.action === 'remove-player' && state.players.length > 2) state.players.pop();
        save(); render(); announce(`${state.players.length} participantes na mesa.`); break;
      case 'accept-turn': {
        const next = state.handoff;
        if (next.kind === 'planning') state.planningIndex = next.index;
        else state.turnIndex = next.index;
        state.phase = next.kind;
        state.handoff = null;
        if (next.kind === 'play' && !state.currentEvent) R.drawEvent(state);
        save(); render(); focusMain(); break;
      }
      case 'pass-turn': advanceTurn(); break;
      case 'expand-scope': {
        const player = state.players[state.turnIndex];
        if (state.phase !== 'play' || state.currentEvent !== 'escopo' || player.scopeRound === state.round) break;
        const next = R.RECIPES[R.RECIPES.findIndex((item) => item.id === player.recipeId) + 1];
        if (!next) break;
        confirm('Aceitar mudança de escopo?', `<p>A receita passa a ser <strong>${next.name}</strong>, com ${next.ingredients.join(', ')} e bônus +${number(next.bonus)}. Confira se seu saldo permite concluir; a mudança não pode ser desfeita.</p>`, 'Alterar receita', () => { player.recipeId = next.id; player.scopeRound = state.round; save(); render(); });
        break;
      }
      case 'confirm-dialog': {
        const action = confirmAction;
        if (!action) return;
        closeDialog();
        action(); break;
      }
      case 'cancel-dialog': closeDialog(); break;
      case 'continue-result':
        if (!state.pendingResult) return;
        closeDialog(); advanceTurn(); break;
      case 'finish-player':
        confirm('Encerrar sua participação?', '<p>Se sua receita estiver incompleta, você ficará <strong>sem pontuação</strong>. As compras serão mantidas para a comparação final. Os outros participantes continuam jogando.</p>', 'Encerrar participação', () => {
          state.players[state.turnIndex].finished = true;
          advanceTurn();
        }, true); break;
      case 'reset':
        confirm('Reiniciar a mesa?', '<p>O planejamento, as compras e os resultados desta partida serão apagados. Uma nova mesa será preparada.</p>', 'Reiniciar', () => reset(false), true); break;
      case 'rematch': reset(true); break;
      case 'tutorial-back': tutorialStep = Math.max(0, tutorialStep - 1); render(); announce(`Passo ${tutorialStep + 1}: ${tutorial[tutorialStep].title}`); break;
      case 'tutorial-next': tutorialStep = Math.min(tutorial.length - 1, tutorialStep + 1); render(); announce(`Passo ${tutorialStep + 1}: ${tutorial[tutorialStep].title}`); break;
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.closest('#setup-form')) { syncSetup(); save(); }
    if (event.target.closest('#planning-form')) {
      const plan = readPlan();
      if (plan) { Object.assign(state.players[state.planningIndex], plan); save(); }
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'revision-form') {
      event.preventDefault();
      const input = event.target.querySelector('#revision');
      const value = Number(input.value);
      if (state.phase !== 'play' || state.currentEvent !== 'revisao' || !input.value || !Number.isInteger(value) || value < 0 || value > 24) return;
      state.players[state.turnIndex].revisedEstimate = value;
      save(); render(); announce(`Previsão revisada para ${value} moedas.`);
    } else if (event.target.id === 'setup-form') {
      event.preventDefault();
      syncSetup();
      state.players.forEach((player) => { player.name = player.name.trim(); });
      if (state.players.some((player) => !player.name)) return formError('Preencha o nome de cada participante.');
      const names = state.players.map((player) => player.name.toLocaleLowerCase('pt-BR'));
      if (new Set(names).size !== names.length) return formError('Use nomes diferentes para identificar os participantes.');
      state.phase = 'planning';
      state.planningIndex = 0;
      save(); render(); focusMain(); window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (event.target.id === 'planning-form') {
      event.preventDefault();
      const plan = readPlan();
      if (!plan) return formError('Confira os valores: gasto entre 0 e 24, qualidade entre 2 e 12, com mínimo menor ou igual ao máximo.');
      Object.assign(state.players[state.planningIndex], plan);
      if (state.planningIndex + 1 < state.players.length) handoff('planning', state.planningIndex + 1);
      else handoff('play', 0);
    }
  });

  dialog.addEventListener('cancel', (event) => {
    if (dialogKind === 'result') event.preventDefault();
    else { confirmAction = null; dialogKind = null; }
  });

  save();
  render();
})();
