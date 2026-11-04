# Na Conta do Hambúrguer

Protótipo de baixa fidelidade, multijogador local, feito para jogar com toque no mesmo computador. Sem instalação, cadastro ou dependências de execução.

## Abrir no computador

Abra `index.html` no Firefox, Chrome ou outro navegador atualizado. No gerenciador de arquivos, clique duas vezes no arquivo ou use **Abrir com → Firefox**. O jogo funciona offline, inclusive as abas de ajuda. Apenas os links das referências exigem internet.

Opcionalmente, para servir por HTTP:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Depois abra `http://localhost:8080`. Mantenha o mesmo endereço e navegador para recuperar a partida salva. O armazenamento de um arquivo aberto diretamente é separado do armazenamento via HTTP.

## Jogar em grupo

1. Cadastre **2 a 6 pessoas ou equipes**.
2. Cada participante escolhe uma receita e registra gasto e faixa de qualidade previstos.
3. Passe a tela a cada turno: **uma compra por participante**, com saldo individual de **24 moedas**.
4. Confirme a procedência, veja os dados e passe a vez.
5. Quem concluiu ou encerrou não recebe novos turnos. Compare o placar e as previsões no final.

O formato implementado é competitivo. Não há rede, adversários automáticos nem orçamento compartilhado. Todos podem escolher a mesma receita. Empates na pontuação são compartilhados.

## Regras iniciais de teste

| Procedência | Custo | Qualidade | Média esperada |
| --- | --- | --- | --- |
| Econômica | 3 | 2 dados de seis faces | 7 |
| Selecionada | 5 | 1 dado de seis faces + 6 | 9,5 |

- Clássico: pão, carne, queijo, molho; bônus 0.
- Especial: Clássico + alface; bônus 0,5.
- Completo: Especial + tomate; bônus 1.
- Pontuação: **qualidade média + bônus**, apenas para receita completa.
- Há um baralho de eventos: uma carta global é revelada por rodada e fica visível na mesa. Ao esgotar o baralho, ele é embaralhado novamente. Eventos podem alterar preços, qualidade e disponibilidade, ou oferecer decisões de escopo, inspeção e revisão de estimativa. A revisão preserva a previsão original no resultado.
- Não há substituições, devoluções, empréstimos ou pontos por saldo. Um jogador sem compra disponível devido ao evento pode passar a vez.
- A classificação usa valores não arredondados; a exibição usa até duas casas decimais.
- Os bônus são hipóteses de equilíbrio e devem ser avaliados com partidas reais.

Os preços de teste são 3 e 5 moedas, em vez dos 2 e 4 inicialmente propostos, para que as maiores receitas não possam usar apenas ingredientes selecionados e uma compra mal planejada possa impedir a conclusão. Com boas escolhas de procedência, as três receitas continuam possíveis dentro de 24 moedas. Os bônus menores aproximam suas pontuações médias esperadas, sem prometer equilíbrio definitivo.

Os preços básicos são conhecidos, mas eventos podem alterá-los durante a partida. A qualidade também é incerta. O jogo é uma analogia introdutória, não um método formal de estimativa de esforço ou de Análise de Valor Agregado.

## Toque e acessibilidade

Botões com pelo menos 48 px de altura, controles +/−, navegação sem hover e sem arrastar, confirmação antes de comprar ou reiniciar. Também funciona com mouse e teclado. As abas **Regras e tutorial** e **Conceitos da disciplina** preservam a partida. O tutorial pode ser lido e reaberto a qualquer momento.

O progresso é salvo automaticamente no navegador (`localStorage`). Se o armazenamento não estiver disponível, um aviso aparece; nessa situação, não feche a página. Não são coletados nem enviados dados. Reiniciar apaga apenas a partida deste jogo.

## Arquivos

- `index.html`: estrutura e navegação.
- `styles.css`: interface responsiva e controles touch.
- `rules.js`: regras e cálculos, independentes da interface.
- `game.js`: telas, turnos, tutorial e persistência.
- `tests/rules.test.cjs`: testes automatizados das regras.

## Verificar

Com Node.js 18 ou mais recente:

```sh
node --test tests/rules.test.cjs
```

O teste de interface `tests/browser.cjs` é opcional e usa Playwright com Chromium. Com esses recursos instalados no ambiente de desenvolvimento, execute `node tests/browser.cjs`. Ele abre o próprio `index.html`, simula toque e verifica uma partida completa, recuperação offline e tamanhos de tela. As variáveis opcionais `PLAYWRIGHT_MODULE` e `CHROMIUM_PATH` permitem usar instalações externas; `SCREENSHOT_DIR` permite salvar imagens em uma pasta existente.

### Checklist no equipamento touch

- Criar uma mesa, editar nomes e operar os controles +/− sem teclado.
- Planejar receitas diferentes; consultar a ajuda e voltar sem perder os dados.
- Cancelar uma compra e conferir que o saldo não mudou.
- Confirmar uma compra com dois toques rápidos e conferir que foi cobrada uma vez.
- Recarregar após um sorteio e conferir que ele não é repetido.
- Completar receitas e conferir a rotação, os saldos e o placar.
- Encerrar um participante e conferir que os demais continuam.
- Testar orientações e tamanhos de tela disponíveis no computador.
- Fazer várias partidas para avaliar se os bônus favorecem demais alguma receita.
