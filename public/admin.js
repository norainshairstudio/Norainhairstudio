let appointments = [];
let currentDay = new Date();
let latestNotificationId = null;

// Helper function: Aaj ka din nikalne ke liye (bina waqt ke)
function getLocalToday() {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
}

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
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

function getDayAppointments(date) {
    const dateStr = buildDayId(date);
    return appointments.filter(app => app.date === dateStr);
}

function isMonday(date) {
    return date.getDay() === 1;
}

// Previous Button ko past days par jaane se rokne ka logic
function updateNavButtons() {
    const prevBtn = document.getElementById('prev-day');
    if (!prevBtn) return;
    
    const today = getLocalToday();
    const viewingDay = new Date(currentDay);
    viewingDay.setHours(0,0,0,0);
    
    if (viewingDay <= today) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = '0.4';
        prevBtn.style.cursor = 'not-allowed';
    } else {
        prevBtn.disabled = false;
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
    }
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
            <h3 style="margin-top:5px; margin-bottom:5px;">${request.service}</h3>
            <p style="margin:5px 0;">Phone: ${request.phone}</p>
            <p style="margin:5px 0;">Status: <strong>${request.status.toUpperCase()}</strong></p>`;

        if (request.status === 'pending') {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'confirm-btn';
            acceptBtn.textContent = 'Accept Request';
            acceptBtn.addEventListener('click', () => acceptAppointment(request.id));
            card.appendChild(acceptBtn);
        } else {
            const confirmation = document.createElement('div');
            confirmation.style.marginTop = '10px';
            confirmation.innerHTML = `<p style="color: #10B981; font-weight:bold; margin:0;">✓ Confirmed via WhatsApp.</p>`;
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
        
        // Agar all requests panel khula hai to usay bhi refresh karo
        const panel = document.getElementById('all-requests-panel');
        if (panel && !panel.classList.contains('hidden')) {
            const fromDate = document.getElementById('filter-from-date')?.value;
            const toDate = document.getElementById('filter-to-date')?.value;
            renderAllRequests(fromDate, toDate);
        }
        
        showToast('Appointment accepted & WhatsApp confirmation sent!', 'success');
    }
}

function renderTodaySummary() {
    const todayList = document.getElementById('today-list');
    if(!todayList) return;
    todayList.innerHTML = '';
    
    // Hamesha local aaj ka din uthayega
    const todayAppointments = appointments.filter(app => app.date === buildDayId(new Date()));

    if (todayAppointments.length === 0) {
        todayList.innerHTML = '<div class="detail-card"><p>No appointments scheduled for today.</p></div>';
        return;
    }

    todayAppointments.forEach(request => {
        const card = document.createElement('div');
        card.className = 'detail-card';
        card.innerHTML = `
            <div class="meta"><span>${formatTimeDisplay(request.time)}</span><span style="color:${request.status === 'accepted' ? '#10B981' : '#f59e0b'}">${request.status.toUpperCase()}</span></div>
            <h3 style="margin-top:5px; margin-bottom:5px;">${request.service}</h3>
            <p style="margin:5px 0;">${request.name} • ${request.phone}</p>`;
        todayList.appendChild(card);
    });
}

// Nayi Logic: Date Range (From/To) Filter
function renderAllRequests(fromDate = null, toDate = null) {
    const allRequestsList = document.getElementById('all-requests-list');
    if(!allRequestsList) return;
    
    let filtered = appointments;

    // Filter Logic
    if (fromDate || toDate) {
        filtered = appointments.filter(a => {
            const appDate = new Date(a.date).getTime();
            const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
            const toTime = toDate ? new Date(toDate).getTime() : Infinity;
            return appDate >= fromTime && appDate <= toTime;
        });
    }

    allRequestsList.innerHTML = '';
    if (filtered.length === 0) {
        allRequestsList.innerHTML = '<div class="detail-card"><p>No requests found for the selected filters.</p></div>';
        return;
    }

    // Sab se nayi request sab se oopar aayegi
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    filtered.forEach(request => {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
            <div class="meta"><span>${formatFullDate(new Date(request.date))}</span><span>${formatTimeDisplay(request.time)}</span></div>
            <h3 style="margin:5px 0;">${request.service}</h3>
            <p style="margin:5px 0;">${request.name} • ${request.phone}</p>
            <p style="margin:5px 0;">Status: <strong style="color:${request.status === 'accepted' ? '#10B981' : '#f59e0b'}">${request.status.toUpperCase()}</strong></p>`;
        allRequestsList.appendChild(card);
    });
}

// Excel Export Logic (CSV Format)
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

    // Excel CSV Header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Booking ID,Name,Phone,Service,Date,Time,Status,Booked On\n";

    filtered.forEach(row => {
        // Commas aur spaces se data kharab na ho isliye quotes ("") lagaye hain
        const rowData = [
            row.id,
            `"${row.name}"`,
            `"${row.phone}"`,
            `"${row.service}"`,
            row.date,
            row.time,
            row.status,
            `"${new Date(row.createdAt).toLocaleString()}"`
        ];
        csvContent += rowData.join(",") + "\n";
    });

    // File Download karwana
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    let fileName = "Norain_Appointments";
    if(fromDate || toDate) fileName += `_${fromDate || 'Start'}_to_${toDate || 'End'}`;
    link.setAttribute("download", fileName + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderRequestList() {
    const requestList = document.getElementById('request-list');
    if(!requestList) return;
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
            <h3 style="margin:5px 0;">${request.service}</h3>
            <p style="margin:5px 0;">${formatFullDate(new Date(request.date))}</p>
            <p style="margin:5px 0;">Phone: ${request.phone}</p>`;

        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'confirm-btn';
        acceptBtn.textContent = 'Accept';
        acceptBtn.addEventListener('click', () => acceptAppointment(request.id));

        card.appendChild(acceptBtn);
        requestList.appendChild(card);
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function checkForNewRequests() {
    // Latest request check karne ke liye sort karna zaroori hai
    const sortedApps = [...appointments].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latest = sortedApps[0];
    
    if (latest && latest.id !== latestNotificationId) {
        latestNotificationId = latest.id;
        showToast(`New pending booking from ${latest.name} for ${latest.service}.`, 'success');
    }
}

async function initializeAdmin() {
    await loadAppointments();
    
    // Set Current Day exactly to Local Today
    currentDay = getLocalToday();
    
    renderStats();
    renderRequestList();
    renderTodaySummary();
    renderDayDetail();
    updateNavButtons();
    document.getElementById('current-day').textContent = formatFullDate(currentDay);

    // Day Navigation Buttons
    document.getElementById('prev-day').addEventListener('click', () => {
        const today = getLocalToday();
        const viewingDay = new Date(currentDay);
        viewingDay.setHours(0,0,0,0);
        
        // Agar aaj ka din hai to peeche janay ki ijazat nahi
        if (viewingDay > today) {
            currentDay.setDate(currentDay.getDate() - 1);
            document.getElementById('current-day').textContent = formatFullDate(currentDay);
            renderDayDetail();
            updateNavButtons();
        }
    });

    document.getElementById('next-day').addEventListener('click', () => {
        currentDay.setDate(currentDay.getDate() + 1);
        document.getElementById('current-day').textContent = formatFullDate(currentDay);
        renderDayDetail();
        updateNavButtons();
    });

    document.getElementById('change-password-btn').addEventListener('click', () => {
        document.getElementById('password-modal').classList.remove('hidden');
    });

    document.getElementById('cancel-password').addEventListener('click', () => {
        document.getElementById('password-modal').classList.add('hidden');
        document.getElementById('password-form').reset();
        document.getElementById('password-message').textContent = '';
    });

    document.getElementById('view-all-btn').addEventListener('click', () => {
        const panel = document.getElementById('all-requests-panel');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            renderAllRequests();
        }
    });

    // New Filter and Export Listeners
    document.getElementById('filter-btn')?.addEventListener('click', () => {
        const fromDate = document.getElementById('filter-from-date').value;
        const toDate = document.getElementById('filter-to-date').value;
        renderAllRequests(fromDate, toDate);
    });

    document.getElementById('clear-filter-btn')?.addEventListener('click', () => {
        document.getElementById('filter-from-date').value = '';
        document.getElementById('filter-to-date').value = '';
        renderAllRequests();
    });

    document.getElementById('export-btn')?.addEventListener('click', exportToExcel);

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
            message.style.color = "green";
            message.textContent = result.message;
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            message.style.color = "red";
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
        
        // All Requests pane agar khula hai to refresh kro
        const panel = document.getElementById('all-requests-panel');
        if (panel && !panel.classList.contains('hidden')) {
            const fromDate = document.getElementById('filter-from-date')?.value;
            const toDate = document.getElementById('filter-to-date')?.value;
            renderAllRequests(fromDate, toDate);
        }
        
        checkForNewRequests();
    }, 10000);
}

// Start Admin Application
initializeAdmin();