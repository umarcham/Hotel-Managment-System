const API_BASE = 'http://localhost:5001/api';
let allCalls = [];
let currentCallId = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchCalls();
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

async function fetchCalls() {
    try {
        const response = await fetch(`${API_BASE}/calls`);
        const data = await response.json();
        
        if (data.success) {
            // Sort by createdAt descending
            allCalls = data.calls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            renderCallsList();
        } else {
            showToast('Failed to load call logs.');
        }
    } catch (err) {
        showToast('Error connecting to backend.');
    }
}

function renderCallsList() {
    const list = document.getElementById('calls-list');
    list.innerHTML = '';
    
    if (allCalls.length === 0) {
        list.innerHTML = '<div class="assistant-item"><p>No call history found.</p></div>';
        return;
    }

    allCalls.forEach(call => {
        const div = document.createElement('div');
        div.className = `assistant-item ${currentCallId === call.id ? 'selected' : ''}`;
        div.onclick = () => selectCall(call.id);
        
        const dateStr = new Date(call.createdAt).toLocaleString();
        let statusColor = call.status === 'ended' ? 'var(--feedback-color)' : 'var(--text-secondary)';
        if (call.endedReason && call.endedReason.includes('error')) {
            statusColor = 'var(--accent)';
        }
        
        let target = call.type === 'outboundPhoneCall' ? (call.customer?.number || 'Unknown') : 'Inbound Call';

        div.innerHTML = `
            <h4>${target}</h4>
            <p>${dateStr}</p>
            <p style="color: ${statusColor}; margin-top: 0.25rem; font-weight: 600;">${call.status.toUpperCase()}</p>
        `;
        list.appendChild(div);
    });
}

function selectCall(id) {
    currentCallId = id;
    renderCallsList();
    
    const call = allCalls.find(c => c.id === id);
    if (!call) return;
    
    document.getElementById('no-selection-state').style.display = 'none';
    document.getElementById('call-details').style.display = 'block';
    
    // Header
    const isOutbound = call.type === 'outboundPhoneCall';
    document.getElementById('cd-type').textContent = isOutbound ? 'Outbound Call' : 'Inbound Call';
    document.getElementById('cd-id').textContent = `ID: ${call.id}`;
    
    // Metadata
    const durationMins = Math.floor((call.endedAt ? (new Date(call.endedAt) - new Date(call.startedAt)) : 0) / 60000);
    const durationSecs = Math.floor(((call.endedAt ? (new Date(call.endedAt) - new Date(call.startedAt)) : 0) % 60000) / 1000);
    document.getElementById('cd-duration').textContent = `${durationMins}m ${durationSecs}s`;
    
    document.getElementById('cd-cost').textContent = call.cost ? `$${call.cost.toFixed(4)}` : '$0.0000';
    document.getElementById('cd-reason').textContent = call.endedReason || call.status;
    
    // Recording
    const audioContainer = document.getElementById('cd-audio-container');
    const audioEl = document.getElementById('cd-audio');
    if (call.recordingUrl) {
        audioEl.src = call.recordingUrl;
        audioContainer.style.display = 'block';
    } else {
        audioEl.src = '';
        audioContainer.style.display = 'none';
    }
    
    // Summary
    document.getElementById('cd-summary').textContent = call.summary || 'No summary available for this call.';
    
    // Transcript
    const transcriptContainer = document.getElementById('cd-transcript');
    transcriptContainer.innerHTML = '';
    
    if (call.transcript) {
        // Vapi sometimes returns transcript as a single string, or we might parse messages if available
        // If it's a string, we just display it.
        if (typeof call.transcript === 'string') {
            const p = document.createElement('p');
            p.textContent = call.transcript;
            p.style.lineHeight = '1.6';
            transcriptContainer.appendChild(p);
        } else {
            transcriptContainer.innerHTML = '<p style="color: var(--text-secondary);">Transcript format not recognized.</p>';
        }
    } else if (call.messages && call.messages.length > 0) {
        // If they provide a messages array
        call.messages.forEach(msg => {
            if (msg.role === 'system') return;
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`;
            bubble.innerHTML = `
                <div class="role">${msg.role === 'user' ? 'Customer' : 'AI Assistant'}</div>
                <div>${msg.message || msg.content}</div>
            `;
            transcriptContainer.appendChild(bubble);
        });
    } else {
        transcriptContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No transcript available.</p>';
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}
