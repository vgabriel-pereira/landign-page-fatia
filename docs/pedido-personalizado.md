# Pedido personalizado — implementação e revisão

## Resultado

Seção “Monte seu pedido” após o catálogo, acessível também pelo botão no início da página. Tipos: bolo, torta, doces e outra ideia. Preferências de sabor em texto livre; decoração para bolos e tortas; quantidade opcional com orientação para quem precisa de sugestão. Data e recebimento obrigatórios. Região obrigatória somente para entrega. “Outra ideia” exige descrição.

O resumo permite revisar as informações antes de abrir o WhatsApp. O visitante ainda precisa enviar a mensagem na conversa. Preço, prazo, disponibilidade, frete e pagamento dependem de confirmação humana. Fotos de referência são enviadas na conversa. Não há pedido confirmado automaticamente.

## Estrutura e alterações

Revisados: HTML público e administrativo; CSS global, catálogo e painel; módulos de catálogo, avaliações, Firebase e administração; regras Firestore/Storage; workflow de publicação, README, robots e sitemap. O projeto utiliza HTML/CSS/ES Modules, Firebase via CDN, Google Fonts e GitHub Pages. Sem servidor de aplicação ou build local.

- `index.html`: seção, campos acessíveis, orientação sem JavaScript e botão de navegação.
- `css/order.css`: estilos limitados à nova seção, duas colunas no desktop e uma em telas menores.
- `js/order.js`: módulo independente, validação e resumo; navegação para destino fixo do WhatsApp.
- `tests/order.test.cjs`: testes sem dependências externas, com DOM simulado.
- `README.md`: funcionalidade e comandos de verificação.
- Este relatório: decisões, evidências e limitações.

Não houve alterações no modelo de dados, regras, permissões ou integrações. Não há uploads, login, cálculo de preço ou gerenciamento de opções no painel nesta versão. A alteração já existente em `js/admin.js` foi preservada. O catálogo e seu fluxo individual continuam com seus arquivos originais.

O formulário não depende da resposta do Firebase. Nenhuma biblioteca, requisição ou armazenamento de dados foi acrescentado durante o preenchimento. Os dados só são colocados no parâmetro de mensagem ao abrir o WhatsApp. O navegador e o serviço de destino podem manter a URL no histórico. O layout reutiliza tokens visuais e botões existentes; campos condicionais reduzem o preenchimento.

## Testes executados

- `node --check` em `order.js`, `catalog.js`, `reviews.js` e `admin.js`: aprovados.
- `node --test tests/order.test.cjs`: 8 testes aprovados. Cobrem formulário vazio, mensagem válida, região condicional, mudança de tipo, descrição obrigatória, datas passadas, quantidades e opções inválidas, limites de texto, caracteres de controle, HTML/scripts/URLs como texto literal, correção de erros e falha simulada na navegação.
- Integridade estática: IDs únicos, labels associados, referências locais existentes e IDs usados pelo módulo: aprovada pelos testes.
- `git diff --check`: sem erros de whitespace; Git emitiu avisos sobre conversão LF/CRLF.
- Primeira execução do runner foi bloqueada por `spawn EPERM`; a execução autorizada fora do sandbox passou.

O ambiente informou que o host de acesso ao navegador estava indisponível. Não foram executados testes visuais em desktop/celular, inspeção do console ou de rede em navegador, nem abertura real do WhatsApp. Responsividade foi revisada no CSS, sem comprovação visual. Firebase local contém placeholders; consultas, login, uploads, avaliações e regras publicadas não foram testados contra um ambiente real ou emulador. Não houve publicação.

## Revisão de segurança — ATENÇÃO

Classificação geral por limitações de validação e pontos preexistentes abaixo. Nenhuma vulnerabilidade relevante foi identificada no novo módulo nas verificações executadas; isso não equivale a uma auditoria completa do projeto.

1. **Novos pontos de Injection:** não identificados nos testes. As entradas são dados e não são interpretadas como HTML, CSS ou código.
2. **`innerHTML`, `eval` ou execução dinâmica:** ausentes no módulo novo. O resumo e as mensagens usam `textContent`. Os testes rejeitam atribuição a `innerHTML` nos elementos simulados. Os módulos antigos continuam usando templates HTML.
3. **Entradas externas:** opções são verificadas por listas permitidas (`Map`, sem acesso por propriedades arbitrárias); textos por comprimento e caracteres de controle; quantidade por faixa e inteiro; data por formato e mínimo, junto com a validade nativa do campo `date`. Entrega e descrição têm validação condicional. Validação é repetida no submit.
4. **XSS/DOM:** payload de imagem com `onerror`, scripts e URLs permanece literal no resumo e no parâmetro da mensagem. Não foram criados atributos executáveis ou seletores a partir de entradas. Não há persistência nova que possibilite Stored XSS. Não há leitura de parâmetros de URL.
5. **Configurações:** nenhuma configuração global ou permissão foi alterada. Não foi aplicada CSP global sem verificar sua compatibilidade com os scripts/CDNs e estilos existentes.
6. **Credenciais:** nenhuma credencial adicionada; os placeholders Firebase foram preservados. A revisão não inclui histórico Git nem arquivos de configuração fora do projeto. Configuração pública do Firebase não substitui autorização nas regras.
7. **Dependências:** nenhuma nova dependência.
8. **Funcionalidades anteriores:** os módulos de catálogo/avaliações e administração não foram editados nesta implementação; sintaxe aprovada. Compatibilidade em navegador e integrações reais ainda precisam ser verificadas.
9. **Integração externa:** URL construída com `URL` e `searchParams`, origem e telefone fixos. Entradas não podem alterar o destino. Não há API própria recebendo pedidos; a validação no cliente orienta o preenchimento, sem garantir disponibilidade ou preço. Se a persistência for adicionada, validação no servidor/regras e controle de abuso serão necessários.
10. **Pendências:** descritas abaixo. Não há IA, SQL ou processos de sistema no novo fluxo; prompt injection, SQL/command injection e path traversal não têm ponto de execução nessa funcionalidade. Não há mesclagem de objetos externos, upload ou caminho controlado pelo visitante.

### Pontos preexistentes para revisão separada

- Templates do painel interpolam alguns IDs de documentos em atributos sem codificação contextual (`data-editar`, `data-deletar`, `data-aprovar`), e templates de avaliações interpolam a nota em `aria-label`. As regras públicas validam notas ao criar avaliações, mas escritas administrativas não têm esquema equivalente; documentos malformados introduzidos por uma conta administrativa podem abrir caminhos de HTML Injection/Stored XSS. Recomenda-se construir esses elementos com APIs DOM ou validar tipos e codificar cada contexto. Não foram alterados neste trabalho, que preserva uma edição prévia no painel.
- URLs de imagens vindas do Firestore são escapadas para atributos, mas não passam por política explícita de protocolo/origem. Recomenda-se validar URLs aceitas para reduzir carregamentos de origens arbitrárias. Nenhuma URL externa é aceita como destino no formulário novo.
- Avaliações têm controle local de intervalo e honeypot, mas criação pública nas regras não impõe limite por remetente. Esse mecanismo não garante proteção contra spam automatizado.
- O workflow interpola secrets diretamente em um script shell com `sed`. Valores contendo metacaracteres podem quebrar a substituição ou ser interpretados pelo shell. Recomenda-se usar variáveis de ambiente e substituição por script com serialização apropriada em uma tarefa própria de deploy.
- CSP não está configurada no HTML. Uma política precisa ser testada com as origens Firebase, fontes, imagens e código/estilos existentes antes da adoção.

Nenhuma dessas pendências foi considerada resolvida pela implementação do formulário. As regras locais foram revisadas, mas não foi verificado se coincidem com as regras efetivamente publicadas no Firebase.
