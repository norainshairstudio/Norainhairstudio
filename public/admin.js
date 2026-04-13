let appointments = [];
let closedDates = [];
let currentDay = new Date();
let latestNotificationId = null;

function getLocalToday() {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
}

async function loadAppointments() {
    const response = await fetch('/api/appointments');
    if (response.status === 401) { window.location.href = '/login'; return; }
    if (response.ok) {
        const data = await response.json();
        appointments = data.appointments || [];
        closedDates = data.closedDates || [];
    }
}

function renderStats() {
    document.getElementById('pending-count').textContent = appointments.filter(a => a.status === 'pending').length;
    document.getElementById('accepted-count').textContent = appointments.filter(a => a.status === 'accepted').length;
}

function formatFullDate(date) { return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
function formatTimeDisplay(time) {
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function buildDayId(date) { return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; }

function isMonday(date) { return date.getDay() === 1; }

function updateNavButtons() {
    const prevBtn = document.getElementById('prev-day');
    if (!prevBtn) return;
    const viewingDay = new Date(currentDay); viewingDay.setHours(0,0,0,0);
    if (viewingDay <= getLocalToday()) { prevBtn.disabled = true; prevBtn.style.opacity = '0.3'; prevBtn.style.cursor = 'not-allowed'; } 
    else { prevBtn.disabled = false; prevBtn.style.opacity = '1'; prevBtn.style.cursor = 'pointer'; }
}

function renderDayDetail() {
    const dayStr = buildDayId(currentDay);
    const dayApps = appointments.filter(app => app.date === dayStr);
    const detailList = document.getElementById('day-detail-list');
    const closeBtn = document.getElementById('close-day-btn');
    detailList.innerHTML = '';
    
    document.getElementById('detail-title').textContent = currentDay.toLocaleDateString('en-US', { weekday: 'long' });
    document.getElementById('detail-subtitle').textContent = formatFullDate(currentDay);
    
    if (isMonday(currentDay) || closedDates.includes(dayStr)) {
        document.getElementById('day-status').textContent = '🚨 CLOSED';
        document.getElementById('day-status').style.color = '#EF4444';
        closeBtn.classList.add('hidden');
        detailList.innerHTML = '<div class="detail-card"><p style="color:#718096; text-align:center;">Salon is closed on this day.</p></div>';
        return;
    }

    document.getElementById('day-status').textContent = `${dayApps.filter(a=>a.status==='pending').length} Pending • ${dayApps.filter(a=>a.status==='accepted').length} Accepted`;
    document.getElementById('day-status').style.color = '#d4af37';
    
    const viewingDay = new Date(currentDay); viewingDay.setHours(0,0,0,0);
    if(viewingDay >= getLocalToday()) closeBtn.classList.remove('hidden');
    else closeBtn.classList.add('hidden');

    if (dayApps.length === 0) {
        detailList.innerHTML = '<div class="detail-card"><p style="color:#718096; text-align:center;">No bookings scheduled.</p></div>';
        return;
    }

    dayApps.forEach(req => {
        if(req.status === 'rejected') return; 

        const card = document.createElement('div');
        card.className = 'detail-card';
        card.innerHTML = `
            <div class="meta"><span>${req.name}</span><span style="color:#2d3748; font-weight: bold;">${formatTimeDisplay(req.time)}</span></div>
            <h3 style="margin:5px 0; color:#d4af37;">${req.service}</h3>
            <p style="margin:5px 0; color:#4a5568;">Phone: ${req.phone}</p>
            <div style="margin-bottom:10px;"><span style="font-size: 11px; background:#1a202c; color:#d4af37; padding:3px 8px; border-radius:4px; font-weight:bold;">Token #${req.tokenId || 'N/A'}</span></div>
        `;

        // NAYA: Payment Screenshot Button
        let viewImgBtn = '';
        if(req.paymentImage) {
            viewImgBtn = `<button onclick="viewPaymentImage('${req.id}')" style="background:#1a202c; color:#d4af37; border:none; padding:8px; border-radius:6px; cursor:pointer; width:100%; margin-bottom:10px; font-weight:bold;">📸 View Payment Screenshot</button>`;
        }

        if (req.status === 'pending') {
            const actions = document.createElement('div');
            actions.innerHTML = viewImgBtn + `<div class="action-btns"><button class="confirm-btn" onclick="updateStatus('${req.id}', 'accepted')">Accept</button><button class="reject-btn" onclick="updateStatus('${req.id}', 'rejected')">Reject</button></div>`;
            card.appendChild(actions);
        } else {
            card.innerHTML += viewImgBtn + `<p style="color: #10B981; font-weight:600; margin-top:10px; font-size:13px;">✓ Confirmed via WhatsApp</p>`;
        }
        detailList.appendChild(card);
    });
}

async function updateStatus(id, status) {
    const res = await fetch(`/api/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) {
        await loadAppointments();
        renderStats(); renderRequestList(); renderTodaySummary(); renderDayDetail();
        const panel = document.getElementById('all-requests-panel');
        if (panel && !panel.classList.contains('hidden')) renderAllRequests();
        showToast(status === 'accepted' ? 'Accepted & WhatsApp sent!' : 'Request Rejected!', status === 'accepted' ? 'success' : 'error');
    }
}

document.getElementById('close-day-btn')?.addEventListener('click', async () => {
    if(!confirm("Are you sure? This will REJECT all pending/accepted bookings for this day and close the salon.")) return;
    
    const dayStr = buildDayId(currentDay);
    const res = await fetch('/api/closedates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dayStr }) });
    if(res.ok) {
        await loadAppointments();
        renderDayDetail(); renderTodaySummary(); renderRequestList(); renderStats();
        showToast('Day closed successfully. Clients blocked.', 'error');
    }
});

function renderTodaySummary() {
    const list = document.getElementById('today-list'); if(!list) return;
    list.innerHTML = '';
    const todayApps = appointments.filter(app => app.date === buildDayId(new Date()) && app.status !== 'rejected');
    if (todayApps.length === 0) return list.innerHTML = '<div class="detail-card"><p style="color:#718096; text-align:center;">No schedule for today.</p></div>';

    todayApps.forEach(req => {
        const card = document.createElement('div'); card.className = 'detail-card';
        card.innerHTML = `<div class="meta"><span>${formatTimeDisplay(req.time)}</span><span style="color:${req.status === 'accepted' ? '#10B981' : '#d4af37'}">${req.status.toUpperCase()}</span></div>
            <h3 style="margin:5px 0; color:#2d3748;">${req.service}</h3><p style="margin:0; color:#718096; font-size:14px;">${req.name}</p>`;
        list.appendChild(card);
    });
}

function renderAllRequests(fromDate = null, toDate = null) {
    const list = document.getElementById('all-requests-list'); if(!list) return;
    let filtered = fromDate || toDate ? appointments.filter(a => {
        const d = new Date(a.date).getTime();
        return d >= (fromDate ? new Date(fromDate).getTime() : 0) && d <= (toDate ? new Date(toDate).getTime() : Infinity);
    }) : appointments;

    list.innerHTML = '';
    if (filtered.length === 0) return list.innerHTML = '<div class="detail-card" style="grid-column: 1/-1;"><p style="color:#718096; text-align:center;">No ledger data.</p></div>';

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(req => {
        const card = document.createElement('div'); card.className = 'request-card';
        let color = req.status === 'accepted' ? '#10B981' : req.status === 'rejected' ? '#EF4444' : '#d4af37';
        card.innerHTML = `<div class="meta"><span>${req.date}</span><span style="color:#2d3748">${formatTimeDisplay(req.time)}</span></div>
            <h3 style="margin:5px 0; color:#2d3748;">${req.service}</h3><p style="margin:5px 0; color:#718096;">${req.name}</p>
            <p style="margin:10px 0 0 0; font-size:12px;">STATUS: <strong style="color:${color}">${req.status.toUpperCase()}</strong></p>`;
        list.appendChild(card);
    });
}

function exportToExcel() {
    const fromDate = document.getElementById('filter-from-date')?.value;
    const toDate = document.getElementById('filter-to-date')?.value;
    
    let filtered = appointments;
    if (fromDate || toDate) {
        filtered = appointments.filter(a => {
            const appDate = new Date(a.date).getTime();
            const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
            const toTime = toDate ? new Date(toDate).getTime() : Infinity;
            return appDate >= fromTime && appDate <= toTime;
        });
    }

    if (filtered.length === 0) {
        alert("No data available to export for this date range.");
        return;
    }

    const dataToExport = filtered.map(row => ({
        "Token ID": row.tokenId || 'N/A',
        "Customer Name": row.name,
        "Phone Number": row.phone,
        "Service Selected": row.service,
        "Amount": row.price || 0,
        "Appointment Date": row.date,
        "Time": row.time,
        "Status": row.status.toUpperCase(),
        "Booked On": new Date(row.createdAt).toLocaleString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

    let fileName = "Norain_Appointments";
    if(fromDate || toDate) fileName += `_${fromDate || 'Start'}_to_${toDate || 'End'}`;
    fileName += ".xlsx";

    XLSX.writeFile(workbook, fileName);
}

function renderRequestList() {
    const list = document.getElementById('request-list'); if(!list) return;
    list.innerHTML = '';
    const pending = appointments.filter(a => a.status === 'pending');
    if (pending.length === 0) return list.innerHTML = '<div class="detail-card"><p style="color:#718096; text-align:center;">Inbox zero.</p></div>';

    pending.forEach(req => {
        const card = document.createElement('div'); card.className = 'request-card';
        card.innerHTML = `
            <div class="meta"><span>${req.name}</span><span style="color:#2d3748; font-weight: bold;">${formatTimeDisplay(req.time)}</span></div>
            <h3 style="margin:5px 0; color:#d4af37;">${req.service}</h3>
            <p style="margin:5px 0; color:#718096;">Date: ${req.date}</p>
            <div style="margin-bottom:10px;"><span style="font-size: 11px; background:#1a202c; color:#d4af37; padding:3px 8px; border-radius:4px; font-weight:bold;">Token #${req.tokenId || 'N/A'}</span></div>
        `;
        
        let viewImgBtn = '';
        if(req.paymentImage) {
            viewImgBtn = `<button onclick="viewPaymentImage('${req.id}')" style="background:#1a202c; color:#d4af37; border:none; padding:8px; border-radius:6px; cursor:pointer; width:100%; margin-bottom:10px; font-weight:bold;">📸 View Screenshot</button>`;
        }

        const actions = document.createElement('div');
        actions.innerHTML = viewImgBtn + `<div class="action-btns"><button class="confirm-btn" onclick="updateStatus('${req.id}', 'accepted')">Accept</button><button class="reject-btn" onclick="updateStatus('${req.id}', 'rejected')">Reject</button></div>`;
        
        card.appendChild(actions); 
        list.appendChild(card);
    });
}

function showToast(msg, type = 'success') {
    const cont = document.getElementById('toast-container'); if (!cont) return;
    const t = document.createElement('div'); t.className = `toast toast-${type}`;
    if(type==='error') t.style.borderLeftColor = '#EF4444';
    t.textContent = msg; cont.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

function checkForNewRequests() {
    const latest = [...appointments].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (latest && latest.id !== latestNotificationId && latest.status === 'pending') {
        latestNotificationId = latest.id;
        showToast(`New booking from ${latest.name}!`, 'success');
    }
}

// NAYA: Image dekhne ka function
window.viewPaymentImage = function(id) {
    const app = appointments.find(a => a.id === id);
    if(app && app.paymentImage) {
        document.getElementById('payment-proof-img').src = app.paymentImage;
        document.getElementById('image-modal').classList.remove('hidden');
    } else {
        showToast('No screenshot available.', 'error');
    }
};

document.getElementById('close-image-btn')?.addEventListener('click', () => {
    document.getElementById('image-modal').classList.add('hidden');
});

async function initializeAdmin() {
    await loadAppointments();
    currentDay = getLocalToday();
    renderStats(); renderRequestList(); renderTodaySummary(); renderDayDetail(); updateNavButtons();
    document.getElementById('current-day').textContent = formatFullDate(currentDay);

    document.getElementById('prev-day').onclick = () => {
        if (new Date(currentDay).setHours(0,0,0,0) > getLocalToday()) {
            currentDay.setDate(currentDay.getDate() - 1);
            document.getElementById('current-day').textContent = formatFullDate(currentDay);
            renderDayDetail(); updateNavButtons();
        }
    };

    document.getElementById('next-day').onclick = () => {
        currentDay.setDate(currentDay.getDate() + 1);
        document.getElementById('current-day').textContent = formatFullDate(currentDay);
        renderDayDetail(); updateNavButtons();
    };

    document.getElementById('change-password-btn').onclick = () => {
        document.getElementById('password-modal').classList.remove('hidden');
        document.querySelector('.btn-group').classList.remove('active'); 
    };
    
    document.getElementById('cancel-password').onclick = () => { document.getElementById('password-modal').classList.add('hidden'); document.getElementById('password-form').reset(); };
    
    document.getElementById('view-all-btn').onclick = () => { 
        document.getElementById('all-requests-panel').classList.toggle('hidden'); 
        renderAllRequests(); 
        document.querySelector('.btn-group').classList.remove('active'); 
    };
    
    document.getElementById('filter-btn')?.addEventListener('click', () => renderAllRequests(document.getElementById('filter-from-date').value, document.getElementById('filter-to-date').value));
    document.getElementById('clear-filter-btn')?.addEventListener('click', () => { document.getElementById('filter-from-date').value = ''; document.getElementById('filter-to-date').value = ''; renderAllRequests(); });
    
    document.getElementById('export-btn')?.addEventListener('click', exportToExcel);
    
    document.getElementById('logout-btn').onclick = async () => { await fetch('/logout', { method: 'POST' }); window.location.href = '/login'; };

    document.getElementById('password-form').onsubmit = async (e) => {
        e.preventDefault();
        const cp = document.getElementById('current-password').value, np = document.getElementById('new-password').value;
        if (np !== document.getElementById('confirm-password').value) return document.getElementById('password-message').textContent = 'Passwords do not match.';
        const res = await fetch('/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: cp, newPassword: np }) });
        const result = await res.json();
        document.getElementById('password-message').style.color = result.success ? '#10B981' : '#EF4444';
        document.getElementById('password-message').textContent = result.message;
        if (result.success) setTimeout(() => window.location.href = '/login', 2000);
    };

    const adminMobileBtn = document.querySelector('.admin-mobile-menu-btn');
    const adminMenu = document.querySelector('.btn-group');
    const adminCloseBtn = document.querySelector('.close-admin-menu-btn');

    if (adminMobileBtn && adminMenu) {
        adminMobileBtn.addEventListener('click', () => adminMenu.classList.add('active'));
        adminCloseBtn.addEventListener('click', () => adminMenu.classList.remove('active'));
    }

    setInterval(async () => {
        await loadAppointments(); renderStats(); renderRequestList(); renderTodaySummary(); renderDayDetail();
        if (!document.getElementById('all-requests-panel').classList.contains('hidden')) renderAllRequests();
        checkForNewRequests();
    }, 10000);
}

initializeAdmin();