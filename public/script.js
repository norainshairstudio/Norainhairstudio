// Toaster Notification System
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

// Loading animation
window.addEventListener('load', () => {
    const loading = document.getElementById('loading');
    if (loading) {
        setTimeout(() => {
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 500);
        }, 1000);
    }
});

// GSAP animations
try {
    gsap.registerPlugin(ScrollTrigger);

    gsap.from("#hero h1", { duration: 1, y: 50, opacity: 0, delay: 0.5 });
    gsap.from("#hero p", { duration: 1, y: 50, opacity: 0, delay: 0.7 });
    gsap.from("#hero .cta-btn", { duration: 1, y: 50, opacity: 0, delay: 0.9 });

    gsap.from("#services .service-card", {
        duration: 0.8, y: 50, opacity: 0, stagger: 0.2,
        scrollTrigger: { trigger: "#services", start: "top 80%" }
    });

    gsap.from("#booking-form", {
        duration: 1, y: 50, opacity: 0,
        scrollTrigger: { trigger: "#booking", start: "top 80%" }
    });

    gsap.from("#gallery .gallery-item", {
        duration: 0.8, scale: 0.8, opacity: 0, stagger: 0.1,
        scrollTrigger: { trigger: "#gallery", start: "top 80%" }
    });
} catch (e) {
    console.log('GSAP not loaded, animations disabled');
}

gsap.from("#about", {
    duration: 1, y: 50, opacity: 0,
    scrollTrigger: { trigger: "#about", start: "top 80%" }
});

gsap.from("#testimonials .testimonial", {
    duration: 1, x: 50, opacity: 0,
    scrollTrigger: { trigger: "#testimonials", start: "top 80%" }
});

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

function scrollToBooking() {
    const booking = document.getElementById('booking');
    booking.scrollIntoView({ behavior: 'smooth' });
}

// Sticky navbar
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(0, 0, 0, 0.95)';
    } else {
        navbar.style.background = 'rgba(0, 0, 0, 0.9)';
    }
});

// Booking system - Advanced Calendar with logic
const workingHours = { start: 12, end: 22 }; // 12:00 PM to 10:00 PM
const services = {
    'Hair Cutting': 30,
    'Shave': 30,
    'Hair Cutting + Shave': 60
};

// Data ab server se aayega
let bookedSlotsData = {};

let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;
let selectedService = null;

// Server se asli bookings lana
async function fetchRealAppointments() {
    try {
        const response = await fetch('/api/appointments');
        if (response.ok) {
            const appointments = await response.json();
            bookedSlotsData = {};
            appointments.forEach(app => {
                if (app.status !== 'rejected') {
                    if (!bookedSlotsData[app.date]) {
                        bookedSlotsData[app.date] = [];
                    }
                    bookedSlotsData[app.date].push(app.time);
                    
                    // Agar service 60 minute ki hai, to agla 30 min wala slot bhi block karo
                    if (app.service.includes('+')) {
                        const [h, m] = app.time.split(':').map(Number);
                        const nextTime = h * 60 + m + 30;
                        const nh = Math.floor(nextTime / 60);
                        const nm = nextTime % 60;
                        const nextTimeStr = `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
                        bookedSlotsData[app.date].push(nextTimeStr);
                    }
                }
            });
            renderCalendar();
        }
    } catch (e) {
        console.log("Error fetching server data, using empty slots.");
    }
}

function isMonday(date) {
    return date.getDay() === 1;
}

function formatTime(hours, minutes) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Smart Generator - Checks overlapping and closing time
function generateTimeSlots(service, date) {
    const duration = services[service];
    const slots = [];
    const startTime = workingHours.start * 60;
    const endTime = workingHours.end * 60;
    const booked = bookedSlotsData[date] || [];

    // Loop end time logic: Agar service 60 min hai, to aakhri slot 21:00 (9:00 PM) banega, 21:30 nahi.
    for (let time = startTime; time + duration <= endTime; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const displayTime = formatTime(hours, minutes);
        
        let isFree = true;
        // Check current slot AND next slot if duration is 60mins
        for(let checkTime = time; checkTime < time + duration; checkTime += 30) {
            const ch = Math.floor(checkTime / 60);
            const cm = checkTime % 60;
            const checkStr = `${ch.toString().padStart(2, '0')}:${cm.toString().padStart(2, '0')}`;
            if(booked.includes(checkStr)) {
                isFree = false;
                break;
            }
        }
        
        slots.push({ value: timeString, display: displayTime, isAvailable: isFree });
    }
    return slots;
}

function renderCalendar() {
    const calendar = document.getElementById('calendar');
    if (!calendar) return;
    calendar.innerHTML = '';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month disabled';
        dayDiv.textContent = daysInPrevMonth - i;
        calendar.appendChild(dayDiv);
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        // Correct timezone issue when converting to ISO string
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;

        if (date < today) {
            dayDiv.className += ' other-month disabled';
        } else if (isMonday(date)) {
            // Monday fully disabled and block clicks
            dayDiv.className += ' off disabled';
            dayDiv.innerHTML = day + '<span class="slot-indicator">OFF</span>';
        } else if (selectedService) {
            // Dynamic Red/Green Logic
            const generatedSlots = generateTimeSlots(selectedService, dateStr);
            const totalSlotsCount = generatedSlots.length;
            const availableSlotsCount = generatedSlots.filter(s => s.isAvailable).length;

            if (availableSlotsCount > 0) {
                dayDiv.className += ' available';
                dayDiv.innerHTML = day + '<span class="slot-indicator">✓</span>';
            } else if (totalSlotsCount > 0 && availableSlotsCount === 0) {
                dayDiv.className += ' booked disabled'; // Poora din full
                dayDiv.innerHTML = day + '<span class="slot-indicator">●</span>';
            }

            if (dateStr === selectedDate) {
                dayDiv.className += ' selected';
            }

            dayDiv.addEventListener('click', () => selectDate(dateStr, availableSlotsCount));
        }

        calendar.appendChild(dayDiv);
    }

    const totalCells = calendar.children.length - 7;
    const remainingCells = 42 - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month disabled';
        dayDiv.textContent = i;
        calendar.appendChild(dayDiv);
    }

    const monthElement = document.getElementById('current-month');
    if (monthElement) {
        monthElement.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
}

function selectDate(dateStr, availableSlotsCount) {
    if (availableSlotsCount === 0) {
        showToast('This day is completely booked. Please choose another date.', 'error');
        return;
    }

    selectedDate = dateStr;
    renderCalendar();
    renderTimeSlots();
    const container = document.getElementById('time-slots-container');
    if (container) container.style.display = 'block';
}

function renderTimeSlots() {
    const container = document.getElementById('time-slots-grid');
    if (!container) return;
    container.innerHTML = '';

    if (!selectedDate || !selectedService) return;

    const slots = generateTimeSlots(selectedService, selectedDate);

    slots.forEach(slotObj => {
        const timeDiv = document.createElement('div');
        timeDiv.className = `time-slot ${slotObj.isAvailable ? 'available' : 'booked disabled'}`;
        timeDiv.textContent = slotObj.display;

        if (slotObj.isAvailable) {
            timeDiv.addEventListener('click', () => selectTime(slotObj.value, slotObj.display, timeDiv));
        }

        if (slotObj.value === selectedTime) {
            timeDiv.className += ' selected';
        }

        container.appendChild(timeDiv);
    });
}

function selectTime(timeValue, timeDisplay, element) {
    selectedTime = timeValue;
    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    updateSummary();
}

function updateSummary() {
    if (selectedService && selectedDate && selectedTime) {
        const summaryDiv = document.getElementById('booking-summary');
        if (summaryDiv) {
            document.getElementById('summary-service').textContent = selectedService;
            // Format date specifically for display
            const d = new Date(selectedDate);
            const correctedDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
            document.getElementById('summary-date').textContent = correctedDate.toLocaleDateString('en-US', 
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            document.getElementById('summary-time').textContent = document.querySelector(`.time-slot.selected`)?.textContent || selectedTime;
            summaryDiv.style.display = 'block';
        }
    }
}

// Initialize booking system
function initializeBooking() {
    // Pehly backend se real data fetch karo
    fetchRealAppointments();
    
    const radioButtons = document.querySelectorAll('input[name="service"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedService = e.target.value;
            selectedDate = null;
            selectedTime = null;
            const container = document.getElementById('time-slots-container');
            if (container) container.style.display = 'none';
            const summary = document.getElementById('booking-summary');
            if (summary) summary.style.display = 'none';
            renderCalendar();
        });
    });

    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    renderCalendar();
}

async function addAppointmentRequest(appointment) {
    return await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointment)
    });
}

async function confirmBooking() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;

    if (!name || !phone) {
        showToast('Please fill in your name and phone number!', 'error');
        return;
    }

    if (!selectedService || !selectedDate || !selectedTime) {
        showToast('Please choose a service, date, and time slot first.', 'error');
        return;
    }

    const appointment = {
        id: `appt-${Date.now()}`,
        name,
        phone,
        service: selectedService,
        date: selectedDate,
        time: selectedTime,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    const response = await addAppointmentRequest(appointment);
    if (!response.ok) {
        showToast('There was a problem sending your request. Please try again.', 'error');
        return;
    }

    showToast('Your booking request has been sent! Norain Salon will confirm shortly.', 'success');

    // Reset Form
    selectedService = null;
    selectedDate = null;
    selectedTime = null;
    document.querySelectorAll('input[name="service"]').forEach(el => el.checked = false);
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    
    document.getElementById('time-slots-container').style.display = 'none';
    document.getElementById('booking-summary').style.display = 'none';
    
    // Data dobara refresh karo taakay wo slot red ho jaye
    fetchRealAppointments();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBooking);
} else {
    initializeBooking();
}

// Testimonials carousel
const testimonials = document.querySelectorAll('.testimonial');
const dots = document.querySelectorAll('.dot');
let currentTestimonial = 0;

function showTestimonial(index) {
    testimonials.forEach(testimonial => testimonial.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    testimonials[index].classList.add('active');
    dots[index].classList.add('active');
}

dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        currentTestimonial = index;
        showTestimonial(currentTestimonial);
    });
});

setInterval(() => {
    currentTestimonial = (currentTestimonial + 1) % testimonials.length;
    showTestimonial(currentTestimonial);
}, 5000);

// Floating book button visibility
window.addEventListener('scroll', () => {
    const floatingBtn = document.getElementById('floating-book-btn');
    if (window.scrollY > 500) {
        floatingBtn.style.display = 'block';
    } else {
        floatingBtn.style.display = 'none';
    }
});

// Service card click to scroll to booking
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
        const serviceName = card.querySelector('h3').textContent;
        // Fix string matching for new service
        let serviceValue = 'Hair Cutting';
        if (serviceName.includes('+')) serviceValue = 'Hair Cutting + Shave';
        else if (serviceName === 'Shave') serviceValue = 'Shave';

        const radio = document.querySelector(`input[name="service"][value="${serviceValue}"]`);
        if (radio) {
            radio.checked = true;
            // Trigger change event manually
            const event = new Event('change');
            radio.dispatchEvent(event);
        }
        scrollToBooking();
    });
});