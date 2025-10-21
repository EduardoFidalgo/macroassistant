# ⚡ Macro Assistant

Uma extensão de navegador (Chrome/Edge) que permite criar comandos personalizados (macros) que se transformam automaticamente em frases prontas quando você digita em qualquer campo de texto.

## 🚀 Funcionalidades

- ✨ Crie macros personalizadas com comandos iniciando com `#`
- 🔄 Substituição automática em tempo real em qualquer campo de texto
- 💾 Armazenamento local (sem necessidade de backend)
- 🎨 Interface limpa e intuitiva
- 🗑️ Gerencie suas macros facilmente (adicionar/remover)

## 📦 Como Instalar

1. **Baixe ou clone este repositório**

2. **Abra o Chrome ou Edge** e navegue até:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`

3. **Ative o "Modo de desenvolvedor"** (canto superior direito)

4. **Clique em "Carregar sem compactação"** ou "Carregar expandida"

5. **Selecione a pasta** `macros-extension`

6. **Pronto!** A extensão está instalada e pronta para uso.

## 💡 Como Usar

### Criando uma Macro

1. Clique no ícone da extensão na barra de ferramentas
2. Digite o comando desejado no campo "Comando" (ex: `#boasvindas`)
3. Digite a mensagem correspondente no campo "Mensagem" (ex: `Olá, tudo bem?`)
4. Clique em "💾 Salvar Macro"

### Editando uma Macro

1. Na lista de macros salvas, clique no botão "✏️ Editar" da macro desejada
2. O formulário será preenchido com os dados da macro
3. Modifique a mensagem conforme necessário
4. Clique em "💾 Atualizar Macro" ou "❌ Cancelar" para descartar as alterações

### Usando uma Macro

1. Acesse qualquer site com campos de texto
2. Digite o comando da macro seguido de um espaço (ex: `#boasvindas `)
3. A macro será automaticamente substituída pela mensagem correspondente!

### Exemplos de Macros

- `#email` → `seuemail@exemplo.com`
- `#endereco` → `Rua Exemplo, 123 - São Paulo, SP`
- `#obrigado` → `Muito obrigado pelo contato! Retornarei em breve.`
- `#assinatura` → `Atenciosamente,\nSeu Nome\nCargo\nEmpresa`
- `#meeting` → `Podemos agendar uma reunião para discutir isso?`

## 🛠️ Estrutura do Projeto

```
macros-extension/
├── manifest.json       # Configuração da extensão (Manifest V3)
├── popup.html          # Interface da extensão
├── popup.js           # Lógica da interface
├── content.js         # Script que detecta e substitui macros
├── icons/
│   └── icon128.png    # Ícone da extensão
└── README.md          # Este arquivo
```

## 🔧 Tecnologias Utilizadas

- **HTML5** - Estrutura da interface
- **CSS3** - Estilização (com gradientes e animações)
- **JavaScript Puro** - Lógica da aplicação
- **Chrome Storage API** - Armazenamento local das macros
- **Chrome Extension Manifest V3** - Formato moderno de extensões

## 🎯 Casos de Uso

- **Suporte ao Cliente**: Respostas rápidas para perguntas frequentes
- **Vendas**: Templates de email para prospecção
- **Programação**: Snippets de código frequentemente usados
- **Redes Sociais**: Mensagens padrão de engajamento
- **Produtividade**: Textos repetitivos do dia a dia

## 🔒 Privacidade

- ✅ Todos os dados são armazenados **localmente** no seu navegador
- ✅ Nenhuma informação é enviada para servidores externos
- ✅ Funciona 100% offline
- ✅ Código aberto e auditável

## 📝 Notas

- A macro é ativada quando você digita o comando seguido de um **espaço**
- Os comandos devem começar com `#` para fácil identificação
- Funciona em qualquer site, incluindo:
  - WhatsApp Web
  - Gmail
  - Twitter/X
  - LinkedIn
  - Formulários em geral
  - E muito mais!

## 🤝 Contribuindo

Sinta-se à vontade para contribuir com melhorias:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.

## 🆘 Suporte

Se encontrar problemas ou tiver sugestões:
- Abra uma issue no repositório
- Ou entre em contato diretamente

---

**Desenvolvido com ❤️ para aumentar sua produtividade!**
