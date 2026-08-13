# Fatia da Vida

Landing page pública e painel administrativo para a confeitaria **Fatia da Vida**, voltada a encomendas de doces e bolos artesanais em Brasília, DF.

O projeto é uma aplicação estática: não há dependências locais, `package.json` ou etapa de build. O catálogo, as avaliações, o login e o upload de imagens usam Firebase diretamente do navegador; a publicação é feita pelo GitHub Pages.

## Funcionalidades

- Landing page responsiva com informações da marca, catálogo, avaliações e canais de contato.
- Catálogo público carregado do Firestore, com filtros de categorias dinâmicas.
- Galeria de imagens por produto, carrossel nos cards e lightbox com suporte a teclado.
- Encomenda de cada produto pelo WhatsApp, já com nome, preço e prazo no texto.
- Formulário público de avaliações, com seleção de estrelas, limite de caracteres, honeypot e intervalo local de um minuto entre envios.
- Moderação de avaliações no painel: aprovar ou excluir.
- Login administrativo por e-mail e senha do Firebase Authentication.
- CRUD de produtos, incluindo disponibilidade no catálogo, destaque, preço, prazo e múltiplas imagens.
- CRUD de categorias no painel. Categorias não podem ser excluídas enquanto houver produtos vinculados.
- Design system proprietário baseado em tokens CSS de cor, tipografia, espaçamento, raio, sombra e estados de foco.

## Tecnologias

- HTML, CSS e JavaScript ES Modules
- [Firebase v10.12.0](https://firebase.google.com/): Authentication, Cloud Firestore e Cloud Storage
- GitHub Actions e GitHub Pages
- Google Fonts: Playfair Display e Lato

## Estrutura

```text
.
├── admin/
│   ├── index.html            # Painel de catálogo, categorias e avaliações
│   └── login.html            # Autenticação administrativa
├── assets/
│   └── logo.png              # Logo usado no site e no painel
├── css/
│   ├── style.css             # Design tokens, reset e componentes globais
│   ├── catalog.css           # Estilos da landing page e do catálogo público
│   └── admin.css             # Estilos do painel administrativo
├── js/
│   ├── firebase.js           # Inicialização do Firebase por placeholders
│   ├── catalog.js            # Catálogo, filtros, carrossel e lightbox
│   ├── reviews.js            # Avaliações públicas
│   └── admin.js              # Autenticação, produtos, categorias e moderação
├── .github/workflows/deploy.yml # Deploy automático no GitHub Pages
├── firestore.rules           # Regras de acesso do Firestore
├── storage.rules             # Regras de acesso do Cloud Storage
├── index.html                # Landing page
├── robots.txt
└── sitemap.xml
```


## Executar localmente

Por ser um site estático, basta servi-lo por HTTP. Não abra o `index.html` diretamente no navegador, pois os módulos JavaScript precisam de um servidor local.

```powershell
python -m http.server 8000
```

Depois, acesse:

- Site público: `http://localhost:8000/`
- Painel: `http://localhost:8000/admin/`

O Firebase continuará apontando para o projeto configurado nas credenciais. Para desenvolvimento local, é possível preencher temporariamente os placeholders em `js/firebase.js`; nunca envie credenciais reais ao repositório.

## Configuração do Firebase

1. Crie ou selecione um projeto no Firebase.
2. Ative **Authentication > Sign-in method > E-mail/senha**.
3. Crie ao menos um usuário administrativo em **Authentication > Users**.
4. Crie o banco **Cloud Firestore**.
5. Ative o **Cloud Storage**.
6. Publique [firestore.rules](firestore.rules) e [storage.rules](storage.rules).
7. Configure os secrets do repositório para o deploy, conforme a seção seguinte.

### Secrets exigidos no GitHub Actions

O workflow substitui os placeholders de `js/firebase.js` no momento do deploy. Cadastre estes secrets em **Settings > Secrets and variables > Actions**:

| Secret | Origem no Firebase |
| --- | --- |
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

Não altere os valores `__FIREBASE_*__` versionados em `js/firebase.js`: eles são o mecanismo previsto para injeção segura no deploy.

## Modelo de dados

### `produtos`

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `nome` | string | Nome exibido no catálogo. |
| `categoria` | string | `slug` da categoria vinculada. |
| `descricao` | string | Descrição curta. |
| `preco` | string | Preço informado pelo painel; opcional. |
| `prazo` | string | Prazo de encomenda; opcional. |
| `destaque` | boolean | Exibe o selo “Mais pedido”. |
| `disponivel` | boolean | Define a visibilidade pública. |
| `ordem` | number | Ordenação ascendente no catálogo. |
| `imagemUrl` / `storageRef` | string | Primeira imagem e respectivo caminho, por compatibilidade. |
| `imagensUrls` / `storageRefs` | array | URLs e caminhos de todas as imagens. |
| `criadoEm` | timestamp | Criado pelo servidor. |

### `categorias`

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `nome` | string | Rótulo mostrado ao público. |
| `slug` | string | Identificador estável usado nos produtos e filtros. |
| `ordem` | number | Ordenação dos filtros e do seletor administrativo. |
| `criadaEm` | timestamp | Criado pelo servidor. |

Ao abrir o painel em um catálogo legado que já possui produtos, as categorias padrão (`bolo`, `torta`, `doce`, `aniversario` e `casamento`) são criadas automaticamente se a coleção ainda estiver vazia.

### `avaliacoes`

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `nome` | string | Nome do cliente; máximo de 80 caracteres. |
| `mensagem` | string | Texto da avaliação; máximo de 500 caracteres. |
| `estrelas` | number | Nota inteira entre 1 e 5. |
| `aprovada` | boolean | Só avaliações aprovadas são públicas. |
| `criadaEm` | timestamp | Criado pelo servidor. |

## Segurança

As regras atuais adotam este modelo:

- Produtos e categorias podem ser lidos publicamente; escrita requer autenticação.
- Avaliações públicas só podem ser lidas quando aprovadas.
- Qualquer visitante pode criar uma avaliação válida e não aprovada.
- Aprovar, editar ou excluir avaliações requer autenticação.
- Imagens em `produtos/**` são públicas; upload exige autenticação, tipo `image/*` e tamanho inferior a 5 MB.

Após alterar os arquivos de regras, publique-os no Firebase Console ou com a Firebase CLI. Alterações nesses arquivos não são aplicadas automaticamente pelo workflow de GitHub Pages.

## Publicação

Todo push para a branch `main` aciona [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). O fluxo:

1. Faz checkout do repositório.
2. Injeta os secrets do Firebase em `js/firebase.js` apenas no artefato de publicação.
3. Publica o diretório raiz no GitHub Pages.

Para habilitar o Pages no repositório, use **Settings > Pages > Source: GitHub Actions**. O domínio e os metadados atuais apontam para `https://fatiadavida.com.br`; ao trocar de domínio, atualize `robots.txt`, `sitemap.xml`, dados estruturados e URLs públicas em `index.html`.

## Manutenção rápida

- **Adicionar produto:** acesse `/admin/`, envie uma ou mais imagens e complete o formulário.
- **Criar categoria:** em `/admin/`, abra “Categorias” e use “Nova categoria”.
- **Alterar categoria:** editar muda apenas o nome; o `slug` permanece estável para não quebrar produtos existentes.
- **Excluir categoria:** antes, mova ou remova todos os produtos vinculados.
- **Moderar avaliação:** aprove ou exclua a avaliação na seção correspondente do painel.
- **Alterar WhatsApp ou Instagram:** procure os links em `index.html` e a constante `WPP_NUMBER` em `js/catalog.js`.

## Verificações disponíveis

Não há suíte automatizada nem processo de build configurados. Como verificação mínima dos módulos JavaScript:

```powershell
node --check js/admin.js
node --check js/catalog.js
node --check js/reviews.js
```
