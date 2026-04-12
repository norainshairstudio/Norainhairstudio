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
    
    // EMERGENCY CLOSE LOGIC
    if (isMonday(currentDay) || closedDates.includes(dayStr)) {
        document.getElementById('day-status').textContent = '🚨 CLOSED';
        document.getElementById('day-status').style.color = '#EF4444';
        closeBtn.classList.add('hidden');
        detailList.innerHTML = '<div class="detail-card"><p style="color:#aaa; text-align:center;">Salon is closed on this day.</p></div>';
        return;
    }

    document.getElementById('day-status').textContent = `${dayApps.filter(a=>a.status==='pending').length} Pending • ${dayApps.filter(a=>a.status==='accepted').length} Accepted`;
    document.getElementById('day-status').style.color = '#d4af37';
    
    // Show Close Day Button only for Future/Today
    const viewingDay = new Date(currentDay); viewingDay.setHours(0,0,0,0);
    if(viewingDay >= getLocalToday()) closeBtn.classList.remove('hidden');
    else closeBtn.classList.add('hidden');

    if (dayApps.length === 0) {
        detailList.innerHTML = '<div class="detail-card"><p style="color:#aaa; text-align:center;">No bookings scheduled.</p></div>';
        return;
    }

    dayApps.forEach(req => {
        // Sirf Pending, Accepted dikhao.. Reject wali dashboard history main dekhengy
        if(req.status === 'rejected') return; 

        const card = document.createElement('div');
        card.className = 'detail-card';
        card.innerHTML = `<div class="meta"><span>${req.name}</span><span style="color:#fff">${formatTimeDisplay(req.time)}</span></div>
            <h3 style="margin:5px 0; color:#d4af37;">${req.service}</h3>
            <p style="margin:5px 0; color:#ccc;">Phone: ${req.phone}</p>`;

        if (req.status === 'pending') {
            const btns = document.createElement('div');
            btns.className = 'action-btns';
            btns.innerHTML = `<button class="confirm-btn">Accept</button><button class="reject-btn">Reject</button>`;
            btns.querySelector('.confirm-btn').onclick = () => updateStatus(req.id, 'accepted');
            btns.querySelector('.reject-btn').onclick = () => updateStatus(req.id, 'rejected');
            card.appendChild(btns);
        } else {
            card.innerHTML += `<p style="color: #10B981; font-weight:600; margin-top:10px; font-size:13px;">✓ Confirmed via WhatsApp</p>`;
        }
        detailList.appendChild(card);
    });
}

// NAYA FUNCTION: Update Status (Accept ya Reject)
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

// NAYA FUNCTION: Close Day API Call
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
    if (todayApps.length === 0) return list.innerHTML = '<div class="detail-card"><p style="color:#aaa; text-align:center;">No schedule for today.</p></div>';

    todayApps.forEach(req => {
        const card = document.createElement('div'); card.className = 'detail-card';
        card.innerHTML = `<div class="meta"><span>${formatTimeDisplay(req.time)}</span><span style="color:${req.status === 'accepted' ? '#10B981' : '#d4af37'}">${req.status.toUpperCase()}</span></div>
            <h3 style="margin:5px 0; color:#fff;">${req.service}</h3><p style="margin:0; color:#aaa; font-size:14px;">${req.name}</p>`;
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
    if (filtered.length === 0) return list.innerHTML = '<div class="detail-card" style="grid-column: 1/-1;"><p style="color:#aaa; text-align:center;">No ledger data.</p></div>';

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(req => {
        const card = document.createElement('div'); card.className = 'request-card';
        let color = req.status === 'accepted' ? '#10B981' : req.status === 'rejected' ? '#EF4444' : '#d4af37';
        card.innerHTML = `<div class="meta"><span>${req.date}</span><span style="color:#fff">${formatTimeDisplay(req.time)}</span></div>
            <h3 style="margin:5px 0; color:#fff;">${req.service}</h3><p style="margin:5px 0; color:#aaa;">${req.name}</p>
            <p style="margin:10px 0 0 0; font-size:12px;">STATUS: <strong style="color:${color}">${req.status.toUpperCase()}</strong></p>`;
        list.appendChild(card);
    });
}

function exportToExcel() {
    let csv = "ID,Name,Phone,Service,Date,Time,Status,Created\n";
    appointments.forEach(r => csv += `${r.id},"${r.name}","${r.phone}","${r.service}",${r.date},${r.time},${r.status},"${new Date(r.createdAt).toLocaleString()}"\n`);
    const link = document.createElement("a"); link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
    link.setAttribute("download", "Norain_Ledger.csv"); document.body.appendChild(link); link.click(); link.remove();
}

function renderRequestList() {
    const list = document.getElementById('request-list'); if(!list) return;
    list.innerHTML = '';
    const pending = appointments.filter(a => a.status === 'pending');
    if (pending.length === 0) return list.innerHTML = '<div class="detail-card"><p style="color:#aaa; text-align:center;">Inbox zero.</p></div>';

    pending.forEach(req => {
        const card = document.createElement('div'); card.className = 'request-card';
        card.innerHTML = `<div class="meta"><span>${req.name}</span><span style="color:#fff">${formatTimeDisplay(req.time)}</span></div>
            <h3 style="margin:5px 0; color:#d4af37;">${req.service}</h3><p style="margin:5px 0; color:#aaa;">Date: ${req.date}</p>`;
        const btns = document.createElement('div'); btns.className = 'action-btns';
        btns.innerHTML = `<button class="confirm-btn">Accept</button><button class="reject-btn">Reject</button>`;
        btns.querySelector('.confirm-btn').onclick = () => updateStatus(req.id, 'accepted');
        btns.querySelector('.reject-btn').onclick = () => updateStatus(req.id, 'rejected');
        card.appendChild(btns); list.appendChild(card);
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

    document.getElementById('change-password-btn').onclick = () => document.getElementById('password-modal').classList.remove('hidden');
    document.getElementById('cancel-password').onclick = () => { document.getElementById('password-modal').classList.add('hidden'); document.getElementById('password-form').reset(); };
    document.getElementById('view-all-btn').onclick = () => { document.getElementById('all-requests-panel').classList.toggle('hidden'); renderAllRequests(); };
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

    setInterval(async () => {
        await loadAppointments(); renderStats(); renderRequestList(); renderTodaySummary(); renderDayDetail();
        if (!document.getElementById('all-requests-panel').classList.contains('hidden')) renderAllRequests();
        checkForNewRequests();
    }, 10000);
}

initializeAdmin();