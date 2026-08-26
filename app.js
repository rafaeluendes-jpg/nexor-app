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
function hojeISO(){return new Date().toISOString().slice(0,10)}
function diasAtras(n){var d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)}
function mesAtual(){return hojeISO().slice(0,7)}
function mesPassado(){var d=new Date();d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7)}

/* ---------- login ---------- */
function telaLogin(erro){
  $('app').innerHTML='<div class="lg">'+
   '<div class="lgLogo"><b>N</b></div>'+
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
function pedidosFiltrados(){
  var ids=lojasDoUsuario().map(function(l){return l.id});
  return D.pedidos.filter(function(p){
    if(p.fase==='cancelado')return false;
    var sid=p.sucursal_id;
    if(sid&&ids.indexOf(sid)<0)return false;
    if(S.loja!=='todas'&&sid&&sid!==S.loja)return false;
    var d=String(p.data||'').slice(0,10);
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
    var d=String(p.data||'').slice(0,10);
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
      return String(p.data||'').slice(0,porMes?7:10)===chave;
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
