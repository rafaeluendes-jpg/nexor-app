/* ==========================================================
   UMA LINGUA SO PARA DINHEIRO

   Ordem do Rafael em 31/08/2026: "nada de k, colocasse o dinheiro
   normal, vamos supor cem virgula zero zero... porque senao fica cada
   um de um jeito, a gente precisa falar sempre a mesma lingua".

   O aplicativo falava tres dialetos na mesma tela:
     · "R$ 1.234,56" no total do dia;
     · "R$ 1,2k"     na linha de Entrega e Balcao, no ranking de lojas
                     e nas formas de pagamento;
     · "1,3k"        em cima da barra do grafico de evolucao.

   Agora `money()` e a unica funcao. `curto()` e `curtoGraf()` foram
   REMOVIDAS — e nao viradas atalho para `money()`, porque funcao que so
   repassa e a porta por onde a abreviacao volta na proxima correcao.

   Rodar:  node teste-dinheiro.js
   ========================================================== */
const fs = require('fs');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');

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

const money = new Function(pegar('money') + '\nreturn money;')();

console.log('\n── 1. Dinheiro se escreve por extenso, sempre\n');

t('cem reais viram "100,00"', money(100) === '100,00', money(100));
t('mil e duzentos viram "1.200,00", não "1,2k"',
  money(1200) === '1.200,00', money(1200));
t('quinze mil viram "15.230,00", não "15k"',
  money(15230) === '15.230,00', money(15230));
t('um milhão vira "1.000.000,00", não "1,0M"',
  money(1000000) === '1.000.000,00', money(1000000));
t('os centavos vêm sempre, mesmo redondos', money(5) === '5,00', money(5));
t('e o zero também', money(0) === '0,00', money(0));
t('texto ou nulo não estoura', money(null) === '0,00' && money(undefined) === '0,00');

console.log('\n── 2. As abreviações saíram do arquivo\n');

t('`curto()` não existe mais', !/function\s+curto\s*\(/.test(app));
t('`curtoGraf()` não existe mais', !/function\s+curtoGraf\s*\(/.test(app));
t('e ninguém ficou chamando o que não existe',
  !/[^a-zA-Z]curto\s*\(/.test(app) && !/curtoGraf\s*\(/.test(app),
  (app.match(/curtoG?r?a?f?\s*\(/g) || []).join(' | '));

/* o "k" e o "M" nao podem voltar por dentro de nenhuma conta */
const semComentario = app.replace(/\/\*[\s\S]*?\*\//g, '');
t('nenhuma conta divide por mil para abreviar',
  !/\/\s*1000\s*\)\s*\.toFixed/.test(semComentario),
  (semComentario.match(/\/\s*1000[^;]*/g) || []).join(' | '));
t('não sobrou nenhum "+\'k\'" nem "+\'M\'" no código',
  !/\+\s*'k'/.test(semComentario) && !/\+\s*'M'/.test(semComentario));

console.log('\n── 3. O gráfico mostra o valor por extenso\n');

const ev = pegar('blocoEvolucao');
t('a barra é rotulada com money()', /class="gVl">'\+\(d\.v>0\?E\(money\(d\.v\)\)/.test(ev),
  (ev.match(/gVl[^+]*\+[^+]*/) || [''])[0]);

/* medido no navegador em 390 px: a faixa tem 362 uteis e o maior rotulo
   pede 45. Sete dias cabem; doze meses rolam DENTRO da faixa. */
t('a faixa do gráfico tem rolagem própria, para o valor inteiro caber',
  /\.grafB\{[^}]*overflow-x:auto/.test(html));
t('e cada coluna tem largura mínima para não espremer o número',
  /\.gCol\{[^}]*min-width:46px/.test(html));
t('a folga entre colunas foi ajustada para os 7 dias caberem sem rolar',
  /\.grafB\{[^}]*gap:4px/.test(html));

console.log('\n── 4. A versão subiu, senão o celular serve a antiga\n');

const v = +((html.match(/app\.js\?v=(\d+)/) || [0, 0])[1]);
const c = +((sw.match(/joia-gestao-v(\d+)/) || [0, 0])[1]);
t('o index pede a versão nova do app.js', v >= 10, 'v=' + v);
t('e o cache do service worker subiu junto', c >= 10, 'v' + c);
t('as duas na MESMA versão — foi o defeito do aviso eterno', v === c, v + ' x ' + c);

console.log('\n════════════════════════════════════════════════════');
console.log(falhas ? `${falhas} de ${testes} FALHARAM` : `${testes} de ${testes} testes passaram`);
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);
