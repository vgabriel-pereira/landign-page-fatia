# Fatia da Vida — Landing Page

## Estrutura

```
fatia-da-vida/
├── assets/             # Logo, favicon, og-image
├── css/
│   ├── style.css       # Tokens globais e base
│   ├── catalog.css     # Estilos do site público
│   └── admin.css       # Estilos do painel admin
├── js/
│   ├── firebase.js     # Config e inicialização do Firebase
│   ├── catalog.js      # Catálogo público (lê Firestore)
│   └── admin.js        # Painel admin (auth + upload + CRUD)
├── admin/
│   ├── index.html      # Painel principal
│   └── login.html      # Tela de login
├── index.html          # Landing page pública
├── firestore.rules     # Regras de segurança do Firestore
└── storage.rules       # Regras de segurança do Storage
```

## Configuração inicial

### 1. Firebase
1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative **Firestore Database** (modo produção)
3. Ative **Storage**
4. Ative **Authentication → E-mail/senha**
5. Crie o usuário admin em Authentication → Users
6. Copie as credenciais do projeto e cole em `js/firebase.js`
7. Publique as regras: `firestore.rules` e `storage.rules`

### 2. Coleção Firestore
Crie a coleção `produtos` com os campos:
- `nome` (string)
- `categoria` (string): bolo | torta | doce | aniversario | casamento
- `descricao` (string)
- `imagemUrl` (string)
- `storageRef` (string)
- `disponivel` (boolean)
- `destaque` (boolean)
- `ordem` (number)
- `criadoEm` (timestamp)

### 3. GitHub Pages
1. Suba o projeto para um repositório GitHub
2. Settings → Pages → Branch: main → / (root)
3. Adicione o arquivo `CNAME` com o domínio: `fatiadavida.com.br`
4. No registrador do domínio, aponte o DNS para o GitHub Pages

### 4. Substituições obrigatórias
- `js/firebase.js` → credenciais reais do Firebase
- `index.html` + `admin/` → número real do WhatsApp (`5561900000000`)
- `index.html` → @ real do Instagram (`seuarroba`)
- `assets/logo.png` → logo com fundo transparente
- `assets/favicon.ico` → favicon
- `assets/og-image.jpg` → imagem de compartilhamento (1200×630px)
- `assets/sobre.jpg` → foto da seção "Sobre"

## Acesso ao admin
`https://seudominio.com.br/admin/`

Apenas o usuário cadastrado no Firebase Auth consegue fazer login.
