const API_BASE = 'http://localhost:5001/api';
let assistants = {};

// Load Dashboard Data
document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchReservations();
    
    // Auto-refresh stats and reservations every 10 seconds
    setInterval(() => {
        fetchStats();
        fetchReservations();
    }, 10000);
});

async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const data = await response.json();
        
        const grid = document.getElementById('stats-grid');
        grid.innerHTML = `
            <div class="stat-card">
                <h3>Reservations Today</h3>
                <div class="value">${data.reservations_today}</div>
            </div>
            <div class="stat-card">
                <h3>Active Calls</h3>
                <div class="value">${data.active_calls}</div>
            </div>
            <div class="stat-card">
                <h3>Housekeeping/Feedback</h3>
                <div class="value">${data.housekeeping_requests + data.feedback_calls_made}</div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

let currentReservations = [];

async function fetchReservations() {
    try {
        const response = await fetch(`${API_BASE}/reservations`);
        const data = await response.json();
        
        if (data.success) {
            currentReservations = data.reservations;
            renderReservations(data.reservations);
        }
    } catch (error) {
        console.error('Failed to fetch reservations:', error);
    }
}

function renderReservations(reservations) {
    const list = document.getElementById('reservations-list');
    
    if (!reservations || reservations.length === 0) {
        list.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <i class="fas fa-calendar-alt"></i> No reservations yet today.
                </td>
            </tr>
        `;
        return;
    }
    
    list.innerHTML = reservations.map(res => `
        <tr onclick="showDetails('${res.id}')">
            <td><span class="badge-confirmed" style="background: rgba(227, 188, 134, 0.1); color: var(--primary);">${res.assistant_name}</span></td>
            <td><strong>${res.guest_name}</strong><br><small style="color: var(--text-secondary)">${res.phone}</small></td>
            <td>${res.dates}</td>
            <td>${res.room}</td>
            <td>${res.guests}</td>
            <td><span class="badge-confirmed">Completed</span></td>
            <td>${formatTime(res.timestamp)}</td>
        </tr>
    `).join('');
}

function showDetails(id) {
    console.log("Opening details for ID:", id);
    const reservation = currentReservations.find(r => r.id === id);
    
    if (!reservation) {
        console.error("Reservation not found in current list!");
        return;
    }

    const drawer = document.getElementById('details-drawer');
    const content = document.getElementById('drawer-content');
    
    if (!drawer || !content) {
        console.error("Drawer elements not found in DOM!");
        return;
    }

    const extras = reservation.extras || 'None';
    let extrasHtml = '<p style="color: var(--text-secondary)">No special requests</p>';
    
    if (extras !== 'None') {
        if (Array.isArray(extras)) {
            extrasHtml = extras.map(e => `<span class="extra-tag">${e}</span>`).join('');
        } else if (typeof extras === 'string') {
            extrasHtml = extras.split(',').map(e => `<span class="extra-tag">${e.trim()}</span>`).join('');
        }
    }

    content.innerHTML = `
        <div class="detail-section">
            <h3>Guest Information</h3>
            <div class="detail-card">
                <div class="detail-item">
                    <div class="label">Name</div>
                    <div class="value">${reservation.guest_name}</div>
                </div>
                <div class="detail-item" style="margin-top: 1rem;">
                    <div class="label">Phone Number</div>
                    <div class="value">${reservation.phone}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>Stay Details</h3>
            <div class="detail-card detail-grid">
                <div class="detail-item">
                    <div class="label">Dates</div>
                    <div class="value">${reservation.dates}</div>
                </div>
                <div class="detail-item">
                    <div class="label">Room Type</div>
                    <div class="value">${reservation.room}</div>
                </div>
                <div class="detail-item">
                    <div class="label">Guests</div>
                    <div class="value">${reservation.guests}</div>
                </div>
                <div class="detail-item">
                    <div class="label">Duration</div>
                    <div class="value">${reservation.duration}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>Extras & Requests</h3>
            <div class="detail-card">
                ${extrasHtml}
            </div>
        </div>

        <div class="detail-section">
            <h3>AI Summary</h3>
            <div class="summary-box">
                "${reservation.summary}"
            </div>
        </div>

        <div class="detail-section">
            <h3>Call Transcript</h3>
            <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick="openTranscript('${reservation.id}')">
                <i class="fas fa-file-alt"></i> View Full Transcript
            </button>
        </div>
    `;

    drawer.classList.add('open');
}

function openTranscript(id) {
    const reservation = currentReservations.find(r => r.id === id);
    if (!reservation || !reservation.transcript) {
        showToast("Transcript not available for this call.");
        return;
    }

    const modal = document.getElementById('transcript-modal');
    const textContainer = document.getElementById('transcript-text');

    // Format transcript with roles highlighted
    const formattedTranscript = reservation.transcript
        .replace(/Assistant:/g, '<div class="transcript-line"><b>Assistant</b>')
        .replace(/Guest:/g, '</div><div class="transcript-line"><b>Guest</b>')
        .replace(/User:/g, '</div><div class="transcript-line"><b>Guest</b>')
        + '</div>';

    textContainer.innerHTML = formattedTranscript;
    modal.classList.add('show');
}

function closeTranscript() {
    document.getElementById('transcript-modal').classList.remove('show');
}

function closeDrawer() {
    document.getElementById('details-drawer').classList.remove('open');
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Assistant Initialization
async function initAssistant(type) {
    const card = document.getElementById(`agent-${type}`);
    const initBtn = card.querySelector('.btn-primary');
    
    // UI Update during creation
    initBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    initBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/assistants/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type })
        });

        const data = await response.json();

        if (data.success) {
            assistants[type] = data.assistant.id;
            
            // Update UI
            initBtn.style.display = 'none';
            // Enable next button if it exists
            const nextBtn = card.querySelector('.btn-secondary');
            if (nextBtn) nextBtn.disabled = false;
            
            const statusIndicator = card.querySelector('.status-indicator');
            statusIndicator.classList.add('active');
            statusIndicator.innerHTML = '<span class="dot"></span> Online (ID: ' + data.assistant.id.substring(0,6) + '...)';
            
            showToast(`${capitalize(type)} Assistant Initialized!`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showToast(`Error: ${error.message}`);
        initBtn.innerHTML = '<i class="fas fa-power-off"></i> Initialize';
        initBtn.disabled = false;
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

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
