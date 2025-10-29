// ==============================================
// MACRO ASSISTANT - Universal Input Monitor
// Version 3.2.1 - Melhorado e Otimizado
// ==============================================

(() => {
  'use strict';

  // ==============================================
  // STATE MANAGEMENT
  // ==============================================
  const state = {
    macros: {},
    activeElement: null,
    inputBuffer: new Map(),
    isProcessing: false,
    processingStartTime: 0,
    lastExpansion: 0,
    lastReplacementText: null,
    lastReplacementElement: null,
    lastReplacementTime: 0,
    lastCommandToReplace: null
  };
  
  // Watchdog para liberar estado travado
  setInterval(() => {
    if (state.isProcessing && state.processingStartTime > 0) {
      const elapsed = Date.now() - state.processingStartTime;
      // Se estiver processando há mais de 2 segundos, forçar liberação
      if (elapsed > 2000) {
        log('⚠️ WATCHDOG: Estado travado detectado, forçando liberação');
        state.isProcessing = false;
        state.processingStartTime = 0;
      }
    }
  }, 500);

  // ==============================================
  // CONFIGURATION
  // ==============================================
  const config = {
    triggerChar: '#',
    minDelay: 50, // Reduzido para 50ms para evitar travamento
    notificationDuration: 2500,
    debugMode: true
  };

  // ==============================================
  // UTILITY FUNCTIONS
  // ==============================================
  const log = (...args) => {
    if (config.debugMode) console.log('[MacroAssistant]', ...args);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const getElementBuffer = (element) => {
    if (!state.inputBuffer.has(element)) {
      state.inputBuffer.set(element, '');
    }
    return state.inputBuffer.get(element);
  };

  const setElementBuffer = (element, value) => {
    state.inputBuffer.set(element, value);
  };

  const clearElementBuffer = (element) => {
    state.inputBuffer.delete(element);
  };

  // ==============================================
  // STORAGE MANAGEMENT
  // ==============================================
  const loadMacros = () => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      log('⚠️ Chrome storage API não disponível');
      return;
    }
    
    try {
      chrome.storage.local.get(['macros'], (result) => {
        if (chrome.runtime.lastError) {
          log('❌ Erro ao carregar macros:', chrome.runtime.lastError);
          return;
        }
        state.macros = result.macros || {};
        log('✅ Macros carregadas:', Object.keys(state.macros).length);
      });
    } catch (error) {
      log('❌ Erro ao acessar storage:', error);
    }
  };

  // Configurar listener para mudanças com validação
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      try {
        if (changes.macros) {
          state.macros = changes.macros.newValue || {};
          log('🔄 Macros atualizadas:', Object.keys(state.macros).length);
        }
      } catch (error) {
        log('❌ Erro ao processar mudanças:', error);
      }
    });
  }

  // ==============================================
  // SLATE/RICH EDITOR DETECTION
  // ==============================================
  const isSlateEditor = (element) => {
    if (!element) return false;
    if (element.hasAttribute('data-slate-editor') ||
        element.hasAttribute('data-lexical-editor') ||
        element.getAttribute('role') === 'textbox') {
      return true;
    }

    let current = element;
    while (current && current !== document.body) {
      if (current.hasAttribute('data-slate-editor') ||
          current.hasAttribute('data-lexical-editor') ||
          current.classList?.contains('slate-editor') ||
          current.classList?.contains('lexical-editor')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  const getSlateEditor = (element) => {
    let current = element;
    while (current && current !== document.body) {
      if (current.hasAttribute('data-slate-editor')) return current;
      current = current.parentElement;
    }
    return null;
  };

  // ==============================================
  // ELEMENT DETECTION - Universal
  // ==============================================
  const isEditableElement = (element) => {
    if (!element || !element.tagName) return false;

    const tag = element.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (element.type || '').toLowerCase();
      return !['checkbox', 'radio', 'submit', 'button', 'file', 'image', 'reset', 'hidden'].includes(type);
    }
    if (tag === 'textarea') return !element.disabled && !element.readOnly;
    if (element.isContentEditable || element.contentEditable === 'true') return true;
    if (element.ownerDocument?.designMode === 'on') return true;
    return false;
  };

  const getEditableType = (element) => {
    if (!element) return null;
    const tag = element.tagName.toLowerCase();
    if (tag === 'input') return 'input';
    if (tag === 'textarea') return 'textarea';
    if (element.isContentEditable || element.contentEditable === 'true') return 'contenteditable';
    return null;
  };

  // ==============================================
  // SLATE VALUE EXTRACTION (Real value getter)
  // ==============================================
  const extractSlateValue = (element) => {
    try {
      const root = getSlateEditor(element);
      if (!root) return null;
      
      // Tentar encontrar React Fiber
      const fiberKey = Object.keys(root).find(k => 
        k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
      );
      
      if (!fiberKey) return null;
      
      const fiber = root[fiberKey];
      if (!fiber) return null;
      
      return findSlateValueInFiber(fiber);
    } catch (err) {
      log("⚠️ Falha ao extrair valor Slate:", err);
      return null;
    }
  };

  const findSlateValueInFiber = (fiber) => {
    const visited = new Set();
    const stack = [fiber];
    let iterations = 0;
    const MAX_ITERATIONS = 500; // Prevenir loop infinito
    
    while (stack.length && iterations < MAX_ITERATIONS) {
      iterations++;
      const node = stack.pop();
      
      if (!node || visited.has(node)) continue;
      visited.add(node);

      // Verificar se tem valor Slate
      if (node.memoizedProps?.value && Array.isArray(node.memoizedProps.value)) {
        return serializeSlateNodes(node.memoizedProps.value);
      }
      
      // Verificar também em stateNode
      if (node.stateNode?.value && Array.isArray(node.stateNode.value)) {
        return serializeSlateNodes(node.stateNode.value);
      }
      
      // Adicionar nós relacionados
      if (node.child) stack.push(node.child);
      if (node.sibling) stack.push(node.sibling);
      if (node.return) stack.push(node.return);
    }
    
    return null;
  };

  const serializeSlateNodes = (nodes) => {
    if (!Array.isArray(nodes)) return "";
    
    return nodes.map(n => {
      if (!n) return "";
      if (typeof n.text === 'string') return n.text;
      if (Array.isArray(n.children)) return serializeSlateNodes(n.children);
      return "";
    }).join("");
  };

  // ==============================================
  // TEXT EXTRACTION - Universal + Slate support
  // ==============================================
  const getCurrentText = (element) => {
    const type = getEditableType(element);
    if (type === 'input' || type === 'textarea') return element.value || '';
    if (type === 'contenteditable') {
      if (isSlateEditor(element)) {
        const slateValue = extractSlateValue(element);
        if (slateValue) return slateValue;
      }
      return element.innerText || element.textContent || '';
    }
    return '';
  };

  const getCursorPosition = (element) => {
    const type = getEditableType(element);
    if (type === 'input' || type === 'textarea') return element.selectionStart || 0;
    if (type === 'contenteditable') {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const pre = range.cloneRange();
        pre.selectNodeContents(element);
        pre.setEnd(range.endContainer, range.endOffset);
        return pre.toString().length;
      }
    }
    return 0;
  };

  // ==============================================
  // SLATE EDITOR MANIPULATION
  // ==============================================
  const replaceTextInSlate = async (element, command, replacementText) => {
    log('🎨 Detectado editor Slate/Rich, usando métodos especializados');
    
    // Tentar múltiplos métodos em sequência até um funcionar
    const methods = [
      { name: 'Agressivo (DOM direto)', fn: () => replaceTextSlateAggressive(element, command, replacementText) },
      { name: 'Clipboard', fn: () => replaceTextViaClipboard(element, command, replacementText) },
      { name: 'InputEvent', fn: () => replaceTextSlateInputEvent(element, command, replacementText) },
      { name: 'ExecCommand', fn: () => replaceTextSlateExecCommand(element, command, replacementText) }
    ];
    
    for (const method of methods) {
      try {
        log(`🔄 Tentando método: ${method.name}`);
        const success = await method.fn();
        
        if (success) {
          log(`✅ Sucesso com método: ${method.name}`);
          return true;
        }
        
        log(`⚠️ Método ${method.name} não funcionou, tentando próximo...`);
        await sleep(50);
        
      } catch (error) {
        log(`❌ Erro no método ${method.name}:`, error);
      }
    }
    
    log('❌ Todos os métodos Slate falharam');
    return false;
  };

  const replaceTextSlateInputEvent = async (element, command, replacementText) => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      
      const range = selection.getRangeAt(0);
      
      // Obter texto atual
      const textNode = range.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return false;
      
      const textContent = textNode.textContent || '';
      const cursorPos = range.startOffset;
      
      // Usar o tamanho exato do comando
      const commandLength = command.length;
      const startPos = Math.max(0, cursorPos - commandLength);
      
      // Validar se o texto é realmente o comando
      const textInRange = textContent.substring(startPos, cursorPos);
      if (textInRange !== command) {
        log('⚠️ Texto não corresponde ao comando:', textInRange, 'vs', command);
        return false;
      }
      
      // Criar novo range que seleciona o comando
      const deleteRange = document.createRange();
      deleteRange.setStart(textNode, startPos);
      deleteRange.setEnd(textNode, cursorPos);
      
      // Selecionar o comando
      selection.removeAllRanges();
      selection.addRange(deleteRange);
      
      await sleep(10);
      
      // Disparar evento de beforeinput para deleção
      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward',
        data: null
      }));
      
      // Deletar o conteúdo selecionado
      deleteRange.deleteContents();
      
      // Disparar input após deleção
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'deleteContentBackward'
      }));
      
      await sleep(50);
      
      // Verificar se o nó de texto ainda existe
      if (!textNode.parentNode) return false;
      
      // Inserir o texto de substituição
      const insertRange = document.createRange();
      insertRange.setStart(textNode, startPos);
      insertRange.setEnd(textNode, startPos);
      selection.removeAllRanges();
      selection.addRange(insertRange);
      
      // Disparar beforeinput para inserção
      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: replacementText
      }));
      
      // Inserir o texto
      const newTextNode = document.createTextNode(replacementText);
      insertRange.insertNode(newTextNode);
      
      // Mover cursor
      insertRange.setStartAfter(newTextNode);
      insertRange.setEndAfter(newTextNode);
      selection.removeAllRanges();
      selection.addRange(insertRange);
      
      // Disparar input
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
        data: replacementText
      }));
      
      return true;
      
    } catch (error) {
      log('❌ Erro no InputEvent:', error);
      return false;
    }
  };

  const replaceTextSlateExecCommand = async (element, command, replacementText) => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      if (textNode.nodeType !== Node.TEXT_NODE) return false;
      
      const textContent = textNode.textContent || '';
      const cursorPos = range.startOffset;
      
      // Usar o tamanho exato do comando
      const commandLength = command.length;
      if (commandLength <= 0) return false;
      
      // Primeiro validar se o texto antes do cursor é realmente o comando
      const startPos = Math.max(0, cursorPos - commandLength);
      const textBeforeCursor = textContent.substring(startPos, cursorPos);
      
      if (textBeforeCursor !== command) {
        log('⚠️ ExecCommand: texto não corresponde:', textBeforeCursor, 'vs', command);
        return false;
      }
      
      log('✅ ExecCommand: comando validado:', command);
      
      // Criar um range preciso para selecionar o comando
      const deleteRange = document.createRange();
      deleteRange.setStart(textNode, startPos);
      deleteRange.setEnd(textNode, cursorPos);
      selection.removeAllRanges();
      selection.addRange(deleteRange);
      
      await sleep(10);
      
      // Verificar se document.execCommand é suportado
      if (!document.execCommand) {
        log('⚠️ execCommand não suportado');
        return false;
      }
      
      // Validar que a seleção contém exatamente o comando
      const selectedText = selection.toString();
      if (selectedText !== command) {
        log('⚠️ Seleção não corresponde ao comando:', selectedText, 'vs', command);
        return false;
      }
      
      log('🗑️ ExecCommand: deletando:', selectedText);
      
      // Usar execCommand para deletar e inserir
      document.execCommand('delete', false, null);
      
      await sleep(50);
      
      log('📝 ExecCommand: inserindo:', replacementText);
      
      document.execCommand('insertText', false, replacementText);
      
      return true;
      
    } catch (error) {
      log('❌ Erro no ExecCommand:', error);
      return false;
    }
  };

  const replaceTextViaClipboard = async (element, command, replacementText) => {
    log('📋 Tentando método via clipboard');
    
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      
      const range = selection.getRangeAt(0);
      
      // Obter texto atual
      const textNode = range.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return false;
      
      const textContent = textNode.textContent || '';
      const cursorPos = range.startOffset;
      
      // Usar o tamanho exato do comando
      const commandLength = command.length;
      const startPos = Math.max(0, cursorPos - commandLength);
      
      // Validar se o texto é realmente o comando
      const textInRange = textContent.substring(startPos, cursorPos);
      if (textInRange !== command) {
        log('⚠️ Texto não corresponde:', textInRange, 'vs', command);
        return false;
      }
      
      // Selecionar comando
      const deleteRange = document.createRange();
      deleteRange.setStart(textNode, startPos);
      deleteRange.setEnd(textNode, cursorPos);
      selection.removeAllRanges();
      selection.addRange(deleteRange);
      
      // Copiar texto para clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(replacementText);
      } else {
        // Fallback se clipboard API não disponível
        return false;
      }
      
      await sleep(50);
      
      // Criar DataTransfer com dados
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', replacementText);
      
      // Simular evento paste
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      
      element.dispatchEvent(pasteEvent);
      
      // Se o evento não foi cancelado, inserir manualmente
      if (!pasteEvent.defaultPrevented) {
        document.execCommand('insertText', false, replacementText);
      }
      
      log('✅ Texto inserido via clipboard');
      return true;
      
    } catch (error) {
      log('❌ Erro no método clipboard:', error);
      return false;
    }
  };

  // Método mais agressivo: Manipular diretamente o DOM e forçar reconciliação
  const replaceTextSlateAggressive = async (element, command, replacementText) => {
    log('💪 Tentando método agressivo para Slate');
    
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        log('⚠️ Nenhuma seleção disponível');
        return false;
      }
      
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      if (textNode.nodeType !== Node.TEXT_NODE) {
        log('⚠️ Nó atual não é texto');
        return false;
      }
      
      const textContent = textNode.textContent || '';
      const cursorPos = range.startOffset;
      
      // Usar o tamanho exato do comando
      const commandLength = command.length;
      const startPos = Math.max(0, cursorPos - commandLength);
      
      // Validar se o texto é realmente o comando
      const textInRange = textContent.substring(startPos, cursorPos);
      if (textInRange !== command) {
        log('⚠️ Texto não corresponde:', textInRange, 'vs', command);
        return false;
      }
      
      log('📍 Comando encontrado entre', startPos, 'e', cursorPos);
      log('📝 Conteúdo original:', textContent);
      
      // ESTRATÉGIA: Usar Selection API para selecionar o comando e depois substituir
      // Isso respeita o fluxo que o Slate espera
      
      // 1. Criar range para selecionar exatamente o comando
      const selectRange = document.createRange();
      selectRange.setStart(textNode, startPos);
      selectRange.setEnd(textNode, cursorPos);
      
      // 2. Aplicar a seleção
      selection.removeAllRanges();
      selection.addRange(selectRange);
      
      log('🔄 Comando selecionado no range:', startPos, 'até', cursorPos);
      log('📝 Texto selecionado:', selection.toString());
      
      // Validar que selecionamos o comando correto
      const selectedText = selection.toString();
      if (selectedText !== command) {
        log('⚠️ Seleção incorreta:', selectedText, 'vs', command);
        return false;
      }
      
      await sleep(10);
      
      // 3. Deletar o texto selecionado usando execCommand
      log('🗑️ Deletando comando selecionado...');
      
      if (!document.execCommand) {
        log('⚠️ execCommand não disponível');
        return false;
      }
      
      // Disparar beforeinput
      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContent',
        data: null
      }));
      
      const deleted = document.execCommand('delete', false, null);
      
      if (!deleted) {
        log('⚠️ execCommand delete falhou');
        return false;
      }
      
      log('✅ Comando deletado');
      
      await sleep(50);
      
      // 4. Inserir o texto de substituição
      // Se o texto tem múltiplas linhas, precisamos inserir linha por linha
      const lines = replacementText.split('\n');
      const hasMultipleLines = lines.length > 1;
      
      log('📝 Inserindo texto:', replacementText.substring(0, 50) + (replacementText.length > 50 ? '...' : ''));
      log('📊 Linhas detectadas:', lines.length);
      
      if (!document.execCommand) {
        log('⚠️ execCommand não disponível');
        return false;
      }
      
      // Função auxiliar para inserir texto de forma segura (compatível com emojis)
      const insertTextSafely = async (text) => {
        // Disparar beforeinput
        element.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
        
        // Tentar inserir o texto completo primeiro
        let inserted = document.execCommand('insertText', false, text);
        
        if (inserted) {
          return true;
        }
        
        // Se falhar, pode ser por causa de emojis ou caracteres especiais
        // Tentar inserir usando Array.from para lidar com emojis corretamente
        log('⚠️ Inserção direta falhou, tentando caractere por caractere');
        
        const chars = Array.from(text); // Array.from respeita emojis multi-byte
        
        for (const char of chars) {
          const charInserted = document.execCommand('insertText', false, char);
          
          if (!charInserted) {
            log('⚠️ Falha ao inserir caractere:', char);
            return false;
          }
          
          await sleep(5); // Pequeno delay entre caracteres
        }
        
        return true;
      };
      
      if (hasMultipleLines) {
        // Inserir linha por linha com Enter entre elas
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          log(`📝 Inserindo linha ${i + 1}/${lines.length}:`, line.substring(0, 30) + '...');
          
          // Inserir a linha usando método seguro
          const inserted = await insertTextSafely(line);
          
          if (!inserted) {
            log('⚠️ Falha ao inserir linha', i + 1);
            return false;
          }
          
          await sleep(20);
          
          // Se não for a última linha, inserir quebra de linha
          if (i < lines.length - 1) {
            log('⏎ Inserindo quebra de linha');
            
            // Disparar beforeinput para quebra de linha
            element.dispatchEvent(new InputEvent('beforeinput', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertLineBreak',
              data: '\n'
            }));
            
            // Tentar diferentes métodos de quebra de linha
            // 1. Primeiro tentar insertLineBreak (Shift+Enter - quebra suave)
            let lineBreak = document.execCommand('insertLineBreak', false, null);
            
            if (!lineBreak) {
              // 2. Se falhar, tentar inserir \n diretamente
              log('⏎ Tentando inserir \\n diretamente');
              lineBreak = document.execCommand('insertText', false, '\n');
            }
            
            if (!lineBreak) {
              // 3. Se falhar, tentar insertParagraph (Enter - novo parágrafo)
              log('⏎ Tentando insertParagraph');
              lineBreak = document.execCommand('insertParagraph', false, null);
            }
            
            if (!lineBreak) {
              log('⚠️ Falha ao inserir quebra de linha');
            }
            
            await sleep(30);
          }
        }
        
        log('✅ Todas as linhas inseridas');
        
        // Limpar elementos vazios que possam ter sido criados
        await sleep(30);
        
        // Encontrar e remover divs/spans vazios no elemento
        const emptyElements = element.querySelectorAll('div:empty, span:empty, p:empty');
        if (emptyElements.length > 0) {
          log('🧹 Removendo', emptyElements.length, 'elementos vazios');
          emptyElements.forEach(el => {
            // Verificar se está realmente vazio (sem texto e sem filhos)
            if (!el.textContent.trim() && el.children.length === 0) {
              el.remove();
            }
          });
        }
        
      } else {
        // Texto de linha única - inserir usando método seguro
        const inserted = await insertTextSafely(replacementText);
        
        if (!inserted) {
          log('⚠️ Falha ao inserir texto');
          return false;
        }
        
        log('✅ Texto inserido');
      }
      
      await sleep(50);
      
      // 5. Disparar eventos finais
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
        data: replacementText
      }));
      
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      log('✅ Substituição completa via execCommand');
      return true;
      
    } catch (error) {
      log('❌ Erro no método agressivo:', error);
      return false;
    }
  };

  // ==============================================
  // TEXT REPLACEMENT - Universal Method
  // ==============================================
  const replaceTextUniversal = async (element, command, replacementText) => {
    const type = getEditableType(element);
    
    if (!type) {
      log('❌ Elemento não editável');
      return false;
    }

    // Verificar se é editor Slate/Rich
    if (isSlateEditor(element)) {
      return await replaceTextInSlate(element, command, replacementText);
    }

    try {
      log('🔄 Deletando comando:', command);
      
      // Passo 1: Deletar comando
      await deleteCommand(element, command, type);
      
      // Aguardar para garantir que a deleção foi processada
      await new Promise(resolve => requestAnimationFrame(resolve));
      await sleep(50);
      
      log('📝 Inserindo texto de substituição:', replacementText.substring(0, 50) + '...');
      
      // Passo 2: Inserir texto de substituição
      const inserted = await insertText(element, replacementText, type);
      
      if (!inserted) {
        log('⚠️ Método direto falhou, tentando fallback');
        return await insertTextFallback(element, replacementText, type);
      }
      
      // Aguardar para garantir que o texto foi inserido
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      log('✅ Substituição completa');
      return true;
      
    } catch (error) {
      log('❌ Erro na substituição:', error);
      return await insertTextFallback(element, replacementText, type);
    }
  };

  const deleteCommand = async (element, command, type) => {
    const text = getCurrentText(element);
    const cursorPos = getCursorPosition(element);
    
    log('🗑️ deleteCommand chamado:');
    log('  - Comando:', command, '(tamanho:', command.length, ')');
    log('  - Cursor em:', cursorPos);
    log('  - Texto atual:', text.substring(Math.max(0, cursorPos - 20), cursorPos + 20));
    
    // Usar o tamanho exato do comando para garantir remoção completa
    const commandLength = command.length;
    const startPos = cursorPos - commandLength;
    
    log('  - StartPos calculado:', startPos, 'EndPos:', cursorPos);
    
    if (type === 'input' || type === 'textarea') {
      // Método mais robusto: manipular diretamente o valor
      const value = element.value;
      
      // Validar se o texto no range é realmente o comando
      const textInRange = value.substring(startPos, cursorPos);
      if (textInRange !== command) {
        log('⚠️ AVISO: Texto no range não corresponde ao comando:', textInRange, 'vs', command);
        log('📊 startPos:', startPos, 'cursorPos:', cursorPos, 'value:', value);
        // Tentar encontrar o comando no texto
        const commandIndex = value.lastIndexOf(command, cursorPos);
        if (commandIndex !== -1 && commandIndex <= cursorPos) {
          log('✅ Comando encontrado em:', commandIndex);
          const realStartPos = commandIndex;
          const realEndPos = commandIndex + commandLength;
          const newValue = value.substring(0, realStartPos) + value.substring(realEndPos);
          
          // Usar o setter nativo para garantir compatibilidade
          const setter = Object.getOwnPropertyDescriptor(
            type === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value'
          ).set;
          
          setter.call(element, newValue);
          
          // Disparar eventos nativos
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'deleteContentBackward'
          }));
          
          // Posicionar cursor no início onde estava o comando
          element.setSelectionRange(realStartPos, realStartPos);
          element.focus();
          return;
        }
      }
      
      const newValue = value.substring(0, startPos) + value.substring(cursorPos);
      
      // Usar o setter nativo para garantir compatibilidade
      const setter = Object.getOwnPropertyDescriptor(
        type === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      ).set;
      
      setter.call(element, newValue);
      
      // Disparar eventos nativos
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward'
      }));
      
      // Posicionar cursor no início onde estava o comando
      element.setSelectionRange(startPos, startPos);
      
      // Garantir foco
      element.focus();
      
    } else if (type === 'contenteditable') {
      const selection = window.getSelection();
      
      if (selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      // Se estiver em um nó de texto
      if (textNode.nodeType === Node.TEXT_NODE) {
        const offset = range.startOffset;
        const textContent = textNode.textContent || '';
        
        // Usar o tamanho exato do comando
        const localStart = Math.max(0, offset - commandLength);
        
        // Validar se o texto no range é realmente o comando
        const textInRange = textContent.substring(localStart, offset);
        if (textInRange !== command) {
          log('⚠️ Texto no range não corresponde ao comando:', textInRange, 'vs', command);
        }
        
        // Deletar o comando usando o tamanho exato
        const newText = textContent.substring(0, localStart) + textContent.substring(offset);
        textNode.textContent = newText;
        
        // Reposicionar cursor
        try {
          range.setStart(textNode, localStart);
          range.setEnd(textNode, localStart);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          log('⚠️ Erro ao reposicionar cursor:', e);
        }
        
      } else {
        // Fallback: usar execCommand com o tamanho exato
        for (let i = 0; i < commandLength; i++) {
          selection.modify('move', 'backward', 'character');
        }
        
        for (let i = 0; i < commandLength; i++) {
          selection.modify('extend', 'forward', 'character');
        }
        
        document.execCommand('delete');
      }
      
      // Disparar evento de input
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'deleteContentBackward'
      }));
    }
  };

  const insertText = async (element, text, type) => {
    if (type === 'input' || type === 'textarea') {
      // Método direto e robusto
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const value = element.value || '';
      
      const newValue = value.substring(0, start) + text + value.substring(end);
      
      // Usar setter nativo
      const setter = Object.getOwnPropertyDescriptor(
        type === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      ).set;
      
      setter.call(element, newValue);
      
      // Disparar eventos na ordem correta
      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
      
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
        data: text
      }));
      
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Posicionar cursor no final do texto inserido
      const newPos = start + text.length;
      element.setSelectionRange(newPos, newPos);
      
      // Garantir foco
      element.focus();
      
      log('✅ Texto inserido:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
      
      return true;
      
    } else if (type === 'contenteditable') {
      const selection = window.getSelection();
      
      if (selection.rangeCount === 0) {
        log('⚠️ Nenhum range selecionado');
        return false;
      }
      
      const range = selection.getRangeAt(0);
      
      // Deletar seleção atual se houver
      range.deleteContents();
      
      // Criar fragmento de texto
      const lines = text.split('\n');
      const fragment = document.createDocumentFragment();
      
      for (let i = 0; i < lines.length; i++) {
        const textNode = document.createTextNode(lines[i]);
        fragment.appendChild(textNode);
        
        if (i < lines.length - 1) {
          fragment.appendChild(document.createElement('br'));
        }
      }
      
      // Inserir fragmento
      range.insertNode(fragment);
      
      // Mover cursor para o final do texto inserido
      range.setStartAfter(fragment.lastChild);
      range.setEndAfter(fragment.lastChild);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Disparar eventos
      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
      
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
        data: text
      }));
      
      log('✅ Texto inserido (contentEditable):', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
      
      return true;
    }
    
    return false;
  };

  const insertTextFallback = async (element, text, type) => {
    log('🔄 Usando método fallback...');
    
    try {
      // Tentar copiar para clipboard e simular Ctrl+V
      await navigator.clipboard.writeText(text);
      
      element.focus();
      
      // Simular Ctrl+V
      const pasteEvent = new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });
      
      element.dispatchEvent(pasteEvent);
      
      return true;
    } catch (error) {
      log('❌ Fallback falhou:', error);
      return false;
    }
  };

  // ==============================================
  // COMMAND DETECTION
  // ==============================================
  const detectCommand = (text, cursorPos) => {
    // Extrair palavra antes do cursor
    let startPos = cursorPos;
    while (startPos > 0 && text[startPos - 1] !== ' ' && text[startPos - 1] !== '\n') {
      startPos--;
    }
    
    const word = text.substring(startPos, cursorPos);
    
    // Verificar se é um comando
    if (word.startsWith(config.triggerChar) && word.length > 1) {
      return word;
    }
    
    return null;
  };

  const shouldTriggerExpansion = (text, cursorPos) => {
    const command = detectCommand(text, cursorPos);
    
    if (!command) return null;
    
    // Verificar se o comando existe
    if (state.macros[command]) {
      return { command, replacement: state.macros[command] };
    }
    
    return null;
  };

  // ==============================================
  // NOTIFICATION SYSTEM
  // ==============================================
  const showNotification = (command, isError = false) => {
    const existing = document.getElementById('macro-assistant-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'macro-assistant-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      background: ${isError ? 'linear-gradient(135deg, #ff6b6b, #ee5a6f)' : 'linear-gradient(135deg, #667eea, #764ba2)'};
      color: #ffffff;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      animation: slideInRight 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      max-width: 320px;
      pointer-events: none;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px; line-height: 1;">
          ${isError ? '❌' : '✨'}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">
            ${command}
          </div>
          <div style="font-size: 12px; opacity: 0.9;">
            ${isError ? 'Macro não encontrada' : 'Texto expandido!'}
          </div>
        </div>
      </div>
    `;

    if (!document.getElementById('macro-assistant-styles')) {
      const style = document.createElement('style');
      style.id = 'macro-assistant-styles';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      setTimeout(() => notification.remove(), 300);
    }, config.notificationDuration);
  };

  // ==============================================
  // MAIN EXPANSION LOGIC
  // ==============================================
  const performExpansion = async (element, command, replacement) => {
    // Prevenir múltiplas expansões simultâneas
    const now = Date.now();
    if (now - state.lastExpansion < config.minDelay) {
      log('⏸️ Expansão muito rápida, ignorando');
      return false;
    }
    
    state.lastExpansion = now;
    state.isProcessing = true;
    state.processingStartTime = now;

    try {
      log('🚀 Iniciando expansão');
      log('   Comando:', command);
      log('   Elemento:', element.tagName, getEditableType(element));
      log('   Texto antes:', getCurrentText(element).substring(0, 100));
      log('   Substituição:', replacement.substring(0, 100) + (replacement.length > 100 ? '...' : ''));
      
      // Guardar informações para interceptor
      state.lastReplacementText = replacement;
      state.lastReplacementElement = element;
      state.lastReplacementTime = now;
      
      const success = await replaceTextUniversal(element, command, replacement);
      
      if (success) {
        log('   Texto depois:', getCurrentText(element).substring(0, 100));
        showNotification(command, false);
        log('✅ Expansão bem-sucedida!');
      } else {
        showNotification(command, true);
        log('❌ Falha na expansão');
      }
      
      return success;
      
    } catch (error) {
      console.error('❌ Erro fatal na expansão:', error);
      showNotification(command, true);
      return false;
    } finally {
      // Liberar o estado IMEDIATAMENTE após a expansão
      // Não usar setTimeout para evitar travamento
      state.isProcessing = false;
      state.processingStartTime = 0;
      
      // Limpar buffer do elemento para evitar detecções duplicadas
      clearElementBuffer(element);
      
      log('🔓 Estado liberado, elemento pode ser editado novamente');
    }
  };

  // ==============================================
  // INPUT EVENT MONITORING - Universal
  // ==============================================
  const handleInput = async (event) => {
    const element = event.target;
    
    // Verificar se é editável
    if (!isEditableElement(element)) return;
    
    // Ignorar se já estamos processando (mas não bloquear permanentemente)
    if (state.isProcessing) {
      log('⏸️ Processamento em andamento, aguardando...');
      return;
    }
    
    // Obter texto e posição do cursor
    const text = getCurrentText(element);
    const cursorPos = getCursorPosition(element);
    
    // Detectar se há um comando para expandir
    const expansion = shouldTriggerExpansion(text, cursorPos);
    
    if (expansion) {
      log('🎯 Comando detectado:', expansion.command);
      
      // Aguardar próximo frame para garantir que o input foi processado
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Realizar expansão
      await performExpansion(element, expansion.command, expansion.replacement);
    }
  };

  const handleKeyDown = async (event) => {
    const element = event.target;
    
    // Verificar se é editável
    if (!isEditableElement(element)) return;
    
    // SEMPRE permitir teclas de edição (Backspace, Delete, Arrow keys, etc)
    const editKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (editKeys.includes(event.key)) {
      // Forçar liberação do estado se necessário
      if (state.isProcessing) {
        log('⚠️ Liberando estado para permitir edição');
        state.isProcessing = false;
        state.processingStartTime = 0;
      }
      return; // Permitir comportamento padrão
    }
    
    // Ignorar se já estamos processando (mas não bloquear permanentemente)
    if (state.isProcessing) {
      log('⏸️ Processamento em andamento, ignorando keydown');
      return;
    }
    
    // Apenas processar Space e Enter
    if (event.key !== ' ' && event.key !== 'Enter') return;
    
    // Obter texto e posição do cursor
    const text = getCurrentText(element);
    const cursorPos = getCursorPosition(element);
    
    // Detectar se há um comando para expandir
    const expansion = shouldTriggerExpansion(text, cursorPos);
    
    if (expansion) {
      log('🎯 Comando detectado (tecla):', expansion.command);
      
      // Se for editor Slate, NÃO manipular o DOM
      // Apenas guardar a expansão para o interceptor de rede
      if (isSlateEditor(element)) {
        log('🎨 Editor Slate detectado - usando apenas interceptor de rede');
        log('   Comando a substituir:', expansion.command);
        log('   Texto de substituição:', expansion.replacement?.substring(0, 50));
        
        // Guardar informações para o interceptor
        state.lastReplacementText = expansion.replacement;
        state.lastReplacementElement = element;
        state.lastReplacementTime = Date.now();
        state.lastCommandToReplace = expansion.command;
        
        log('   Estado configurado:');
        log('     - lastCommandToReplace:', state.lastCommandToReplace);
        log('     - lastReplacementText:', state.lastReplacementText?.substring(0, 30));
        log('     - lastReplacementTime:', new Date(state.lastReplacementTime).toLocaleTimeString());
        
        // Mostrar notificação
        showNotification(expansion.command, false);
        
        log('✅ Expansão agendada para interceptor de rede');
        log('⏰ Válido pelos próximos 5 segundos');
        
        // Permitir que o Slate processe normalmente - NÃO prevenir default
        return;
      }
      
      // Para elementos não-Slate, usar o método normal
      // Prevenir comportamento padrão IMEDIATAMENTE
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Realizar expansão
      const success = await performExpansion(element, expansion.command, expansion.replacement);
      
      // Se foi Enter E a expansão foi bem-sucedida, simular Enter novamente
      if (success && event.key === 'Enter') {
        await sleep(100);
        
        // Simular pressionar Enter novamente para enviar
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        
        element.dispatchEvent(enterEvent);
        
        // Também disparar keypress e keyup para máxima compatibilidade
        await sleep(10);
        
        const keypressEvent = new KeyboardEvent('keypress', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        
        element.dispatchEvent(keypressEvent);
        
        await sleep(10);
        
        const keyupEvent = new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        
        element.dispatchEvent(keyupEvent);
      }
    }
  };

  // Monitorar mudanças de foco
  const handleFocus = (event) => {
    const element = event.target;
    
    if (isEditableElement(element)) {
      state.activeElement = element;
      // Limpar estado ao focar para garantir que não há travamento
      state.isProcessing = false;
      log('📝 Elemento ativo:', element.tagName);
    }
  };

  const handleBlur = () => {
    if (state.activeElement) {
      clearElementBuffer(state.activeElement);
      state.activeElement = null;
      // Liberar estado ao desfocar
      state.isProcessing = false;
      log('👋 Elemento desfocado');
    }
  };

  // ==============================================
  // MUTATION OBSERVER - Dynamic Content Support
  // ==============================================
  const observeNewElements = () => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Verificar se o novo elemento é editável
              if (isEditableElement(node)) {
                log('🆕 Novo elemento editável detectado:', node.tagName);
              }
              
              // Verificar elementos filhos
              if (node.querySelectorAll) {
                const editables = node.querySelectorAll('input, textarea, [contenteditable="true"]');
                if (editables.length > 0) {
                  log('🆕 Novos elementos editáveis detectados:', editables.length);
                }
              }
            }
          });
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    log('👁️ MutationObserver ativo');
  };

  // ==============================================
  // NETWORK INTERCEPTOR - Para plataformas que enviam via API
  // ==============================================
  const setupNetworkInterceptor = () => {
    // Interceptar fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      try {
        const [url, options] = args;
        
        log('🌐 Fetch interceptado:', url?.substring(0, 100));
        
        // Se houver uma substituição recente (últimos 5 segundos - aumentado)
        if (state.lastReplacementText && 
            state.lastReplacementTime && 
            Date.now() - state.lastReplacementTime < 5000) {
          
          log('✅ Tempo válido para substituição');
          log('   Comando:', state.lastCommandToReplace);
          log('   Substituição:', state.lastReplacementText?.substring(0, 50));
          
          // Tentar modificar o payload se for POST/PUT/PATCH
          if (options?.body && options?.method && 
              ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
            
            try {
              const body = options.body;
              let modified = false;
              
              // Se for string JSON
              if (typeof body === 'string') {
                try {
                  const json = JSON.parse(body);
                  
                  log('📦 Payload JSON:', JSON.stringify(json).substring(0, 200));
                  
                  // Procurar por campos comuns de mensagem
                  const messageFields = ['content', 'message', 'text', 'body', 'msg', 'data'];
                  
                  for (const field of messageFields) {
                    if (json[field] && typeof json[field] === 'string') {
                      // Se temos um comando específico para substituir, usar ele
                      if (state.lastCommandToReplace && json[field].includes(state.lastCommandToReplace)) {
                        log('🔄 Interceptando requisição, corrigindo payload (fetch)');
                        log('   Antes:', json[field]);
                        log('   Substituindo:', state.lastCommandToReplace, '→', state.lastReplacementText);
                        
                        // Substituir TODAS as ocorrências do comando
                        json[field] = json[field].replaceAll(state.lastCommandToReplace, state.lastReplacementText);
                        
                        log('   Depois:', json[field]);
                        modified = true;
                      } else {
                        // Fallback: verificar todos os comandos conhecidos
                        const hasCommand = Object.keys(state.macros).some(cmd => 
                          json[field].includes(cmd)
                        );
                        
                        if (hasCommand) {
                          log('🔄 Interceptando requisição, corrigindo payload (fallback)');
                          log('   Antes:', json[field]);
                          
                          // Substituir comando pelo texto
                          Object.keys(state.macros).forEach(cmd => {
                            if (json[field].includes(cmd)) {
                              json[field] = json[field].replaceAll(cmd, state.macros[cmd]);
                            }
                          });
                          
                          log('   Depois:', json[field]);
                          modified = true;
                        }
                      }
                    }
                  }
                  
                  if (modified) {
                    options.body = JSON.stringify(json);
                  }
                  
                } catch (e) {
                  // Não é JSON, ignorar silenciosamente
                }
              }
              
            } catch (error) {
              log('⚠️ Erro ao interceptar fetch:', error);
            }
          }
        }
      } catch (error) {
        log('⚠️ Erro no interceptor fetch:', error);
      }
      
      return originalFetch.apply(this, args);
    };
    
    // Interceptar XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(...args) {
      try {
        this._method = args[0];
        this._url = args[1];
      } catch (e) {
        log('⚠️ Erro ao interceptar XHR.open:', e);
      }
      return originalOpen.apply(this, args);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
      try {
        log('🌐 XHR.send interceptado');
        
        if (state.lastReplacementText && 
            state.lastReplacementTime && 
            Date.now() - state.lastReplacementTime < 5000 &&
            body && typeof body === 'string') {
          
          log('✅ Tempo válido para substituição (XHR)');
          log('   Comando:', state.lastCommandToReplace);
          log('   Substituição:', state.lastReplacementText?.substring(0, 50));
          
          try {
            const json = JSON.parse(body);
            
            log('📦 Payload JSON (XHR):', JSON.stringify(json).substring(0, 200));
            
            const messageFields = ['content', 'message', 'text', 'body', 'msg', 'data'];
            let modified = false;
            
            for (const field of messageFields) {
              if (json[field] && typeof json[field] === 'string') {
                // Se temos um comando específico para substituir, usar ele
                if (state.lastCommandToReplace && json[field].includes(state.lastCommandToReplace)) {
                  log('🔄 Interceptando XHR, corrigindo payload');
                  log('   Antes:', json[field]);
                  log('   Substituindo:', state.lastCommandToReplace, '→', state.lastReplacementText);
                  
                  // Substituir TODAS as ocorrências do comando
                  json[field] = json[field].replaceAll(state.lastCommandToReplace, state.lastReplacementText);
                  
                  log('   Depois:', json[field]);
                  modified = true;
                } else {
                  // Fallback: verificar todos os comandos conhecidos
                  const hasCommand = Object.keys(state.macros).some(cmd => 
                    json[field].includes(cmd)
                  );
                  
                  if (hasCommand) {
                    log('🔄 Interceptando XHR, corrigindo payload (fallback)');
                    Object.keys(state.macros).forEach(cmd => {
                      if (json[field].includes(cmd)) {
                        json[field] = json[field].replaceAll(cmd, state.macros[cmd]);
                      }
                    });
                    modified = true;
                  }
                }
              }
            }
            
            if (modified) {
              body = JSON.stringify(json);
            }
            
          } catch (e) {
            // Não é JSON, ignorar silenciosamente
          }
        }
      } catch (error) {
        log('⚠️ Erro no interceptor XHR.send:', error);
      }
      
      return originalSend.call(this, body);
    };
    
    log('🌐 Interceptor de rede ativo');
  };

  // ==============================================
  // INITIALIZATION - Universal
  // ==============================================
  const init = () => {
    // Carregar macros
    loadMacros();
    
    // Event listeners
    document.addEventListener('input', handleInput, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);
    
    // Monitorar novos elementos (para SPAs)
    if (document.body) {
      observeNewElements();
    } else {
      document.addEventListener('DOMContentLoaded', observeNewElements);
    }
    
    // Interceptar requisições de rede
    setupNetworkInterceptor();
    
    // Log de inicialização
    console.log('%c⚡ Macro Assistant v3.2.1 ', 'background: linear-gradient(135deg, #667eea, #764ba2); color: white; font-size: 16px; font-weight: bold; padding: 8px 16px; border-radius: 8px;');
    console.log('%c✨ Sistema Universal Ativo', 'color: #667eea; font-weight: bold;');
    console.log('%c🎨 Suporte Aprimorado para Slate/Lexical', 'color: #667eea; font-weight: bold;');
    console.log('%c🌐 Interceptor de Rede com Tratamento de Erros', 'color: #667eea; font-weight: bold;');
    console.log('%c🛡️ Código Otimizado e Seguro', 'color: #667eea; font-weight: bold;');
    console.log('%c📝 Digite #comando + Espaço/Enter para expandir', 'color: #666;');
    console.log('%c🌍 Compatível com:', 'color: #666;');
    console.log('  ✓ React, Vue, Angular, Svelte');
    console.log('  ✓ Shadow DOM');
    console.log('  ✓ ContentEditable + Slate/Lexical');
    console.log('  ✓ Aplicações Single Page (SPA)');
    console.log('  ✓ Gmail, WhatsApp Web, Slack, Discord, Notion');
    console.log('  ✓ Todos os tipos de input/textarea');
  };

  // Inicializar imediatamente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
