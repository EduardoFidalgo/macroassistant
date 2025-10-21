// ==============================================
// MACRO ASSISTANT - Clipboard Mode (Minimalista)
// ==============================================

let macros = {};
let buffer = '';
let capturing = false;
let processing = false; // Flag para evitar processamento duplo

// Carregar macros
chrome.storage.local.get(['macros'], (result) => {
  macros = result.macros || {};
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.macros) macros = changes.macros.newValue || {};
});

// Copiar para clipboard
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// Substituir comando pelo texto da macro com suporte a React
function replaceCommandWithMacro(targetElement, command, macroText) {
  if (!targetElement) return false;
  
  // INPUT ou TEXTAREA
  if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
    const currentValue = targetElement.value;
    const commandIndex = currentValue.lastIndexOf(command);
    
    if (commandIndex !== -1) {
      // Calcular novo valor
      const beforeCommand = currentValue.substring(0, commandIndex);
      const afterCommand = currentValue.substring(commandIndex + command.length);
      const newValue = beforeCommand + macroText + afterCommand;
      
      console.log('🔍 Debug INPUT/TEXTAREA:');
      console.log('  Valor atual:', currentValue);
      console.log('  Comando:', command);
      console.log('  Texto macro:', macroText);
      console.log('  Antes:', beforeCommand);
      console.log('  Depois:', afterCommand);
      console.log('  Novo valor:', newValue);
      
      // MÉTODO 1: Setter nativo (para React)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        targetElement.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      ).set;
      
      nativeInputValueSetter.call(targetElement, newValue);
      
      // MÉTODO 2: Disparar evento de input (React detecta) - APENAS UMA VEZ
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        composed: true,
        inputType: 'insertText'
      });
      targetElement.dispatchEvent(inputEvent);
      
      // Posicionar cursor (usar Array.from para contar emojis corretamente)
      const beforeText = beforeCommand + macroText;
      
      // Usar length original para setSelectionRange (funciona com UTF-16)
      const utf16CursorPos = beforeText.length;
      targetElement.setSelectionRange(utf16CursorPos, utf16CursorPos);
      
      console.log('✅ Texto substituído com sucesso!');
      console.log('✅ Comprimento final:', Array.from(newValue).length, 'caracteres');
      console.log('✅ Parágrafos preservados:', (newValue.match(/\n/g) || []).length + 1);
      
      return true;
    }
  }
  
  // CONTENTEDITABLE (Discord, etc)
  else if (targetElement.isContentEditable || targetElement.contentEditable === 'true') {
    const currentText = targetElement.innerText || targetElement.textContent || '';
    const commandIndex = currentText.lastIndexOf(command);
    
    if (commandIndex !== -1) {
      // Focar no elemento
      targetElement.focus();
      
      // Calcular novo texto
      const beforeCommand = currentText.substring(0, commandIndex);
      const afterCommand = currentText.substring(commandIndex + command.length);
      const newText = beforeCommand + macroText + afterCommand;
      
      console.log('🔍 Debug CONTENTEDITABLE:');
      console.log('  Texto atual:', currentText);
      console.log('  Comando:', command);
      console.log('  Texto macro:', macroText);
      console.log('  Emojis na macro:', (macroText.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length);
      console.log('  Parágrafos na macro:', (macroText.match(/\n/g) || []).length + 1);
      
      // MÉTODO 1: Deletar caractere por caractere (simula usuário apagando)
      // Usar comprimento UTF-16 para cálculos do DOM (emojis = múltiplos chars)
      const commandLengthUTF16 = command.length;
      
      // Posicionar cursor no final do comando
      const selection = window.getSelection();
      const range = document.createRange();
      
      // Selecionar todo o conteúdo primeiro
      range.selectNodeContents(targetElement);
      const allText = range.toString();
      
      // Encontrar posição do comando
      let charCount = 0;
      let foundStart = false;
      let startNode = null, startOffset = 0;
      let endNode = null, endOffset = 0;
      
      function traverseNodes(node) {
        if (foundStart && endNode) return;
        
        if (node.nodeType === Node.TEXT_NODE) {
          const textLength = node.textContent.length;
          
          if (!foundStart) {
            if (charCount + textLength >= commandIndex) {
              startNode = node;
              startOffset = commandIndex - charCount;
              foundStart = true;
            }
          }
          
          if (foundStart && !endNode) {
            // Usar o comprimento UTF-16 para cálculos de offset no DOM
            const endPos = commandIndex + commandLengthUTF16;
            if (charCount + textLength >= endPos) {
              endNode = node;
              endOffset = endPos - charCount;
            }
          }
          
          charCount += textLength;
        } else {
          for (let child of node.childNodes) {
            traverseNodes(child);
            if (foundStart && endNode) break;
          }
        }
      }
      
      traverseNodes(targetElement);
      
      if (startNode && endNode) {
        // Selecionar o comando
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Disparar beforeinput APENAS UMA VEZ para deletar
        targetElement.dispatchEvent(new InputEvent('beforeinput', {
          inputType: 'deleteContentBackward',
          bubbles: true,
          cancelable: true
        }));
        
        // Deletar seleção
        document.execCommand('delete', false, null);
        
        // INSERIR TEXTO - Tratar múltiplos parágrafos
        // Dividir por quebras de linha e inserir linha por linha
        const lines = macroText.split('\n');
        
        // Disparar beforeinput UMA VEZ ANTES do loop
        targetElement.dispatchEvent(new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: macroText,
          bubbles: true,
          cancelable: true
        }));
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Inserir linha (suporta emojis automaticamente) - SEM disparar eventos individuais
          document.execCommand('insertText', false, line);
          
          // Se não for a última linha, inserir quebra de linha
          if (i < lines.length - 1) {
            document.execCommand('insertLineBreak', false, null);
          }
        }
        
        // Disparar input APENAS UMA VEZ após todo o texto ser inserido
        targetElement.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: macroText,
          bubbles: true,
          cancelable: false
        }));
        
        console.log('✅ ContentEditable atualizado com sucesso!');
        console.log('✅ Linhas inseridas:', lines.length);
        
        return true;
      }
      
      // Fallback: Método simplificado
      console.warn('⚠️ Usando fallback para contentEditable');
      
      targetElement.focus();
      selection.removeAllRanges();
      
      // Selecionar tudo e substituir
      const selectAllRange = document.createRange();
      selectAllRange.selectNodeContents(targetElement);
      selection.addRange(selectAllRange);
      document.execCommand('delete', false, null);
      
      // Inserir novo texto com quebras de linha preservadas
      const fallbackLines = newText.split('\n');
      for (let i = 0; i < fallbackLines.length; i++) {
        document.execCommand('insertText', false, fallbackLines[i]);
        if (i < fallbackLines.length - 1) {
          document.execCommand('insertLineBreak', false, null);
        }
      }
      
      // Disparar evento UMA ÚNICA VEZ ao final
      targetElement.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        cancelable: false,
        inputType: 'insertText',
        data: newText
      }));
      
      console.log('✅ Fallback concluído');
      
      return true;
    }
  }
  
  return false;
}

// Mostrar notificação
function showNotification(command, text, isError = false, autoPasted = false) {
  const existing = document.getElementById('macro-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'macro-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${isError ? '#ff6b6b' : 'linear-gradient(135deg, #ffb3ed, #ffc6f2)'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 20px;">${isError ? '❌' : (autoPasted ? '🎉' : '✅')}</div>
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">${command}</div>
        ${!isError ? `<div style="font-size: 11px; opacity: 0.8;">${autoPasted ? '✨ Substituído automaticamente!' : '📋 Copiado para área de transferência'}</div>` : '<div style="font-size: 12px; opacity: 0.9;">Macro não encontrada</div>'}
      </div>
    </div>
  `;
  
  // Adicionar animação
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Capturar teclas
document.addEventListener('keydown', (e) => {
  // Iniciar captura com #
  if (e.key === '#') {
    buffer = '#';
    capturing = true;
    return;
  }
  
  if (!capturing) return;
  
  // Processar comando (Espaço ou Enter)
  if (e.key === ' ' || e.key === 'Enter') {
    // Evitar processamento duplo
    if (processing) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }
    
    const command = buffer.trim();
    
    // Se não é um comando válido, deixar o comportamento normal
    if (!command || !macros[command]) {
      if (command.length > 1) {
        showNotification(command, '', true, false);
      }
      buffer = '';
      capturing = false;
      return;
    }
    
    // Comando válido encontrado - MARCAR COMO PROCESSANDO PRIMEIRO
    processing = true;
    
    // Prevenir evento completamente
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const targetElement = e.target;
    const macroText = macros[command];
    
    // Copiar para clipboard (backup)
    copyToClipboard(macroText);
    
    // Verificar se é um campo de texto
    const isTextField = targetElement && (
      targetElement.tagName === 'INPUT' ||
      targetElement.tagName === 'TEXTAREA' ||
      targetElement.isContentEditable ||
      targetElement.contentEditable === 'true'
    );
    
    if (isTextField) {
      // SUBSTITUIR o comando pelo texto da macro diretamente
      const replaced = replaceCommandWithMacro(targetElement, command, macroText);
      
      if (replaced) {
        showNotification(command, macroText, false, true);
      } else {
        // Fallback: apenas notificar
        showNotification(command, macroText, false, false);
      }
    } else {
      // Fora de campos: apenas copiar para clipboard
      showNotification(command, macroText, false, false);
    }
    
    buffer = '';
    capturing = false;
    
    // Resetar flag após um delay maior para evitar duplicação
    setTimeout(() => {
      processing = false;
      console.log('🔓 Processamento desbloqueado');
    }, 500);
    
    return;
  }
  
  // Cancelar com Escape
  if (e.key === 'Escape') {
    buffer = '';
    capturing = false;
    return;
  }
  
  // Backspace
  if (e.key === 'Backspace') {
    buffer = buffer.slice(0, -1);
    if (buffer.length === 0) capturing = false;
    return;
  }
  
  // Adicionar caractere
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    buffer += e.key;
  }
}, true);

console.log('✨ Macro Assistant ativado! Digite #comando + Espaço');
console.log('📝 Suporte: múltiplos parágrafos ✓ | emojis ✓');
