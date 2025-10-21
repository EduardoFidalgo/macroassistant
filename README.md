# 🎯 Macro Assistant

Extensão Chrome: Digite **#comando + Espaço** → **Texto substituído automaticamente!** ✨

## ✨ Como Funciona

1. Digite `#teste` em qualquer campo de texto
2. Pressione **Espaço**
3. **✨ Comando APAGADO e substituído pelo texto da macro!**

## 🚀 Instalação

1. Abra `chrome://extensions/`
2. Ative **Modo do desenvolvedor**
3. **Carregar sem compactação** → Selecione esta pasta

## 💡 Uso

**Criar macro:**
- Clique no ícone da extensão
- Digite `#teste` e `Olá, mundo!`
- Clique **Adicionar Macro**

**Usar macro:**
- Em um campo de texto, digite: `#teste ` (com espaço)
- **✨ O comando é apagado e o texto aparece automaticamente!**

## ✅ Vantagens

- **Substituição inteligente** - Apaga o comando e coloca o texto
- **Instantâneo** - Acontece na hora, sem delay
- **Universal** - Discord, Teams, Gmail, WhatsApp, etc
- **Leve** - Código minimalista e performático
- **Confiável** - Funciona com qualquer framework

## 🎯 Experiência do Usuário

**Antes de pressionar Espaço:**
```
#teste|
```

**Depois de pressionar Espaço:**
```
Olá, mundo!|
```

O comando **#teste** é completamente removido e substituído!

---

**Estrutura:**
- `manifest.json` - Configuração
- `popup.html` - Interface
- `popup.js` - CRUD de macros
- `content.js` - Substituição automática
