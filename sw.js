/* ==========================================================
   SERVICE WORKER — O QUE FALTAVA PARA INSTALAR DE VERDADE

   O Android so oferece "instalar aplicativo" quando a pagina tem TRES
   coisas: manifesto, HTTPS valido e um service worker registrado. Sem o
   service worker o Chrome cria apenas um ATALHO — aquele com a bolinha
   do Google no canto, que abre dentro do navegador com barra de
   endereco e tudo.

   Este arquivo existe para satisfazer esse requisito, e nada mais.

   CUIDADO DELIBERADO: ele NAO guarda a pagina nem o programa. Ja
   passamos por isso hoje — o celular servindo a versao de ontem
   enquanto a correcao estava no ar, e a loja sem entender por que "nao
   mudou nada". Um service worker que guarda tudo transformaria aquele
   incomodo em problema permanente: a versao velha ficaria presa mesmo
   depois de recarregar.

   A regra aqui e simples: sempre buscar da rede. So se a rede falhar —
   o celular sem sinal no meio da loja — devolve a ultima copia, para o
   franqueado ao menos ver os numeros que ja tinha carregado.
   ========================================================== */
const CACHE = 'joia-gestao-v9';

/* assume o controle assim que instala, sem esperar a aba fechar */
self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* apaga as copias de versoes anteriores */
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;

  /* nao mexe em nada que nao seja leitura simples da propria origem:
     as chamadas ao banco passam direto, sem cache nenhum */
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      /* A REDE MANDA. Sempre. */
      const resp = await fetch(req, { cache: 'no-store' });
      if (resp && resp.status === 200) {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      }
      return resp;
    } catch (err) {
      /* sem rede: devolve o que tiver guardado, para nao ficar tela branca */
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      throw err;
    }
  })());
});
