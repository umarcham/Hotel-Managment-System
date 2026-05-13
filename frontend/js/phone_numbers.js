const API_BASE = 'http://localhost:5001/api';
let allPhoneNumbers = [];
let allAssistants = [];
let currentPhoneId = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchPhoneNumbers();
    fetchAssistants();
    
    document.getElementById('phone-number-form').addEventListener('submit', handleSave);
    document.getElementById('btn-delete').addEventListener('click', handleDelete);
});

function toggleAccordion(header) {
    const accordion = header.parentElement;
    accordion.classList.toggle('open');
    const icon = header.querySelector('i');
    if (accordion.classList.contains('open')) {
        icon.className = 'fas fa-chevron-up';
    } else {
        icon.className = 'fas fa-chevron-down';
    }
}

async function fetchAssistants() {
    try {
        const response = await fetch(`${API_BASE}/assistants`);
        const data = await response.json();
        if (data.success) {
            allAssistants = data.assistants;
            populateAssistantDropdown();
        }
    } catch (err) {
        console.error("Failed to load assistants", err);
    }
}

function populateAssistantDropdown() {
    const inboundSelect = document.getElementById('input-inbound-assistant');
    const outboundSelect = document.getElementById('input-outbound-assistant');
    
    inboundSelect.innerHTML = '<option value="">Select Assistant...</option>';
    outboundSelect.innerHTML = '<option value="">Select Assistant...</option>';
    
    allAssistants.forEach(a => {
        const text = `${a.name || 'Unnamed Assistant'} (${a.id})`;
        
        const opt1 = document.createElement('option');
        opt1.value = a.id;
        opt1.textContent = text;
        inboundSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = a.id;
        opt2.textContent = text;
        outboundSelect.appendChild(opt2);
    });
}

async function fetchPhoneNumbers() {
    try {
        const response = await fetch(`${API_BASE}/phone-numbers`);
        const data = await response.json();
        
        if (data.success) {
            allPhoneNumbers = data.phone_numbers;
            renderPhoneNumbersList();
        } else {
            showToast('Failed to load phone numbers.');
        }
    } catch (err) {
        showToast('Error connecting to backend.');
    }
}

function renderPhoneNumbersList() {
    const list = document.getElementById('phone-numbers-list');
    list.innerHTML = '';
    
    if (allPhoneNumbers.length === 0) {
        list.innerHTML = '<div class="assistant-item"><p>No phone numbers imported.</p></div>';
        return;
    }

    allPhoneNumbers.forEach(phone => {
        const div = document.createElement('div');
        div.className = `assistant-item ${currentPhoneId === phone.id ? 'selected' : ''}`;
        div.onclick = () => selectPhoneNumber(phone.id);
        
        div.innerHTML = `
            <h4>${phone.number || 'Unknown Number'}</h4>
            <p>${phone.id}</p>
        `;
        list.appendChild(div);
    });
}

function selectPhoneNumber(id) {
    currentPhoneId = id;
    renderPhoneNumbersList();
    
    const phone = allPhoneNumbers.find(p => p.id === id);
    if (!phone) return;
    
    document.getElementById('no-selection-state').style.display = 'none';
    document.getElementById('config-content').style.display = 'block';
    
    // Fill form
    document.getElementById('input-label').value = phone.name || '';
    document.getElementById('input-server-url').value = phone.serverUrl || '';
    document.getElementById('input-inbound-assistant').value = phone.assistantId || '';
    document.getElementById('input-fallback').value = phone.fallbackDestination?.number || '';
    
    document.getElementById('btn-delete').disabled = false;
}

async function handleSave(e) {
    e.preventDefault();
    if (!currentPhoneId) return;

    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    
    const serverUrl = document.getElementById('input-server-url').value.trim();
    const payload = {
        name: document.getElementById('input-label').value,
        serverUrl: serverUrl || null,
        assistantId: document.getElementById('input-inbound-assistant').value || null
    };
    
    const fallbackNumber = document.getElementById('input-fallback').value;
    if (fallbackNumber) {
        payload.fallbackDestination = { type: "number", number: fallbackNumber };
    }
    
    try {
        const response = await fetch(`${API_BASE}/phone-numbers/${currentPhoneId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Settings saved successfully!');
            await fetchPhoneNumbers();
            selectPhoneNumber(currentPhoneId);
        } else {
            showToast('Error: ' + data.error);
        }
    } catch (err) {
        showToast('Failed to connect to backend.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleDelete() {
    if (!currentPhoneId) return;
    if (!confirm('Are you sure you want to delete this phone number?')) return;
    
    const btn = document.getElementById('btn-delete');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/phone-numbers/${currentPhoneId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Phone number deleted.');
            currentPhoneId = null;
            document.getElementById('no-selection-state').style.display = 'block';
            document.getElementById('config-content').style.display = 'none';
            await fetchPhoneNumbers();
        } else {
            showToast('Error deleting phone number.');
        }
    } catch (err) {
        showToast('Failed to connect to backend.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = currentPhoneId === null;
    }
}

async function importPhoneNumber() {
    // Basic implementation that calls the endpoint you made earlier
    const btn = document.getElementById('btn-create');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/phone-number/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: "Imported Number" })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Phone number imported!');
            await fetchPhoneNumbers();
        } else {
            showToast('Error: Check if credentials are in .env');
        }
    } catch (err) {
        showToast('Failed to import.');
    } finally {
        btn.innerHTML = '<i class="fas fa-plus"></i> Import Phone Number';
        btn.disabled = false;
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

async function makeOutboundCall() {
    if (!currentPhoneId) {
        showToast("Please select a phone number first.");
        return;
    }

    const customerPhone = document.getElementById('input-outbound-customer').value;
    const assistantId = document.getElementById('input-outbound-assistant').value;

    if (!customerPhone || !assistantId) {
        showToast("Please enter a customer number and select an assistant.");
        return;
    }

    const btn = document.getElementById('btn-make-call');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calling...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/calls/outbound`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                customerPhoneNumber: customerPhone,
                phoneNumberId: currentPhoneId,
                assistantId: assistantId 
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showToast(`Call initiated to ${customerPhone}`);
        } else {
            showToast('Error: ' + data.error);
        }
    } catch (error) {
        showToast(`Error triggering call.`);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
