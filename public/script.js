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

window.addEventListener('load', () => {
    const loading = document.getElementById('loading');
    if (loading) {
        setTimeout(() => {
            loading.style.opacity = '0';
            setTimeout(() => loading.style.display = 'none', 500);
        }, 1000);
    }
});

try {
    gsap.registerPlugin(ScrollTrigger);
    gsap.from("#hero h1", { duration: 1, y: 50, opacity: 0, delay: 0.5 });
    gsap.from("#hero p", { duration: 1, y: 50, opacity: 0, delay: 0.7 });
    gsap.from("#hero .cta-btn", { duration: 1, y: 50, opacity: 0, delay: 0.9 });

    gsap.from("#services .service-card", { duration: 0.8, y: 50, opacity: 0, stagger: 0.2, scrollTrigger: { trigger: "#services", start: "top 80%" } });
    gsap.from("#booking-form", { duration: 1, y: 50, opacity: 0, scrollTrigger: { trigger: "#booking", start: "top 80%" } });
    gsap.from("#gallery .gallery-item", { duration: 0.8, scale: 0.8, opacity: 0, stagger: 0.1, scrollTrigger: { trigger: "#gallery", start: "top 80%" } });
} catch (e) { console.log('GSAP disabled'); }

gsap.from("#about", { duration: 1, y: 50, opacity: 0, scrollTrigger: { trigger: "#about", start: "top 80%" } });
gsap.from("#testimonials .testimonial", { duration: 1, x: 50, opacity: 0, scrollTrigger: { trigger: "#testimonials", start: "top 80%" } });

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

function scrollToBooking() { document.getElementById('booking').scrollIntoView({ behavior: 'smooth' }); }

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

const workingHours = { start: 12, end: 22 };
const services = { 'Hair Cutting': 30, 'Shave': 30, 'Hair Cutting + Shave': 60 };

const prices = {
    'Hair Cutting': 400,
    'Shave': 300,
    'Hair Cutting + Shave': 650
};

let bookedSlotsData = {};
let closedDaysData = [];

let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;
let selectedService = null;
let paymentBase64 = null;

async function fetchRealAppointments() {
    try {
        const response = await fetch('/api/appointments');
        if (response.ok) {
            const data = await response.json();
            const appointments = data.appointments || [];
            closedDaysData = data.closedDates || [];
            
            bookedSlotsData = {};
            appointments.forEach(app => {
                if (app.status !== 'rejected') { 
                    if (!bookedSlotsData[app.date]) bookedSlotsData[app.date] = [];
                    bookedSlotsData[app.date].push(app.time);
                    
                    if (app.service.includes('+')) {
                        const [h, m] = app.time.split(':').map(Number);
                        const nextTime = h * 60 + m + 30;
                        const nextTimeStr = `${Math.floor(nextTime / 60).toString().padStart(2, '0')}:${(nextTime % 60).toString().padStart(2, '0')}`;
                        bookedSlotsData[app.date].push(nextTimeStr);
                    }
                }
            });
            renderCalendar();
        }
    } catch (e) { console.log("Fetch Error"); }
}

function isMonday(date) { return date.getDay() === 1; }

function formatTime(hours, minutes) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function generateTimeSlots(service, date) {
    const duration = services[service];
    const slots = [];
    const startTime = workingHours.start * 60;
    const endTime = workingHours.end * 60;
    const booked = bookedSlotsData[date] || [];

    const now = new Date();
    const localTodayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const isToday = (date === localTodayStr);
    const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

    for (let time = startTime; time + duration <= endTime; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        let isFree = true;
        if (isToday && time <= currentMinutesOfDay) {
            isFree = false;
        } else {
            for(let checkTime = time; checkTime < time + duration; checkTime += 30) {
                const ch = Math.floor(checkTime / 60);
                const cm = checkTime % 60;
                const checkStr = `${ch.toString().padStart(2, '0')}:${cm.toString().padStart(2, '0')}`;
                if(booked.includes(checkStr)) { isFree = false; break; }
            }
        }
        slots.push({ value: timeString, display: formatTime(hours, minutes), isAvailable: isFree });
    }
    return slots;
}

function renderCalendar() {
    const calendar = document.getElementById('calendar');
    if (!calendar) return;
    calendar.innerHTML = '';

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const div = document.createElement('div');
        div.className = 'calendar-day header';
        div.textContent = day;
        calendar.appendChild(div);
    });

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const div = document.createElement('div');
        div.className = 'calendar-day other-month disabled';
        div.textContent = daysInPrevMonth - i;
        calendar.appendChild(div);
    }

    const today = new Date();
    const localTodayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;

        if (dateStr < localTodayStr) {
            dayDiv.className += ' other-month disabled';
        } else if (isMonday(date)) {
            dayDiv.className += ' off disabled';
            dayDiv.innerHTML = day + '<span class="slot-indicator">OFF</span>';
        } else if (closedDaysData.includes(dateStr)) {
            dayDiv.className += ' booked disabled';
            dayDiv.innerHTML = day + '<span class="slot-indicator">CLOSED</span>';
        } else if (selectedService) {
            const generatedSlots = generateTimeSlots(selectedService, dateStr);
            const availableSlotsCount = generatedSlots.filter(s => s.isAvailable).length;

            if (availableSlotsCount > 0) {
                dayDiv.className += ' available';
                dayDiv.innerHTML = day + '<span class="slot-indicator">✓</span>';
            } else {
                dayDiv.className += ' booked disabled'; 
                dayDiv.innerHTML = day + '<span class="slot-indicator">●</span>';
            }

            if (dateStr === selectedDate) dayDiv.className += ' selected';
            dayDiv.addEventListener('click', () => selectDate(dateStr, availableSlotsCount));
        }

        calendar.appendChild(dayDiv);
    }

    const totalCells = calendar.children.length - 7;
    for (let i = 1; i <= (42 - totalCells); i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day other-month disabled';
        div.textContent = i;
        calendar.appendChild(div);
    }

    document.getElementById('current-month').textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function selectDate(dateStr, availableCount) {
    if (availableCount === 0) return showToast('No available slots for this day.', 'error');
    selectedDate = dateStr;
    renderCalendar();
    renderTimeSlots();
    document.getElementById('time-slots-container').style.display = 'block';
}

function renderTimeSlots() {
    const container = document.getElementById('time-slots-grid');
    container.innerHTML = '';
    if (!selectedDate || !selectedService) return;

    generateTimeSlots(selectedService, selectedDate).forEach(slot => {
        const timeDiv = document.createElement('div');
        timeDiv.className = `time-slot ${slot.isAvailable ? 'available' : 'booked disabled'}`;
        timeDiv.textContent = slot.display;
        if (slot.isAvailable) timeDiv.addEventListener('click', () => {
            selectedTime = slot.value;
            document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
            timeDiv.classList.add('selected');
            updateSummary();
        });
        if (slot.value === selectedTime) timeDiv.classList.add('selected');
        container.appendChild(timeDiv);
    });
}

function updateSummary() {
    if (selectedService && selectedDate && selectedTime) {
        document.getElementById('summary-service').textContent = selectedService;
        document.getElementById('summary-price').textContent = 'Rs. ' + prices[selectedService];
        
        const d = new Date(selectedDate);
        document.getElementById('summary-date').textContent = new Date(d.getTime() + d.getTimezoneOffset() * 60000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('summary-time').textContent = document.querySelector('.time-slot.selected')?.textContent || selectedTime;
        
        const confirmBtn = document.getElementById('confirm-btn');
        confirmBtn.disabled = true;
        confirmBtn.classList.add('disabled-btn');
        confirmBtn.style.display = 'block';
        
        document.getElementById('payment-box').style.display = 'block';
        document.getElementById('file-name').textContent = '';
        paymentBase64 = null;
        document.getElementById('payment-screenshot').value = '';

        document.getElementById('booking-summary').style.display = 'block';
    }
}

document.getElementById('payment-screenshot')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('file-name').textContent = '✅ Attached: ' + file.name;
        
        const btn = document.getElementById('confirm-btn');
        btn.disabled = false;
        btn.classList.remove('disabled-btn');
        
        const reader = new FileReader();
        reader.onload = function(event) {
            paymentBase64 = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

function initializeBooking() {
    fetchRealAppointments();
    
    document.querySelectorAll('input[name="service"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedService = e.target.value;
            selectedDate = selectedTime = null;
            document.getElementById('time-slots-container').style.display = 'none';
            document.getElementById('booking-summary').style.display = 'none';
            renderCalendar();
        });
    });

    document.getElementById('prev-month')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    renderCalendar();
}

async function confirmBooking() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value; // NAYA: Email field

    if (!name || !phone || !email) return showToast('Please fill in your name, phone, and email!', 'error');
    if (!selectedService || !selectedDate || !selectedTime) return showToast('Choose service, date & time!', 'error');
    if (!paymentBase64) return showToast('Please upload payment screenshot first!', 'error');

    const btn = document.getElementById('confirm-btn');
    btn.textContent = 'Verifying and Sending...';
    btn.disabled = true;
    btn.classList.add('disabled-btn');

    const displayTime = document.querySelector('.time-slot.selected')?.textContent || selectedTime;

    const appointment = { 
        id: `appt-${Date.now()}`, 
        name, 
        phone, 
        email, // Email added to payload
        service: selectedService,
        price: prices[selectedService],
        date: selectedDate, 
        time: selectedTime,
        displayTime: displayTime, 
        status: 'pending', 
        paymentImage: paymentBase64, 
        createdAt: new Date().toISOString() 
    };

    try {
        const res = await fetch('/api/appointments', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(appointment) 
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Backend Error:", errorText);
            throw new Error(`Server Error ${res.status}`);
        }

        // NAYA: Email ka wait karne ka message
        showToast('Booking sent! Please check your email for updates.', 'success');
        
        document.getElementById('payment-box').style.display = 'none';
        btn.style.display = 'none';

        selectedService = selectedDate = selectedTime = null;
        document.querySelectorAll('input[name="service"]').forEach(el => el.checked = false);
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('email').value = '';
        
        fetchRealAppointments();

    } catch (error) {
        showToast('Problem sending data. File too large or server down.', 'error');
        console.error("Fetch Request Failed:", error);
        btn.textContent = 'Submit Payment & Book';
        btn.disabled = false;
        btn.classList.remove('disabled-btn');
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeBooking);
else initializeBooking();

const testimonials = document.querySelectorAll('.testimonial');
const dots = document.querySelectorAll('.dot');
let currentTestimonial = 0;

function showTestimonial(index) {
    testimonials.forEach(t => t.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    testimonials[index].classList.add('active');
    dots[index].classList.add('active');
}

dots.forEach((dot, index) => dot.addEventListener('click', () => showTestimonial(currentTestimonial = index)));
setInterval(() => showTestimonial(currentTestimonial = (currentTestimonial + 1) % testimonials.length), 5000);

window.addEventListener('scroll', () => {
    document.getElementById('floating-book-btn').style.display = window.scrollY > 500 ? 'block' : 'none';
});

document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
        const sn = card.querySelector('h3').textContent;
        let sv = sn.includes('+') ? 'Hair Cutting + Shave' : sn === 'Shave' ? 'Shave' : 'Hair Cutting';
        const radio = document.querySelector(`input[name="service"][value="${sv}"]`);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
        scrollToBooking();
    });
});

const mobileBtn = document.querySelector('.mobile-menu-btn');
const closeMenuBtn = document.querySelector('.close-menu-btn');
const navLinks = document.querySelector('.nav-links');
const navItems = document.querySelectorAll('.nav-item');

if(mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
        navLinks.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    });
    
    closeMenuBtn.addEventListener('click', () => {
        navLinks.classList.remove('active');
        document.body.style.overflow = 'auto'; 
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navLinks.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });
}