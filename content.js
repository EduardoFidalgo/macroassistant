// Armazenar macros em memória para acesso rápido
let macros = {};

// Carregar macros do storage ao iniciar
chrome.storage.local.get(['macros'], (result) => {
  macros = result.macros || {};
});

// Atualizar macros quando houver mudanças no storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.macros) {
    macros = changes.macros.newValue || {};
  }
});

// Rastrear o texto digitado em cada campo
const inputTracking = new WeakMap();

// Função para processar a substituição de macro
function processMacroReplacement(element, value) {
  // Procurar por comandos de macro no texto
  const words = value.split(/(\s+)/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Verificar se a palavra corresponde a uma macro
    if (macros[word]) {
      // Substituir a palavra pela mensagem da macro
      const before = words.slice(0, i).join('');
      const after = words.slice(i + 1).join('');
      const newValue = before + macros[word] + after;
      
      // Atualizar o valor do elemento
      element.value = newValue;
      
      // Disparar evento de input para garantir que frameworks detectem a mudança
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      element.dispatchEvent(inputEvent);
      
      // Posicionar o cursor após o texto substituído
      const cursorPosition = before.length + macros[word].length;
      element.setSelectionRange(cursorPosition, cursorPosition);
      
      // Atualizar tracking
      inputTracking.set(element, newValue);
      
      return true;
    }
  }
  
  return false;
}

// Função para lidar com eventos de input
function handleInput(event) {
  const element = event.target;
  
  // Verificar se é um elemento de entrada de texto
  if (
    !element.isContentEditable &&
    element.tagName !== 'INPUT' &&
    element.tagName !== 'TEXTAREA'
  ) {
    return;
  }
  
  // Para campos input type que não são de texto, ignorar
  if (element.tagName === 'INPUT') {
    const type = element.type.toLowerCase();
    if (
      type !== 'text' &&
      type !== 'search' &&
      type !== 'url' &&
      type !== 'tel' &&
      type !== 'email'
    ) {
      return;
    }
  }
  
  const currentValue = element.value;
  
  // Verificar se o valor mudou
  const lastValue = inputTracking.get(element) || '';
  if (currentValue === lastValue) {
    return;
  }
  
  // Atualizar tracking
  inputTracking.set(element, currentValue);
  
  // Processar substituição de macro
  processMacroReplacement(element, currentValue);
}

// Função para lidar com elementos contentEditable
function handleContentEditableInput(event) {
  const element = event.target;
  
  if (!element.isContentEditable) {
    return;
  }
  
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;
  
  if (textNode.nodeType !== Node.TEXT_NODE) return;
  
  const text = textNode.textContent;
  const words = text.split(/(\s+)/);
  
  for (const word of words) {
    if (macros[word]) {
      // Encontrar a posição da palavra no texto
      const wordIndex = text.lastIndexOf(word);
      if (wordIndex === -1) continue;
      
      // Substituir o texto
      const before = text.substring(0, wordIndex);
      const after = text.substring(wordIndex + word.length);
      const newText = before + macros[word] + after;
      
      textNode.textContent = newText;
      
      // Reposicionar o cursor
      const newRange = document.createRange();
      const newPosition = before.length + macros[word].length;
      newRange.setStart(textNode, Math.min(newPosition, textNode.textContent.length));
      newRange.collapse(true);
      
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      break;
    }
  }
}

// Adicionar listeners para capturar eventos de input
document.addEventListener('input', (event) => {
  if (event.target.isContentEditable) {
    handleContentEditableInput(event);
  } else {
    handleInput(event);
  }
}, true);

// Observer para detectar novos elementos adicionados dinamicamente
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Verificar se o elemento ou seus descendentes são campos de entrada
        const inputs = node.querySelectorAll('input[type="text"], input[type="search"], input[type="url"], input[type="tel"], input[type="email"], textarea, [contenteditable="true"]');
        inputs.forEach(input => {
          if (!inputTracking.has(input)) {
            inputTracking.set(input, input.value || '');
          }
        });
        
        // Verificar se o próprio elemento é um campo de entrada
        if (
          (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') ||
          node.isContentEditable
        ) {
          if (!inputTracking.has(node)) {
            inputTracking.set(node, node.value || '');
          }
        }
      }
    }
  }
});

// Iniciar observação
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Inicializar tracking para elementos existentes
document.querySelectorAll('input[type="text"], input[type="search"], input[type="url"], input[type="tel"], input[type="email"], textarea, [contenteditable="true"]').forEach(element => {
  inputTracking.set(element, element.value || '');
});

console.log('Macro Assistant carregado! Digite um comando começando com # para ativar uma macro.');
