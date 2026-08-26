/* ==========================================================
   NEXOR GESTÃO — painel do franqueado
   ========================================================== */
var SB_URL='https://cevghkndzpzvnzwifhnm.supabase.co';
var SB_KEY='sb_publishable_tH04wQWnUjOUQWePZ0Bshw_RirDPUDY';
var sb=window.supabase.createClient(SB_URL,SB_KEY);
var TOKEN=null;
/* sessao vencida ou acesso desativado: volta para a entrada sem susto */
function sessaoCaiu(){
  TOKEN=null;U=null;
  try{localStorage.removeItem('nexor_app')}catch(e){}
  telaLogin();
  var e=document.getElementById('lgE');
  if(e)e.textContent='Sua sessão expirou. Entre de novo.';
}

/* ==========================================================
   O APLICATIVO AVISA QUANDO ESTA VELHO

   Nao dá para pedir que a loja limpe o cache do celular a cada
   correcao. Aqui ele pergunta ao servidor qual e a versao publicada; se
   for diferente da que esta rodando, mostra um aviso com um botao que
   recarrega ignorando o que estiver guardado.
   ========================================================== */
var VERSAO_APP='5';
async function conferirVersaoApp(){
  try{
    var r=await fetch('index.html?t='+Date.now(),{cache:'no-store'});
    var t=await r.text();
    var m=t.match(/app\.js\?v=(\d+)/);
    if(!m||m[1]===VERSAO_APP)return;
    if(document.getElementById('avVer'))return;
    var d=document.createElement('div');
    d.id='avVer';
    d.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:99;'+
      'background:#0E7C5A;color:#fff;padding:13px 15px;border-radius:12px;'+
      'display:flex;align-items:center;gap:12px;font-size:14px;'+
      'box-shadow:0 6px 24px rgba(0,0,0,.3)';
    d.innerHTML='<div style="flex:1">Tem uma versão nova do aplicativo.</div>'+
      '<button style="background:#fff;color:#0E7C5A;border:0;padding:9px 15px;'+
      'border-radius:9px;font-weight:700;font-size:14px" '+
      'onclick="location.reload(true)">Atualizar</button>';
    document.body.appendChild(d);
  }catch(e){}
}
setTimeout(conferirVersaoApp,3000);
setInterval(conferirVersaoApp,180000);
var U=null, D={lojas:[],pedidos:[],produtos:[]},
    S={loja:'',periodo:'hoje',carregando:false};

function $(id){return document.getElementById(id)}
function E(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function money(v){return (Number(v)||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function curto(v){
  v=Number(v)||0;
  if(v>=1000000)return (v/1000000).toFixed(1).replace('.',',')+'M';
  if(v>=1000)return (v/1000).toFixed(1).replace('.',',')+'k';
  return money(v);
}
/* ==========================================================
   AQUI ESTAVA O FATURAMENTO ZERADO

   `toISOString()` devolve a data em UTC, sempre. As 22:50 de Sao Paulo
   ja e dia 26 em Greenwich — entao o aplicativo perguntava "quais
   vendas sao do dia 26?" enquanto as vendas da noite estavam gravadas
   no dia 25, que e o dia da loja.

   Nenhuma batia. O app mostrava zero com a loja tendo vendido
   R$ 1.291,00, e o banco entregando os 383 pedidos corretamente.

   E o mesmo defeito que zerava o Faturamento no sistema (V167): a data
   vem certa do banco, e quem pergunta usa o calendario errado.

   Agora "hoje" e o dia da LOJA. E `data` ja chega pronto nesse mesmo
   fuso, entao os dois lados falam a mesma lingua.
   ========================================================== */
var FUSO_LOJA='America/Sao_Paulo';
function diaEm(d){
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:FUSO_LOJA,
      year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }catch(e){
    var l=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return l.toISOString().slice(0,10);
  }
}
function hojeISO(){ return diaEm(new Date()); }
function diasAtras(n){
  /* anda pelo dia da loja, nao pelo relogio do aparelho: quem abre o app
     as 22h nao pode ver "ontem" adiantado um dia */
  var base=new Date(hojeISO()+'T12:00:00');
  base.setDate(base.getDate()-n);
  var a=base.getFullYear(), m=String(base.getMonth()+1).padStart(2,'0'),
      dd=String(base.getDate()).padStart(2,'0');
  return a+'-'+m+'-'+dd;
}
function mesAtual(){return hojeISO().slice(0,7)}
function mesPassado(){
  var b=new Date(hojeISO()+'T12:00:00');
  b.setDate(1); b.setMonth(b.getMonth()-1);
  return b.getFullYear()+'-'+String(b.getMonth()+1).padStart(2,'0');
}

/* ---------- login ---------- */
function telaLogin(erro){
  $('app').innerHTML='<div class="lg">'+
   /* o "N" era do nome antigo. Agora usa o proprio icone do aplicativo,
      para a tela de entrada e o atalho no celular serem a mesma marca. */
   '<div class="lgLogo"><img src="icone.png?v=2" alt="Joia Gestão"></div>'+
   '<h1>Joia Gestão</h1><p>acompanhe sua loja de onde estiver</p>'+
   '<div class="lgCard">'+
    '<div class="cp"><label>Usuário</label><input id="lgU" autocapitalize="off" autocomplete="username"></div>'+
    '<div class="cp"><label>Senha</label><input id="lgP" type="password" autocomplete="current-password"></div>'+
    '<button class="btnP" onclick="entrar()">Entrar</button>'+
    '<div class="erro" id="lgE">'+E(erro||'')+'</div>'+
   '</div></div>';
  var p=$('lgP');
  if(p)p.onkeydown=function(e){if(e.key==='Enter')entrar()};
}
async function entrar(){
  var lg=($('lgU').value||'').trim().toLowerCase();
  var sn=$('lgP').value||'';
  if(!lg||!sn){$('lgE').textContent='Informe usuário e senha.';return;}
  $('lgE').textContent='entrando...';
  try{
    /* a senha nao sai mais do banco: quem confere e a funcao app_entrar,
       que devolve um token. O aparelho nunca ve a senha de ninguem. */
    var r=await sb.rpc('app_entrar',{p_login:lg,p_senha:sn});
    var d=r.data||{};
    if(r.error){ $('lgE').textContent='Não consegui entrar agora. Tente de novo.'; return; }
    if(d.erro==='bloqueado'){
      var q=new Date(d.ate);
      $('lgE').textContent='Muitas tentativas. Tente de novo às '+
        q.toLocaleTimeString('pt-BR').slice(0,5)+'.';return;
    }
    if(d.erro==='inativo'){$('lgE').textContent='Acesso desativado. Fale com o administrador.';return;}
    if(!d.token){$('lgE').textContent='Usuário ou senha inválidos.';return;}
    U=d.usuario; TOKEN=d.token;
    try{localStorage.setItem('nexor_app',JSON.stringify({token:TOKEN,usuario:U}))}catch(e){}
    carregar();
  }catch(e){ $('lgE').textContent='Não consegui entrar agora. Tente de novo.'; }
}
function sair(){
  try{ if(TOKEN)sb.rpc('app_sair',{p_token:TOKEN}); }catch(e){}
  try{localStorage.removeItem('nexor_app')}catch(e){}
  U=null;TOKEN=null;telaLogin();
}
/* ---------- dados ---------- */
async function carregar(){
  $('app').innerHTML='<div class="carreg"><div class="spin"></div>carregando os números...</div>';
  try{
    /* uma chamada so, e ela ja devolve apenas as lojas deste acesso.
       Antes eram tres consultas abertas, que qualquer um podia fazer. */
    var r=await sb.rpc('app_dados',{p_token:TOKEN,p_dias:400});
    var d=r.data||{};
    if(r.error)throw r.error;
    if(d.erro){ sessaoCaiu(); return; }
    D.lojas=d.lojas||[]; D.pedidos=d.pedidos||[]; D.produtos=d.produtos||[];
    var permitidas=lojasDoUsuario();
    if(!S.loja)S.loja=permitidas.length===1?permitidas[0].id:'todas';
    ULT=Date.now();
    render();
    ligarAtualizacao();
  }catch(e){
    $('app').innerHTML='<div class="vazio">Não consegui carregar os dados.<br><br>'+
      '<button class="btnP" style="max-width:200px;margin:0 auto" onclick="carregar()">Tentar de novo</button></div>';
  }
}
function lojasDoUsuario(){
  var s=(U&&U.sucursais)||[];
  if(U&&(U.tudo||U.mestre))return D.lojas;
  if(!s.length)return D.lojas;
  return D.lojas.filter(function(l){return s.indexOf(l.id)>=0||s.indexOf(l.ref_local)>=0});
}
function podeVer(chave){
  if(!U)return false;
  if(U.tudo||U.mestre)return true;
  var c=U.cartoes||[];
  if(!c.length)return true;
  return c.indexOf(chave)>=0;
}
/* ---------- filtro ---------- */
/* ==========================================================
   O DIA DA VENDA VEM PRONTO DO BANCO

   Este arquivo lia `p.data` e cortava os 10 primeiros caracteres. Dois
   problemas de uma vez: a coluna nao se chama `data` (e `data_venda`),
   entao vinha SEMPRE vazio — nenhum pedido batia com nenhum periodo, e
   o app mostrava faturamento zero com a loja vendendo o dia todo.

   E, mesmo que o nome estivesse certo, `data_venda` vem em UTC: venda
   das 21:43 apareceria no dia seguinte.

   Agora `app_dados` ja devolve o campo `data` como o DIA DA LOJA
   (America/Sao_Paulo), pronto para comparar. Esta funcao aceita o
   formato novo e ainda entende `data_venda`, para o caso de o aparelho
   estar com dados guardados do jeito antigo.
   ========================================================== */
function diaDoPedido(p){
  if(!p)return '';
  if(p.data&&String(p.data).length===10)return String(p.data);
  var v=p.data||p.data_venda||'';
  var t=String(v);
  if(!t)return '';
  if(t.length<=10)return t.slice(0,10);
  var d=new Date(t);
  if(isNaN(d))return t.slice(0,10);
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
      year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }catch(e){ return t.slice(0,10); }
}
function pedidosFiltrados(){
  var ids=lojasDoUsuario().map(function(l){return l.id});
  return D.pedidos.filter(function(p){
    if(p.fase==='cancelado')return false;
    var sid=p.sucursal_id;
    if(sid&&ids.indexOf(sid)<0)return false;
    if(S.loja!=='todas'&&sid&&sid!==S.loja)return false;
    var d=diaDoPedido(p);
    if(S.periodo==='hoje')return d===hojeISO();
    if(S.periodo==='ontem')return d===diasAtras(1);
    if(S.periodo==='7')return d>=diasAtras(6);
    if(S.periodo==='mes')return d.slice(0,7)===mesAtual();
    if(S.periodo==='passado')return d.slice(0,7)===mesPassado();
    if(S.periodo==='30')return d>=diasAtras(29);
    return true;
  });
}
function periodoAnterior(){
  var ids=lojasDoUsuario().map(function(l){return l.id});
  return D.pedidos.filter(function(p){
    if(p.fase==='cancelado')return false;
    var sid=p.sucursal_id;
    if(sid&&ids.indexOf(sid)<0)return false;
    if(S.loja!=='todas'&&sid&&sid!==S.loja)return false;
    var d=diaDoPedido(p);
    if(S.periodo==='hoje')return d===diasAtras(1);
    if(S.periodo==='ontem')return d===diasAtras(2);
    if(S.periodo==='7')return d>=diasAtras(13)&&d<diasAtras(6);
    if(S.periodo==='mes')return d.slice(0,7)===mesPassado();
    if(S.periodo==='30')return d>=diasAtras(59)&&d<diasAtras(29);
    return false;
  });
}

/* ---------- atualização ---------- */
var ULT=null, _tAtu=null;
function textoAtualizado(){
  if(!ULT)return 'carregando...';
  var seg=Math.round((Date.now()-ULT)/1000);
  if(seg<60)return 'atualizado agora';
  if(seg<3600)return 'atualizado há '+Math.round(seg/60)+' min';
  return 'atualizado às '+new Date(ULT).toLocaleTimeString('pt-BR').slice(0,5);
}
async function atualizar(silencioso){
  var bt=document.getElementById('btAtu');
  if(bt)bt.classList.add('girando');
  try{
    var r=await sb.rpc('app_dados',{p_token:TOKEN,p_dias:400});
    var d=r.data||{};
    if(d.erro){ sessaoCaiu(); return; }
    if(d.lojas)D.lojas=d.lojas;
    if(d.pedidos)D.pedidos=d.pedidos;
    if(d.produtos)D.produtos=d.produtos;
    ULT=Date.now();
    render();
  }catch(e){}
  var b2=document.getElementById('btAtu');
  if(b2)b2.classList.remove('girando');
}
/* atualiza sozinho a cada minuto e ao voltar para o aplicativo */
function ligarAtualizacao(){
  if(_tAtu)clearInterval(_tAtu);
  _tAtu=setInterval(function(){
    if(document.visibilityState==='visible'&&U)atualizar(true);
  },60000);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'&&U){
      var el=document.getElementById('tpAt');
      if(el)el.textContent=textoAtualizado();
      if(!ULT||Date.now()-ULT>30000)atualizar(true);
    }
  });
  /* relógio do "atualizado há X" */
  setInterval(function(){
    var el=document.getElementById('tpAt');
    if(el)el.textContent=textoAtualizado();
  },20000);
}
/* puxar para atualizar */
var _y0=null;
document.addEventListener('touchstart',function(e){
  if(window.scrollY<=0)_y0=e.touches[0].clientY; else _y0=null;
},{passive:true});
document.addEventListener('touchmove',function(e){
  if(_y0===null||!U)return;
  var d=e.touches[0].clientY-_y0;
  var el=document.getElementById('tpAt');
  if(d>70&&el){el.textContent='solte para atualizar';}
},{passive:true});
document.addEventListener('touchend',function(e){
  if(_y0===null||!U){_y0=null;return;}
  var el=document.getElementById('tpAt');
  if(el&&el.textContent==='solte para atualizar')atualizar();
  _y0=null;
});

/* ---------- tela ---------- */
var PERIODOS=[['hoje','Hoje'],['ontem','Ontem'],['7','7 dias'],
  ['mes','Este mês'],['passado','Mês passado'],['30','30 dias']];

function render(){
  var lojas=lojasDoUsuario();
  var peds=pedidosFiltrados();
  var ant=periodoAnterior();
  var tot=peds.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var totA=ant.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var vari=totA?((tot-totA)/totA*100):0;
  var ent=peds.filter(function(p){return p.tipo==='entrega'});
  var bal=peds.filter(function(p){return p.tipo!=='entrega'});
  var vEnt=ent.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var vBal=bal.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var taxas=peds.reduce(function(a,p){return a+(Number(p.taxa)||0)},0);
  var clientes={};peds.forEach(function(p){if(p.cliente_id)clientes[p.cliente_id]=true});

  $('app').innerHTML=
   '<div class="topo"><div class="topoIn">'+
    '<div class="tpL">'+
     '<div class="tpAv">'+E((U.nome||'?').charAt(0).toUpperCase())+'</div>'+
     '<div class="tpN"><b>'+E(U.nome)+'</b><span>Joia Gestão</span></div>'+
     '<button class="tpAtu" onclick="atualizar()" id="btAtu" title="atualizar">'+
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" '+
      'stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/>'+
      '<path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg></button>'+
     '<button class="tpSair" onclick="sair()">sair</button>'+
    '</div>'+
    (lojas.length>1
     ?'<select class="lojaSel" onchange="S.loja=this.value;render()">'+
       '<option value="todas"'+(S.loja==='todas'?' selected':'')+'>Todas as lojas</option>'+
       lojas.map(function(l){
         return '<option value="'+l.id+'"'+(S.loja===l.id?' selected':'')+'>'+E(l.nome)+'</option>';
       }).join('')+'</select>'
     :'<div class="lojaSel" style="pointer-events:none;background-image:none">'+
       E((lojas[0]||{}).nome||'sua loja')+'</div>')+
   '<div class="tpAtualizado" id="tpAt">'+textoAtualizado()+'</div>'+
   '</div></div>'+

   '<div class="esc">'+
   '<div class="per">'+PERIODOS.map(function(p){
     return '<button class="perB'+(S.periodo===p[0]?' on':'')+'" '+
     'onclick="S.periodo=\''+p[0]+'\';render()">'+p[1]+'</button>';
   }).join('')+'</div>'+

   '<div class="corpo">'+
   '<div class="destaque">'+
    '<span>Faturamento · '+E(nomePeriodo())+'</span>'+
    '<b>R$ '+money(tot)+'</b>'+
    (totA?'<div class="var">'+(vari>=0?'▲':'▼')+' '+
      Math.abs(vari).toFixed(1).replace('.',',')+'% · '+textoComparacao()+'</div>':'')+
   '</div>'+

   '<div class="grade2">'+
    '<div class="mini"><span>Pedidos</span><b>'+peds.length+'</b>'+
     (ant.length?'<small>'+(peds.length-ant.length>=0?'+':'')+(peds.length-ant.length)+
      ' vs '+textoComparacao()+'</small>':'')+'</div>'+
    '<div class="mini"><span>Ticket médio</span><b>R$ '+money(peds.length?tot/peds.length:0)+'</b></div>'+
    '<div class="mini"><span>Entregas</span><b>'+ent.length+'</b>'+
     '<small>R$ '+curto(vEnt)+'</small></div>'+
    '<div class="mini"><span>Frente de caixa</span><b>'+bal.length+'</b>'+
     '<small>R$ '+curto(vBal)+'</small></div>'+
   '</div>'+

   (peds.length?blocoMaisVendidos(peds):'')+
   (peds.length?blocoEvolucao():'')+
   (peds.length?blocoDetalhe(peds,vEnt,vBal,taxas,Object.keys(clientes).length):'')+
   (!peds.length?'<div class="bloco"><div class="vazio">Nenhuma venda '+
     E(nomePeriodo().toLowerCase())+'.</div></div>':'')+
   '</div></div>';
  mostraInstalar();
}
function nomePeriodo(){
  var p=PERIODOS.find(function(x){return x[0]===S.periodo});
  return p?p[1]:'';
}
function textoComparacao(){
  return {hoje:'ontem',ontem:'anteontem','7':'7 dias antes',mes:'mês passado',
    '30':'30 dias antes'}[S.periodo]||'antes';
}
/* mais vendidos */
function blocoMaisVendidos(peds){
  var por={};
  peds.forEach(function(p){
    (p.itens||[]).forEach(function(i){
      var n=i.nome||'—';
      por[n]=por[n]||{qtd:0,valor:0};
      por[n].qtd+=Number(i.qtd)||0;
      por[n].valor+=Number(i.total)||0;
    });
  });
  var lista=Object.keys(por).map(function(n){return {nome:n,qtd:por[n].qtd,valor:por[n].valor}})
    .sort(function(a,b){return b.qtd-a.qtd}).slice(0,5);
  if(!lista.length)return '';
  var max=lista[0].qtd||1;
  return '<div class="bloco"><div class="blH"><b>Mais vendidos</b>'+
   '<span>'+E(nomePeriodo().toLowerCase())+'</span></div>'+
   lista.map(function(x,k){
     return '<div class="lin"><div class="pos">'+(k+1)+'</div>'+
      '<div class="linN"><b>'+E(x.nome)+'</b>'+
       '<div class="barra"><i style="width:'+(x.qtd/max*100)+'%"></i></div></div>'+
      '<div class="linV"><b>'+x.qtd+'</b><small>R$ '+curto(x.valor)+'</small></div></div>';
   }).join('')+'</div>';
}
/* evolução */
function blocoEvolucao(){
  var ids=lojasDoUsuario().map(function(l){return l.id});
  var dias=[],hoje=new Date();
  var n=(S.periodo==='mes'||S.periodo==='30'||S.periodo==='passado')?12:7;
  var porMes=(S.periodo==='mes'||S.periodo==='passado');
  for(var i=n-1;i>=0;i--){
    var d=new Date();
    if(porMes)d.setMonth(hoje.getMonth()-i); else d.setDate(hoje.getDate()-i);
    var chave=porMes?d.toISOString().slice(0,7):d.toISOString().slice(0,10);
    var rot=porMes?['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][d.getMonth()]
      :String(d.getDate());
    var v=D.pedidos.filter(function(p){
      if(p.fase==='cancelado')return false;
      var sid=p.sucursal_id;
      if(sid&&ids.indexOf(sid)<0)return false;
      if(S.loja!=='todas'&&sid&&sid!==S.loja)return false;
      return diaDoPedido(p).slice(0,porMes?7:10)===chave;
    }).reduce(function(a,p){return a+(Number(p.total)||0)},0);
    dias.push({rot:rot,v:v});
  }
  var max=Math.max.apply(null,dias.map(function(x){return x.v}).concat([1]));
  return '<div class="bloco"><div class="blH"><b>Evolução</b>'+
   '<span>'+(porMes?'últimos 12 meses':'últimos 7 dias')+'</span></div>'+
   '<div class="grafB">'+dias.map(function(d){
     return '<div class="gCol">'+
      '<div class="gBar" style="height:'+Math.max(3,(d.v/max)*100)+'%" title="R$ '+money(d.v)+'"></div>'+
      '<div class="gLb">'+d.rot+'</div></div>';
   }).join('')+'</div></div>';
}
/* detalhamento */
function blocoDetalhe(peds,vEnt,vBal,taxas,nCli){
  var tot=vEnt+vBal;
  var porPag={};
  peds.forEach(function(p){
    (p.pagamentos||[]).forEach(function(g){
      var n=g.forma||g.nome||'Outros';
      porPag[n]=(porPag[n]||0)+(Number(g.valor)||0);
    });
  });
  var pags=Object.keys(porPag).map(function(n){return {nome:n,valor:porPag[n]}})
    .sort(function(a,b){return b.valor-a.valor});
  return '<div class="bloco"><div class="blH"><b>Detalhamento</b></div>'+
   '<div class="lin"><div class="linN"><b>Entregas</b>'+
    '<div class="barra"><i style="width:'+(tot?vEnt/tot*100:0)+'%"></i></div></div>'+
    '<div class="linV"><b>R$ '+curto(vEnt)+'</b><small>'+(tot?(vEnt/tot*100).toFixed(0):0)+'%</small></div></div>'+
   '<div class="lin"><div class="linN"><b>Frente de caixa</b>'+
    '<div class="barra"><i style="width:'+(tot?vBal/tot*100:0)+'%"></i></div></div>'+
    '<div class="linV"><b>R$ '+curto(vBal)+'</b><small>'+(tot?(vBal/tot*100).toFixed(0):0)+'%</small></div></div>'+
   (taxas?'<div class="lin"><div class="linN"><b>Taxas de entrega</b></div>'+
    '<div class="linV"><b>R$ '+curto(taxas)+'</b></div></div>':'')+
   (nCli?'<div class="lin"><div class="linN"><b>Clientes atendidos</b></div>'+
    '<div class="linV"><b>'+nCli+'</b></div></div>':'')+
   (pags.length?'<div class="blH" style="margin-top:16px"><b>Formas de pagamento</b></div>'+
    pags.map(function(p){
      return '<div class="lin"><div class="linN"><b>'+E(p.nome)+'</b></div>'+
      '<div class="linV"><b>R$ '+curto(p.valor)+'</b></div></div>';
    }).join(''):'')+
   '</div>';
}
/* ---------- instalar como aplicativo ---------- */
var _instalar=null;
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();_instalar=e;mostraInstalar();
});
function mostraInstalar(){
  if(window.matchMedia('(display-mode: standalone)').matches)return;
  if(localStorage.getItem('nexor_app_dispensou'))return;
  if(document.getElementById('barraInst'))return;
  var iOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  if(!_instalar&&!iOS)return;
  var d=document.createElement('div');
  d.id='barraInst';d.className='instala';
  d.innerHTML='<div style="flex:1"><b>Instalar o Joia Gestão</b>'+
   '<span>'+(iOS?'toque em Compartilhar e depois em "Adicionar à Tela de Início"'
     :'fica com ícone próprio no seu celular')+'</span></div>'+
   (iOS?'':'<button onclick="instalarApp()">Instalar</button>')+
   '<button class="x" onclick="dispensarInst()">&times;</button>';
  document.body.appendChild(d);
}
function instalarApp(){
  if(!_instalar)return;
  _instalar.prompt();
  _instalar.userChoice.then(function(){ _instalar=null;dispensarInst(); });
}
function dispensarInst(){
  try{localStorage.setItem('nexor_app_dispensou','1')}catch(e){}
  var d=document.getElementById('barraInst');if(d)d.remove();
}
/* ---------- início ---------- */
(async function(){
  try{
    var g=JSON.parse(localStorage.getItem('nexor_app')||'null');
    if(g&&g.token){
      /* a senha nao fica mais guardada no aparelho — so o token, que vence
         em 30 dias e pode ser cortado pelo banco a qualquer momento */
      TOKEN=g.token; U=g.usuario||null;
      var r=await sb.rpc('app_dados',{p_token:TOKEN,p_dias:400});
      var d=r.data||{};
      if(!r.error&&!d.erro){
        D.lojas=d.lojas||[]; D.pedidos=d.pedidos||[]; D.produtos=d.produtos||[];
        var permitidas=lojasDoUsuario();
        if(!S.loja)S.loja=permitidas.length===1?permitidas[0].id:'todas';
        ULT=Date.now(); render(); ligarAtualizacao(); return;
      }
      TOKEN=null;U=null;
      try{localStorage.removeItem('nexor_app')}catch(e){}
    }
  }catch(e){}
  telaLogin();
})();
