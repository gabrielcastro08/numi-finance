# PROMPT — Identidade Visual: Numi

## CONTEXTO

Este é um PWA de controle financeiro. Os arquivos de deploy estão em
`controle-financeiro-deploy/`. **Trabalhe sempre dentro dessa subpasta.**
Alterações são **exclusivamente visuais e de configuração de PWA** —
não tocar em nenhuma função de dados, Supabase, autenticação ou lógica de estado.

### Arquivos de logo disponíveis em `controle-financeiro-deploy/assets/`:
- `logo-dark.png`         — logo Numi escura (usar em fundos claros)
- `logo-light.png`        — logo Numi clara/creme (usar em fundos escuros/verdes)
- `icon-money.png`        — ilustração dinheiro voando sem sombra (para favicon)
- `icon-money-white.png`  — ilustração dinheiro voando com fundo branco (base para ícones do app)

---

## TAREFA 1 — Nova paleta de cores

No arquivo `controle-financeiro-deploy/index.html`, substituir as variáveis CSS
de verde nas variáveis `:root` e em todos os valores hardcoded no CSS mobile e
nos estilos inline do JS:

```
--green:      #4a7c59  →  #1b854f
--green2:     #3d6b4a  →  #17703f
--green3:     #2f5a3b  →  #115c32
--green-dim:  #e8f2eb  →  #e0f2e9
--green-glow: rgba(74,124,89,0.07)  →  rgba(27,133,79,0.08)
```

Buscar e substituir também todas as ocorrências hardcoded de `#4a7c59`,
`#3d6b4a`, `#2f5a3b`, `#e8f2eb` em todo o arquivo.
A paleta bege (`#faf6f0`, `#f4ede2`, `#ece4d8`) e vermelha (`#b54d3a`) **não muda**.

Ao terminar: mostrar um diff resumido com quantas substituições foram feitas.

---

## TAREFA 2 — Substituição do nome textual por logo

**`<title>` e meta tags** em `index.html`:
```html
<title>Numi</title>
<meta name="apple-mobile-web-app-title" content="Numi">
```

**Desktop — sidebar** (substituir o bloco `.sidebar-logo` inteiro):
```html
<div class="sidebar-logo">
  <img src="assets/logo-dark.png" alt="Numi"
       style="height:30px;width:auto;display:block;">
</div>
```
Remover os elementos `<span>` e `<small>` que existiam dentro do bloco.

**Qualquer string "Controle Financeiro", "fin//ctrl", "controle financeiro"**
restante na interface (textos visíveis, não comentários de código) → substituir por "Numi".

Ao terminar: listar todos os pontos substituídos.

---

## TAREFA 3 — Ícones do app

Gerar três novos arquivos de ícone com Python + Pillow.
Fundo: gradiente vertical `#115c32` → `#1b854f` com cantos arredondados (22% do tamanho).
Logo: `controle-financeiro-deploy/assets/icon-money-white.png` centralizada
com padding de 12%, removendo o fundo branco antes de compor.

```python
from PIL import Image, ImageDraw
import numpy as np, os

os.makedirs('controle-financeiro-deploy/icons', exist_ok=True)

def make_icon(size, out_path):
    # Gradiente de fundo
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    top_c, bot_c = (17, 92, 50), (27, 133, 79)
    for y in range(size):
        t = y / (size - 1)
        arr[y, :] = [int(top_c[i]+(bot_c[i]-top_c[i])*t) for i in range(3)] + [255]
    img = Image.fromarray(arr, 'RGBA')

    # Máscara de cantos arredondados
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=int(size*.22), fill=255)

    # Logo com remoção de fundo branco
    pad = int(size * 0.12)
    logo_size = size - pad * 2
    logo = Image.open('controle-financeiro-deploy/assets/icon-money-white.png').convert('RGBA')
    data = np.array(logo)
    white = (data[:,:,0] > 220) & (data[:,:,1] > 220) & (data[:,:,2] > 220)
    data[white, 3] = 0
    logo = Image.fromarray(data)
    ratio = min(logo_size/logo.width, logo_size/logo.height)
    logo = logo.resize((int(logo.width*ratio), int(logo.height*ratio)), Image.LANCZOS)
    x, y = (size - logo.width) // 2, (size - logo.height) // 2
    img.paste(logo, (x, y), logo)

    # Aplicar máscara de cantos
    result = Image.new('RGBA', (size, size), (0,0,0,0))
    result.paste(img, mask=mask)
    result.save(out_path, 'PNG')
    print(f'Gerado: {out_path}')

make_icon(192, 'controle-financeiro-deploy/icons/icon-192.png')
make_icon(512, 'controle-financeiro-deploy/icons/icon-512.png')
make_icon(180, 'controle-financeiro-deploy/icons/apple-touch-icon.png')
```

**Após gerar: mostrar preview de `icons/icon-192.png` e pausar para aprovação.**

---

## TAREFA 4 — Favicon

Gerar `controle-financeiro-deploy/icons/favicon.ico` a partir de
`assets/icon-money.png` (sem sombra):

```python
from PIL import Image
img = Image.open('controle-financeiro-deploy/assets/icon-money.png').convert('RGBA')
sizes = [(16,16),(32,32),(48,48)]
imgs = [img.resize(s, Image.LANCZOS) for s in sizes]
imgs[0].save('controle-financeiro-deploy/icons/favicon.ico',
             format='ICO', sizes=sizes)
print('favicon.ico gerado')
```

Adicionar no `<head>` do `index.html` (logo após as meta tags existentes):
```html
<link rel="icon" type="image/x-icon" href="icons/favicon.ico">
```

---

## TAREFA 5 — Splash screen

Inserir logo após a tag `<body>` em `index.html`:

```html
<div id="numi-splash" style="
  position:fixed;inset:0;z-index:99999;
  background:linear-gradient(160deg,#115c32 0%,#1b854f 100%);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  transition:opacity .4s ease;
">
  <img src="assets/logo-light.png" alt="Numi"
       style="height:72px;width:auto;animation:splashPulse 1.2s ease-in-out infinite alternate;">
  <div style="margin-top:28px;width:36px;height:3px;border-radius:2px;
              background:rgba(255,255,255,.25);overflow:hidden;">
    <div style="height:100%;background:#fff;border-radius:2px;
                animation:splashBar 1.4s ease-in-out infinite;"></div>
  </div>
</div>

<style>
@keyframes splashPulse {
  from { opacity:.85; transform:scale(.97); }
  to   { opacity:1;   transform:scale(1);   }
}
@keyframes splashBar {
  0%   { width:0%;   margin-left:0; }
  50%  { width:100%; margin-left:0; }
  100% { width:0%;   margin-left:100%; }
}
</style>
```

Localizar o bloco `(async()=>{...})()` de inicialização no JS e adicionar
logo após o `await loadState()`:

```javascript
// Esconder splash após carregar dados
const splash = document.getElementById('numi-splash');
if (splash) {
  splash.style.opacity = '0';
  setTimeout(() => splash.remove(), 420);
}
```

---

## TAREFA 6 — Auto-update do PWA

### 6a. Substituir conteúdo completo de `controle-financeiro-deploy/sw.js`:

```javascript
const CACHE = 'numi-v1';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co') ||
      e.request.url.includes('anthropic.com')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
      return cached || fresh;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
```

### 6b. Banner de atualização em `index.html`

Adicionar no `<body>`, antes do `#numi-splash`:

```html
<div id="update-banner" style="
  display:none;position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
  background:#1b854f;color:#fff;border-radius:14px;padding:12px 18px;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;
  box-shadow:0 4px 20px rgba(0,0,0,.18);z-index:9998;
  align-items:center;gap:12px;white-space:nowrap;
">
  <span>🌿 Nova versão disponível</span>
  <button onclick="applyUpdate()" style="
    background:#fff;color:#1b854f;border:none;border-radius:8px;
    padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;
    font-family:'Plus Jakarta Sans',sans-serif;
  ">Atualizar</button>
</div>
```

Adicionar no JS, antes do bloco `(async()=>{...})()`:

```javascript
// ===== AUTO-UPDATE PWA =====
let _newSW = null;

function applyUpdate() {
  if (_newSW) {
    _newSW.postMessage('SKIP_WAITING');
    _newSW.addEventListener('statechange', () => {
      if (_newSW.state === 'activated') window.location.reload();
    });
  } else {
    window.location.reload();
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      _newSW = reg.installing;
      _newSW.addEventListener('statechange', () => {
        if (_newSW.state === 'installed' && navigator.serviceWorker.controller) {
          const banner = document.getElementById('update-banner');
          if (banner) banner.style.display = 'flex';
        }
      });
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
```

---

## TAREFA 7 — Atualizar `manifest.json`

Substituir conteúdo completo de `controle-financeiro-deploy/manifest.json`:

```json
{
  "name": "Numi",
  "short_name": "Numi",
  "description": "Controle financeiro pessoal",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#115c32",
  "theme_color": "#1b854f",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

## TAREFA 8 — CHANGELOG.md

Criar `controle-financeiro-deploy/CHANGELOG.md`:

```markdown
# Changelog — Numi

## [1.1.0] — identidade visual
- Nova paleta de cores alinhada ao verde do logo Numi
- Logo Numi substitui texto "fin//ctrl" / "Controle Financeiro"
- Novos ícones do app com fundo verde gradiente
- Splash screen na abertura do app
- Favicon no browser
- Auto-update: banner "nova versão disponível" sem precisar reinstalar o app

## [1.0.0] — lançamento inicial
- Dashboard, Receitas, Despesas, Meses, Recorrentes, Categorias
- Interface desktop + mobile (PWA)
- Sincronização via Supabase
```

---

## ORDEM DE EXECUÇÃO

1. Tarefa 1 — cores → mostrar diff resumido
2. Tarefa 2 — nome/logo → listar pontos substituídos
3. Tarefa 3 — gerar ícones → **mostrar preview `icons/icon-192.png` e pausar**
4. Aguardar aprovação → executar Tarefas 4, 5, 6, 7, 8 em sequência
5. Ao final: listar todos os arquivos modificados/criados dentro de `controle-financeiro-deploy/`

---

## ESTRUTURA ESPERADA AO FINAL

```
controle-financeiro-deploy/
├── index.html
├── manifest.json
├── sw.js
├── CHANGELOG.md
├── assets/
│   ├── logo-dark.png
│   ├── logo-light.png
│   ├── icon-money.png
│   └── icon-money-white.png
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    ├── apple-touch-icon.png
    └── favicon.ico
```

Os arquivos `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` da raiz
podem ser mantidos por compatibilidade ou removidos — não interferem.

---

## RESTRIÇÕES ABSOLUTAS

- **Não tocar** em nenhuma função JS de dados (`loadState`, `saveState`,
  `getMT`, handlers de transação, Supabase calls)
- **Não tocar** no schema ou dados do Supabase
- **Não alterar** a lógica `IS_MOBILE`
- **Não alterar** nenhuma estrutura HTML além dos pontos explicitados acima
- Se houver dúvida sobre se uma alteração é "só visual", **perguntar antes de fazer**
