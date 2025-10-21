// Elementos
const commandInput = document.getElementById('command-input');
const textInput = document.getElementById('text-input');
const addBtn = document.getElementById('add-btn');
const cancelBtn = document.getElementById('cancel-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const macrosList = document.getElementById('macros-list');
const macroCount = document.getElementById('macro-count');

// Estado de edição
let editingCommand = null;

// Carregar macros
function loadMacros() {
  chrome.storage.local.get(['macros'], (result) => {
    const macros = result.macros || {};
    displayMacros(macros);
    updateMacroCount(Object.keys(macros).length);
  });
}

// Atualizar contador
function updateMacroCount(count) {
  macroCount.textContent = count;
  clearAllBtn.style.display = count > 0 ? 'flex' : 'none';
}

// Exibir macros
function displayMacros(macros) {
  const macroEntries = Object.entries(macros);
  
  if (macroEntries.length === 0) {
    macrosList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-text">
          Nenhuma macro criada ainda.<br>
          Comece adicionando uma acima!
        </div>
      </div>
    `;
    return;
  }
  
  macrosList.innerHTML = '';
  
  for (const [command, text] of macroEntries) {
    const macroDiv = document.createElement('div');
    macroDiv.className = 'macro-item';
    macroDiv.dataset.command = command;
    
    if (editingCommand === command) {
      macroDiv.classList.add('editing');
    }
    
    // Escapar HTML mas preservar quebras de linha
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
    
    macroDiv.innerHTML = `
      <div class="macro-content">
        <div class="macro-info">
          <div class="macro-command">
            <span>⚡</span>
            <span>${command}</span>
          </div>
          <div class="macro-text">${escapedText}</div>
        </div>
        <div class="macro-actions">
          <button class="icon-btn edit-btn" data-command="${command}" title="Editar">
            ✏️
          </button>
          <button class="icon-btn delete-btn" data-command="${command}" title="Excluir">
            🗑️
          </button>
        </div>
      </div>
    `;
    
    macrosList.appendChild(macroDiv);
  }
  
  // Event listeners para editar
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const command = e.currentTarget.dataset.command;
      startEdit(command, macros[command]);
    });
  });
  
  // Event listeners para deletar
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const command = e.currentTarget.dataset.command;
      if (confirm(`Deseja realmente excluir a macro "${command}"?`)) {
        deleteMacro(command);
      }
    });
  });
}

// Iniciar edição
function startEdit(command, text) {
  editingCommand = command;
  commandInput.value = command;
  textInput.value = text;
  
  // Atualizar UI
  addBtn.innerHTML = '<span>✓</span><span>Salvar</span>';
  cancelBtn.style.display = 'flex';
  commandInput.focus();
  
  // Scroll até o item sendo editado
  const item = document.querySelector(`.macro-item[data-command="${command}"]`);
  if (item) {
    item.classList.add('editing');
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Cancelar edição
function cancelEdit() {
  editingCommand = null;
  commandInput.value = '';
  textInput.value = '';
  addBtn.innerHTML = '<span>+</span><span>Adicionar</span>';
  cancelBtn.style.display = 'none';
  
  // Remover destaque
  document.querySelectorAll('.macro-item').forEach(item => {
    item.classList.remove('editing');
  });
}

// Adicionar ou atualizar macro
function saveMacro() {
  let command = commandInput.value.trim();
  const text = textInput.value.trim();
  
  if (!command || !text) {
    alert('⚠️ Preencha o comando e o texto!');
    return;
  }
  
  // Garantir que começa com #
  if (!command.startsWith('#')) {
    command = '#' + command;
  }
  
  chrome.storage.local.get(['macros'], (result) => {
    const macros = result.macros || {};
    
    // Se está editando, remover o comando antigo
    if (editingCommand && editingCommand !== command) {
      delete macros[editingCommand];
    }
    
    macros[command] = text;
    
    chrome.storage.local.set({ macros }, () => {
      cancelEdit();
      loadMacros();
      
      // Feedback visual
      const item = document.querySelector(`.macro-item[data-command="${command}"]`);
      if (item) {
        item.style.animation = 'none';
        setTimeout(() => {
          item.style.animation = '';
        }, 10);
      }
    });
  });
}

// Deletar macro
function deleteMacro(command) {
  chrome.storage.local.get(['macros'], (result) => {
    const macros = result.macros || {};
    delete macros[command];
    
    chrome.storage.local.set({ macros }, () => {
      if (editingCommand === command) {
        cancelEdit();
      }
      loadMacros();
    });
  });
}

// Limpar todas as macros
function clearAllMacros() {
  const confirmMsg = '⚠️ Deseja realmente excluir TODAS as macros?\n\nEsta ação não pode ser desfeita.';
  if (confirm(confirmMsg)) {
    chrome.storage.local.set({ macros: {} }, () => {
      cancelEdit();
      loadMacros();
    });
  }
}

// Event listeners
addBtn.addEventListener('click', saveMacro);
cancelBtn.addEventListener('click', cancelEdit);
clearAllBtn.addEventListener('click', clearAllMacros);

commandInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    textInput.focus();
  }
});

textInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    saveMacro();
  }
});

// Esc para cancelar edição
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editingCommand) {
    cancelEdit();
  }
});

// Carregar ao abrir
loadMacros();
