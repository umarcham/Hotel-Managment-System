const API_BASE = 'http://localhost:5001/api';
let allAssistants = [];
let currentAssistantId = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchAssistants();
    
    document.getElementById('assistant-form').addEventListener('submit', handleSave);
    document.getElementById('btn-delete').addEventListener('click', handleDelete);
});

async function fetchAssistants() {
    try {
        const response = await fetch(`${API_BASE}/assistants`);
        const data = await response.json();
        
        if (data.success) {
            allAssistants = data.assistants;
            renderAssistantsList();
        } else {
            showToast('Failed to load assistants.');
        }
    } catch (err) {
        showToast('Error connecting to backend.');
    }
}

function renderAssistantsList() {
    const list = document.getElementById('assistants-list');
    list.innerHTML = '';
    
    if (allAssistants.length === 0) {
        list.innerHTML = '<div class="assistant-item"><p>No assistants found. Create one!</p></div>';
        return;
    }

    allAssistants.forEach(assistant => {
        const div = document.createElement('div');
        div.className = `assistant-item ${currentAssistantId === assistant.id ? 'selected' : ''}`;
        div.onclick = () => selectAssistant(assistant.id);
        
        div.innerHTML = `
            <h4>${assistant.name || 'Unnamed Assistant'}</h4>
            <p>${assistant.id.substring(0, 8)}...${assistant.id.substring(assistant.id.length - 4)}</p>
        `;
        list.appendChild(div);
    });
}

function selectAssistant(id) {
    currentAssistantId = id;
    renderAssistantsList(); // Update selected styling
    
    const assistant = allAssistants.find(a => a.id === id);
    if (!assistant) return;
    
    document.getElementById('assistant-name-display').textContent = assistant.name || 'Unnamed Assistant';
    document.getElementById('assistant-id-display').textContent = `ID: ${assistant.id}`;
    
    // Fill form
    document.getElementById('input-name').value = assistant.name || '';
    document.getElementById('input-first-message').value = assistant.firstMessage || '';
    
    // Set First Message Mode if available
    if (assistant.firstMessageMode) {
        document.getElementById('input-first-msg-mode').value = assistant.firstMessageMode;
    }
    
    if (assistant.model && assistant.model.messages && assistant.model.messages.length > 0) {
        document.getElementById('input-system-prompt').value = assistant.model.messages[0].content || '';
    } else {
        document.getElementById('input-system-prompt').value = '';
    }
    
    if (assistant.model) {
        document.getElementById('input-tokens').value = assistant.model.maxTokens || 250;
        document.getElementById('val-tokens').textContent = assistant.model.maxTokens || 250;
        
        document.getElementById('input-temp').value = assistant.model.temperature || 0.7;
        document.getElementById('val-temp').textContent = assistant.model.temperature || 0.7;
    }
    
    // Enable form fields for editing
    setFormDisabled(false);
    document.getElementById('form-actions').style.display = 'flex';
    document.getElementById('btn-save').innerHTML = '<i class="fas fa-save"></i> Save Changes';
    document.getElementById('btn-delete').disabled = false;
}

function openCreateMode() {
    currentAssistantId = null;
    renderAssistantsList();
    
    document.getElementById('assistant-name-display').textContent = 'Create New Assistant';
    document.getElementById('assistant-id-display').textContent = 'Fill in the details below to publish a new AI agent.';
    
    document.getElementById('assistant-form').reset();
    document.getElementById('val-tokens').textContent = '250';
    document.getElementById('val-temp').textContent = '0.7';
    
    setFormDisabled(false);
    document.getElementById('form-actions').style.display = 'flex';
    document.getElementById('btn-save').innerHTML = '<i class="fas fa-rocket"></i> Publish Assistant';
    document.getElementById('btn-delete').disabled = true;
}

function setFormDisabled(disabled) {
    const fields = document.querySelectorAll('#assistant-form .input-field, #assistant-form input[type=range], #assistant-form select');
    fields.forEach(f => f.disabled = disabled);
}

async function handleSave(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const isUpdating = !!currentAssistantId;
    
    btn.innerHTML = isUpdating ? '<i class="fas fa-spinner fa-spin"></i> Saving...' : '<i class="fas fa-spinner fa-spin"></i> Publishing...';
    btn.disabled = true;
    
    // Standard payload structure
    const payload = {
        name: document.getElementById('input-name').value,
        firstMessageMode: document.getElementById('input-first-msg-mode').value,
        firstMessage: document.getElementById('input-first-message').value,
        model: {
            provider: "openai",
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: document.getElementById('input-system-prompt').value
                }
            ],
            maxTokens: parseInt(document.getElementById('input-tokens').value),
            temperature: parseFloat(document.getElementById('input-temp').value)
        }
    };
    
    try {
        let url = `${API_BASE}/assistants/custom`;
        let method = 'POST';
        
        if (isUpdating) {
            url = `${API_BASE}/assistants/${currentAssistantId}`;
            method = 'PATCH';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(isUpdating ? 'Assistant updated successfully!' : 'Assistant created successfully!');
            await fetchAssistants();
            selectAssistant(data.assistant.id);
        } else {
            showToast('Error: ' + data.error);
        }
    } catch (err) {
        showToast('Failed to connect to backend.');
    } finally {
        btn.innerHTML = isUpdating ? '<i class="fas fa-save"></i> Save Changes' : '<i class="fas fa-rocket"></i> Publish Assistant';
        btn.disabled = false;
    }
}

async function handleDelete() {
    if (!currentAssistantId) return;
    if (!confirm('Are you sure you want to delete this assistant? This cannot be undone.')) return;
    
    const btn = document.getElementById('btn-delete');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/assistants/${currentAssistantId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Assistant deleted.');
            currentAssistantId = null;
            await fetchAssistants();
            openCreateMode();
        } else {
            showToast('Error deleting assistant.');
        }
    } catch (err) {
        showToast('Failed to connect to backend.');
    } finally {
        btn.innerHTML = '<i class="fas fa-trash"></i> Delete Assistant';
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
