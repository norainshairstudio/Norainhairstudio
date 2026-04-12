
let appointments = [];
let currentDay = new Date();
let latestNotificationId = null;

async function loadAppointments() {
    const response = await fetch('/api/appointments');
    if (response.status === 401) {
        window.location.href = '/login';
        return;
    }
    if (response.ok) {
        appointments = await response.json();
    }
}

function renderStats() {
    const pendingCount = appointments.filter(a => a.status === 'pending').length;
    const acceptedCount = appointments.filter(a => a.status === 'accepted').length;
    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('accepted-count').textContent = acceptedCount;
    document.getElementById('request-badge').textContent = pendingCount;
}

function formatDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatFullDate(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
}

function formatTimeDisplay(time) {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function buildDayId(date) {
    return date.toISOString().split('T')[0];
}

function getDayAppointments(date) {
    const dateStr = buildDayId(date);
    return appointments.filter(app => app.date === dateStr);
}

function isMonday(date) {
    return date.getDay() === 1;
}

function renderDayDetail() {
    const detailTitle = document.getElementById('detail-title');
    const detailSubtitle = document.getElementById('detail-subtitle');
    const dayStatus = document.getElementById('day-status');
    const detailList = document.getElementById('day-detail-list');
    detailList.innerHTML = '';

    const dayApps = getDayAppointments(currentDay);
    const pending = dayApps.filter(a => a.status === 'pending');
    const accepted = dayApps.filter(a => a.status === 'accepted');

    if (isMonday(currentDay)) {
        detailTitle.textContent = 'Closed - Monday';
        detailSubtitle.textContent = 'No appointments on Mondays.';
        dayStatus.textContent = 'CLOSED';
        return;
    }

    detailTitle.textContent = formatDayName(currentDay);
    detailSubtitle.textContent = formatFullDate(currentDay);
    dayStatus.textContent = `${pending.length} pending • ${accepted.length} accepted`;

    if (dayApps.length === 0) {
        detailList.innerHTML = '<div class="detail-card"><p>No appointments scheduled for this day.</p></div>';
        return;
    }

    dayApps.forEach(request => {
        const card = document.createElement('div');
        card.className = 'detail-card';
        card.innerHTML = `
            <div class="meta"><span>${request.name}</span><span>${formatTimeDisplay(request.time)}</span></div>
            <h3>${request.service}</h3>
            <p>Phone: ${request.phone}</p>
            <p>Status: <strong>${request.status}</strong></p>`;

        if (request.status === 'pending') {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'confirm-btn';
            acceptBtn.textContent = 'Accept Request';
            acceptBtn.addEventListener('click', () => acceptAppointment(request.id));
            card.appendChild(acceptBtn);
        } else {
            const confirmation = document.createElement('div');
            confirmation.style.marginTop = '16px';
            confirmation.innerHTML = `<p><strong>Confirmation sent via WhatsApp.</strong></p>`;
            card.appendChild(confirmation);
        }

        detailList.appendChild(card);
    });
}

async function acceptAppointment(appointmentId) {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
    });
    if (response.ok) {
        await loadAppointments();
        renderStats();
        renderRequestList();
        renderTodaySummary();
        renderDayDetail();
        showPopup('Appointment accepted and WhatsApp confirmation sent.');
    }
}

function renderTodaySummary() {
    const todayList = document.getElementById('today-list');
    todayList.innerHTML = '';
    const todayAppointments = getDayAppointments(currentDay);

    if (todayAppointments.length === 0) {
        todayList.innerHTML = '<div class="detail-card"><p>No appointments scheduled for today.</p></div>';
        return;
    }

    todayAppointments.forEach(request => {
        const card = document.createElement('div');
        card.className = 'detail-card';
        card.innerHTML = `
            <div class="meta"><span>${formatTimeDisplay(request.time)}</span><span>${request.status.toUpperCase()}</span></div>
            <h3>${request.service}</h3>
            <p>${request.name} • ${request.phone}</p>`;
        todayList.appendChild(card);
    });
}

function renderRequestList() {
    const requestList = document.getElementById('request-list');
    requestList.innerHTML = '';
    const pendingRequests = appointments.filter(a => a.status === 'pending');

    if (pendingRequests.length === 0) {
        requestList.innerHTML = '<div class="detail-card"><p>No pending requests at the moment.</p></div>';
        return;
    }

    pendingRequests.forEach(request => {
        const card = document.createElement('div');
        card.className = 'request-card';

        card.innerHTML = `<div class="meta"><span>${request.name}</span><span>${formatTimeDisplay(request.time)}</span></div>
            <h3>${request.service}</h3>
            <p>${formatFullDate(new Date(request.date))}</p>
            <p>Phone: ${request.phone}</p>`;

        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'confirm-btn';
        acceptBtn.textContent = 'Accept';
        acceptBtn.addEventListener('click', () => acceptAppointment(request.id));

        card.appendChild(acceptBtn);
        requestList.appendChild(card);
    });
}

function showPopup(message) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    const actionBtn = document.getElementById('notification-action');

    notificationText.textContent = message;
    notification.classList.remove('hidden');
    actionBtn.textContent = 'Close';
    actionBtn.onclick = () => notification.classList.add('hidden');
}

function checkForNewRequests() {
    const latest = appointments[0];
    if (latest && latest.id !== latestNotificationId) {
        latestNotificationId = latest.id;
        const text = `New booking from ${latest.name} for ${latest.service} at ${formatTimeDisplay(latest.time)}.`;
        showPopup(text);
    }
}

async function initializeAdmin() {
    await loadAppointments();
    renderStats();
    renderRequestList();
    renderTodaySummary();
    renderDayDetail();
    document.getElementById('current-day').textContent = formatFullDate(currentDay);

    document.getElementById('prev-day').addEventListener('click', () => {
        currentDay.setDate(currentDay.getDate() - 1);
        document.getElementById('current-day').textContent = formatFullDate(currentDay);
        renderDayDetail();
    });
    document.getElementById('next-day').addEventListener('click', () => {
        currentDay.setDate(currentDay.getDate() + 1);
        document.getElementById('current-day').textContent = formatFullDate(currentDay);
        renderDayDetail();
    });

    document.getElementById('change-password-btn').addEventListener('click', () => {
        document.getElementById('password-modal').classList.remove('hidden');
    });

    document.getElementById('cancel-password').addEventListener('click', () => {
        document.getElementById('password-modal').classList.add('hidden');
        document.getElementById('password-form').reset();
        document.getElementById('password-message').textContent = '';
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const message = document.getElementById('password-message');

        if (newPassword !== confirmPassword) {
            message.textContent = 'New passwords do not match.';
            return;
        }

        const response = await fetch('/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const result = await response.json();
        if (result.success) {
            message.textContent = result.message;
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            message.textContent = result.message;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await fetch('/logout', { method: 'POST' });
        } catch (e) {
            console.log("Logout api issue", e);
        }
        window.location.href = '/login';
    });

    // Poll for new appointments every 10 seconds
    setInterval(async () => {
        await loadAppointments();
        renderStats();
        renderRequestList();
        renderTodaySummary();
        renderDayDetail();
        checkForNewRequests();
    }, 10000);
}

initializeAdmin();