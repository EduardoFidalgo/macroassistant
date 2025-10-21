// Armazenar macros em memória para acesso rápido
let macros = {};

// Carregar macros do storage ao iniciar
chrome.storage.local.get(['macros'], (result) => {
  macros = result.macros || {};
  console.log('Macro Assistant: Macros carregadas', Object.keys(macros).length);
});

// Atualizar macros quando houver mudanças no storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.macros) {
    macros = changes.macros.newValue || {};
    console.log('Macro Assistant: Macros atualizadas', Object.keys(macros).length);
  }
});

// Rastrear o texto digitado em cada campo
const inputTracking = new WeakMap();
const processedElements = new WeakSet();

// Verificar se um elemento é um campo de texto válido
function isTextInputElement(element) {
  if (!element || !element.tagName) return false;
  
  const tagName = element.tagName.toLowerCase();
  
  // Textarea é sempre válido
  if (tagName === 'textarea') return true;
  
  // ContentEditable
  if (element.isContentEditable) return true;
  
  // Input com tipos válidos
  if (tagName === 'input') {
    const type = (element.type || 'text').toLowerCase();
    return ['text', 'search', 'url', 'tel', 'email', 'password', ''].includes(type);
  }
  
  return false;
}

// Função para processar a substituição de macro
function processMacroReplacement(element, value) {
  if (!value || typeof value !== 'string') return false;
  
  // Procurar por comandos de macro no texto
  const words = value.split(/(\s+)/);
  let replaced = false;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Verificar se a palavra corresponde a uma macro
    if (macros[word]) {
      // Substituir a palavra pela mensagem da macro
      const before = words.slice(0, i).join('');
      const after = words.slice(i + 1).join('');
      const newValue = before + macros[word] + after;
      
      try {
        // Atualizar o valor do elemento
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(element, newValue);
        } else {
          element.value = newValue;
        }
        
        // Disparar múltiplos eventos para compatibilidade com frameworks
        ['input', 'change', 'keyup'].forEach(eventType => {
          const event = new Event(eventType, { 
            bubbles: true, 
            cancelable: true,
            composed: true 
          });
          element.dispatchEvent(event);
        });
        
        // Disparar evento React (se aplicável)
        const reactEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          composed: true,
          data: macros[word]
        });
        element.dispatchEvent(reactEvent);
        
        // Posicionar o cursor após o texto substituído
        const cursorPosition = before.length + macros[word].length;
        try {
          element.setSelectionRange(cursorPosition, cursorPosition);
        } catch (e) {
          // Alguns elementos não suportam setSelectionRange
        }
        
        // Atualizar tracking
        inputTracking.set(element, newValue);
        
        console.log('Macro Assistant: Substituiu', word, '→', macros[word].substring(0, 20) + '...');
        replaced = true;
        break;
      } catch (error) {
        console.error('Macro Assistant: Erro ao substituir macro', error);
      }
    }
  }
  
  return replaced;
}

// Função para lidar com eventos de input
function handleInput(event) {
  const element = event.target;
  
  // Verificar se é um elemento de entrada de texto válido
  if (!isTextInputElement(element)) {
    return;
  }
  
  const currentValue = element.value || '';
  
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
  
  try {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    
    const text = textNode.textContent || '';
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
        
        console.log('Macro Assistant: Substituiu em contentEditable', word);
        break;
      }
    }
  } catch (error) {
    console.error('Macro Assistant: Erro em contentEditable', error);
  }
}

// Inicializar elemento para tracking
function initializeElement(element) {
  if (!isTextInputElement(element)) return;
  if (processedElements.has(element)) return;
  
  processedElements.add(element);
  inputTracking.set(element, element.value || '');
}

// Múltiplos listeners para máxima compatibilidade
['input', 'keyup', 'change'].forEach(eventType => {
  document.addEventListener(eventType, (event) => {
    if (event.target.isContentEditable) {
      handleContentEditableInput(event);
    } else {
      handleInput(event);
    }
  }, true);
});

// Função para escanear e inicializar todos os campos de texto
function scanAndInitialize(root = document) {
  try {
    // Buscar todos os campos de texto possíveis
    const selectors = [
      'input[type="text"]',
      'input[type="search"]', 
      'input[type="url"]',
      'input[type="tel"]',
      'input[type="email"]',
      'input[type="password"]',
      'input:not([type])',
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable="plaintext-only"]'
    ];
    
    const elements = root.querySelectorAll(selectors.join(','));
    elements.forEach(element => {
      initializeElement(element);
    });
    
    // Verificar se o próprio root é um campo de texto
    if (root !== document && isTextInputElement(root)) {
      initializeElement(root);
    }
  } catch (error) {
    console.error('Macro Assistant: Erro ao escanear elementos', error);
  }
}

// Observer para detectar novos elementos adicionados dinamicamente (incluindo modais)
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Processar nós adicionados
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        scanAndInitialize(node);
      }
    }
    
    // Processar mudanças de atributos (como contenteditable)
    if (mutation.type === 'attributes' && mutation.target) {
      if (isTextInputElement(mutation.target)) {
        initializeElement(mutation.target);
      }
    }
  }
});

// Iniciar observação do documento inteiro
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable', 'type']
  });
} else {
  // Se body ainda não existe, aguardar
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'type']
    });
  });
}

// Inicializar elementos existentes
setTimeout(() => scanAndInitialize(), 100);
setTimeout(() => scanAndInitialize(), 500);
setTimeout(() => scanAndInitialize(), 1000);

// Re-escanear periodicamente para pegar elementos dinâmicos difíceis
setInterval(() => {
  scanAndInitialize();
}, 3000);

console.log('✨ Macro Assistant ativado! Digite um comando começando com # para usar uma macro.');
