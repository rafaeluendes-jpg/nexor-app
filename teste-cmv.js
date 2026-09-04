/* ==========================================================
   CMV NOS MAIS VENDIDOS

   Ordem do Rafael (04/09/2026): mostrar, embaixo de cada produto do Top 5,
   o CMV = custo da ficha técnica × quantidade vendida no período — sem
   mexer em posição, nome, quantidade, faturamento ou barra.

   Este teste roda a função REAL blocoMaisVendidos do app.js.

   Rodar:  node teste-cmv.js
   ========================================================== */
const fs = require('fs');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');

function pegar(nome) {
  const i = app.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei ' + nome + ' no app.js');
  let j = app.indexOf('{', i), n = 0, f = j;
  for (; f < app.length; f++) {
    if (app[f] === '{') n++;
    else if (app[f] === '}') { n--; if (!n) { f++; break; } }
  }
  return app.slice(i, f);
}

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* globais que a função enxerga */
global.money = new Function(pegar('money') + '\nreturn money;')();
global.E = new Function(pegar('E') + '\nreturn E;')();
global.nomePeriodo = function () { return 'Este mês'; };
global.D = { produtos: [
  { id: 'p_copoM', nome: 'Copo M', ficha_id: 'f1', custo: 4.8939 },
  { id: 'p_copoP', nome: 'Copo P', ficha_id: 'f2', custo: 3.7478 },
  { id: 'p_agua',  nome: 'Água',   ficha_id: null,  custo: 0 }      /* sem ficha */
]};
const blocoMaisVendidos = new Function('return (' + pegar('blocoMaisVendidos') + ')')();

/* período com vendas reais montadas */
const peds = [
  { itens: [ { nome: 'Copo M', produto_id: 'p_copoM', qtd: 2, total: 40 },
             { nome: 'Copo P', produto_id: 'p_copoP', qtd: 1, total: 15 } ] },
  { itens: [ { nome: 'Copo M', produto_id: 'p_copoM', qtd: 1, total: 20 },
             { nome: 'Água',   produto_id: 'p_agua',  qtd: 5, total: 25 } ] }
];
const html = blocoMaisVendidos(peds);

console.log('\n── 1. O CMV é custo da ficha × quantidade vendida\n');
/* Copo M: 3 un × 4,8939 = 14,6817 → 14,68 */
t('Copo M (3 vendidos) mostra CMV R$ 14,68', /CMV: R\$ 14,68/.test(html), html);
/* Copo P: 1 un × 3,7478 = 3,7478 → 3,75 */
t('Copo P (1 vendido) mostra CMV R$ 3,75', /CMV: R\$ 3,75/.test(html), html);

console.log('\n── 2. Produto sem ficha não finge custo — mostra "—"\n');
t('Água (sem ficha) mostra CMV —', /Água[\s\S]*?CMV: —/.test(html), html);

console.log('\n── 3. O que já existia continua igual\n');
t('a posição aparece', /class="pos">1</.test(html));
t('a quantidade vendida aparece (Copo M = 3)', /<b>3<\/b>/.test(html));
t('o faturamento aparece (Copo M = 60,00)', /R\$ 60,00/.test(html));
t('a barra continua existindo', /class="barra"/.test(html));
t('o CMV entra na coluna do nome, não na dos números',
  /class="linN">[\s\S]*?class="cmv"/.test(html));

console.log('\n── 4. Sem produto_id, liga pelo nome (dado antigo)\n');
const semId = blocoMaisVendidos([{ itens: [{ nome: 'Copo M', qtd: 2, total: 40 }] }]);
t('Copo M sem produto_id ainda calcula CMV (2 × 4,8939 = 9,79)',
  /CMV: R\$ 9,79/.test(semId), semId);

console.log('\n════════════════════════════════════════════════════');
console.log(falhas ? `${falhas} de ${testes} FALHARAM` : `${testes} de ${testes} testes passaram`);
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);
