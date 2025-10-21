// Elementos do DOM
const macroForm = document.getElementById('macroForm');
const commandInput = document.getElementById('command');
const messageInput = document.getElementById('message');
const macrosList = document.getElementById('macrosList');
const successMessage = document.getElementById('successMessage');
const saveBtn = document.getElementById('saveBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// Estado de edição
let editingCommand = null;

// Carregar macros ao abrir o popup
document.addEventListener('DOMContentLoaded', loadMacros);

// Salvar ou atualizar macro
macroForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const command = commandInput.value.trim();
  const message = messageInput.value.trim();
  
  // Validação básica
  if (!command || !message) {
    alert('Por favor, preencha todos os campos!');
    return;
  }
  
  // Garantir que o comando comece com #
  const formattedCommand = command.startsWith('#') ? command : `#${command}`;
  
  // Obter macros existentes
  const result = await chrome.storage.local.get(['macros']);
  const macros = result.macros || {};
  
  // Se estiver editando, remover o comando antigo (se mudou)
  if (editingCommand && editingCommand !== formattedCommand) {
    delete macros[editingCommand];
  }
  
  // Adicionar ou atualizar macro
  macros[formattedCommand] = message;
  
  // Salvar no storage
  await chrome.storage.local.set({ macros });
  
  // Limpar formulário e estado de edição
  resetForm();
  
  // Mostrar mensagem de sucesso
  showSuccessMessage(editingCommand ? 'Macro atualizada com sucesso!' : 'Macro salva com sucesso!');
  
  // Recarregar lista
  loadMacros();
  
  // Focar no campo de comando
  commandInput.focus();
});

// Cancelar edição
cancelEditBtn.addEventListener('click', () => {
  resetForm();
});

// Carregar e exibir macros
async function loadMacros() {
  const result = await chrome.storage.local.get(['macros']);
  const macros = result.macros || {};
  
  // Limpar lista
  macrosList.innerHTML = '';
  
  // Verificar se há macros
  const macroEntries = Object.entries(macros);
  
  if (macroEntries.length === 0) {
    macrosList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>Nenhuma macro salva ainda.<br>Crie sua primeira macro acima!</p>
      </div>
    `;
    return;
  }
  
  // Criar elementos para cada macro
  macroEntries.forEach(([command, message]) => {
    const macroItem = document.createElement('div');
    macroItem.className = 'macro-item';
    
    macroItem.innerHTML = `
      <div class="macro-content">
        <div class="macro-command">${escapeHtml(command)}</div>
        <div class="macro-message">${escapeHtml(message)}</div>
      </div>
      <div class="macro-actions">
        <button class="edit-btn" data-command="${escapeHtml(command)}">✏️ Editar</button>
        <button class="delete-btn" data-command="${escapeHtml(command)}">🗑️ Deletar</button>
      </div>
    `;
    
    // Adicionar evento de editar
    const editBtn = macroItem.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => editMacro(command, message));
    
    // Adicionar evento de deletar
    const deleteBtn = macroItem.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteMacro(command));
    
    macrosList.appendChild(macroItem);
  });
}

// Editar macro
function editMacro(command, message) {
  // Preencher formulário com dados da macro (remover # para exibição)
  commandInput.value = command.startsWith('#') ? command.substring(1) : command;
  messageInput.value = message;
  
  // Definir estado de edição
  editingCommand = command;
  
  // Atualizar UI
  saveBtn.textContent = '💾 Atualizar Macro';
  cancelEditBtn.style.display = 'block';
  
  // Desabilitar campo de comando durante edição
  commandInput.disabled = true;
  
  // Focar no campo de mensagem
  messageInput.focus();
  
  // Scroll para o topo
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Resetar formulário
function resetForm() {
  commandInput.value = '';
  messageInput.value = '';
  commandInput.disabled = false;
  editingCommand = null;
  saveBtn.textContent = '💾 Salvar Macro';
  cancelEditBtn.style.display = 'none';
}

// Deletar macro
async function deleteMacro(command) {
  if (!confirm(`Deseja realmente deletar a macro "${command}"?`)) {
    return;
  }
  
  const result = await chrome.storage.local.get(['macros']);
  const macros = result.macros || {};
  
  // Remover macro
  delete macros[command];
  
  // Salvar no storage
  await chrome.storage.local.set({ macros });
  
  // Se estava editando essa macro, resetar formulário
  if (editingCommand === command) {
    resetForm();
  }
  
  // Recarregar lista
  loadMacros();
}

// Mostrar mensagem de sucesso
function showSuccessMessage(message = 'Macro salva com sucesso!') {
  successMessage.textContent = message;
  successMessage.classList.add('show');
  
  setTimeout(() => {
    successMessage.classList.remove('show');
  }, 2000);
}

// Função auxiliar para escapar HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Remover # automaticamente se o usuário tentar digitar
commandInput.addEventListener('input', (e) => {
  let value = e.target.value;
  // Remover todos os # do início
  while (value.startsWith('#')) {
    value = value.substring(1);
  }
  if (e.target.value !== value) {
    e.target.value = value;
  }
});

// Atalho: pressionar Enter no campo de comando move para o campo de mensagem
commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    messageInput.focus();
  }
});
