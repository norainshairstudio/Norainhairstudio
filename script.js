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
        duration: 0.8,
        y: 50,
        opacity: 0,
        stagger: 0.2,
        scrollTrigger: {
            trigger: "#services",
            start: "top 80%"
        }
    });

    gsap.from("#booking-form", {
        duration: 1,
        y: 50,
        opacity: 0,
        scrollTrigger: {
            trigger: "#booking",
            start: "top 80%"
        }
    });

    gsap.from("#gallery .gallery-item", {
        duration: 0.8,
        scale: 0.8,
        opacity: 0,
        stagger: 0.1,
        scrollTrigger: {
            trigger: "#gallery",
            start: "top 80%"
        }
    });
} catch (e) {
    console.log('GSAP not loaded, animations disabled');
}

gsap.from("#about", {
    duration: 1,
    y: 50,
    opacity: 0,
    scrollTrigger: {
        trigger: "#about",
        start: "top 80%"
    }
});

gsap.from("#testimonials .testimonial", {
    duration: 1,
    x: 50,
    opacity: 0,
    scrollTrigger: {
        trigger: "#testimonials",
        start: "top 80%"
    }
});

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
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

// Booking system - Advanced Calendar with Monday OFF
const workingHours = { start: 12, end: 22 }; // 12:00 PM to 10:00 PM (10 hours)
const services = {
    'Hair Cutting': 30,
    'Hair Cutting + Shave': 60
};

// Realistic booked appointments
const bookedSlotsData = {
    '2026-04-12': ['14:00', '15:00', '16:30', '18:00', '19:30'],
    '2026-04-13': ['13:00', '13:30', '15:30', '17:00', '20:00'],
    '2026-04-16': ['14:30', '18:00', '19:00'],
    '2026-04-17': ['12:30', '15:00', '16:00', '17:30'],
    '2026-04-18': ['13:00', '14:00', '16:30', '19:00'],
    '2026-04-19': ['12:00', '15:00', '18:30'],
    '2026-04-20': ['14:00', '16:00', '17:00', '20:00'],
    '2026-04-22': ['13:30', '19:00'],
    '2026-04-23': ['15:30', '18:00', '20:00'],
    '2026-04-24': ['12:30', '14:30', '17:00'],
};

let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;
let selectedService = null;

function isMonday(date) {
    return date.getDay() === 1;
}

function formatTime(hours, minutes) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Generate ALL possible time slots for a service
function generateTimeSlots(service, date) {
    const duration = services[service];
    const slots = [];
    const startTime = workingHours.start * 60;
    const endTime = workingHours.end * 60;

    for (let time = startTime; time + duration <= endTime; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const displayTime = formatTime(hours, minutes);
        slots.push({ value: timeString, display: displayTime });
    }

    return slots;
}

// Check if a specific time slot is booked
function isSlotBooked(dateStr, timeStr) {
    const booked = bookedSlotsData[dateStr] || [];
    return booked.includes(timeStr);
}

// Check if date has any available slots for selected service
function hasAvailableSlots(dateStr) {
    if (!selectedService) return false;
    const dateObj = new Date(dateStr);
    if (isMonday(dateObj)) return false; // Monday is OFF
    
    const slots = generateTimeSlots(selectedService, dateStr);
    const booked = bookedSlotsData[dateStr] || [];
    return slots.some(slot => !booked.includes(slot.value));
}

// Render the calendar
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    if (!calendar) {
        console.error('Calendar element not found');
        return;
    }
    
    calendar.innerHTML = '';

    // Day headers
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

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.textContent = daysInPrevMonth - i;
        calendar.appendChild(dayDiv);
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;

        // Past dates
        if (date < today) {
            dayDiv.className += ' other-month';
        } else if (!selectedService) {
            // No service selected - just show normal days
            if (isMonday(date)) {
                dayDiv.className += ' off';
                dayDiv.innerHTML = day + '<span class="slot-indicator">OFF</span>';
            }
        } else {
            // Service is selected - show availability
            if (isMonday(date)) {
                dayDiv.className += ' off';
                dayDiv.innerHTML = day + '<span class="slot-indicator">OFF</span>';
            } else {
                const hasAvailable = hasAvailableSlots(dateStr);
                const hasBooking = (bookedSlotsData[dateStr] || []).length > 0;

                if (hasAvailable) {
                    dayDiv.className += ' available';
                    dayDiv.innerHTML = day + '<span class="slot-indicator">✓</span>';
                } else if (hasBooking) {
                    dayDiv.className += ' booked';
                    dayDiv.innerHTML = day + '<span class="slot-indicator">●</span>';
                }
            }

            if (dateStr === selectedDate) {
                dayDiv.className += ' selected';
            }

            dayDiv.addEventListener('click', () => selectDate(dateStr));
        }

        calendar.appendChild(dayDiv);
    }

    // Next month days
    const totalCells = calendar.children.length - 7;
    const remainingCells = 42 - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.textContent = i;
        calendar.appendChild(dayDiv);
    }

    const monthElement = document.getElementById('current-month');
    if (monthElement) {
        monthElement.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
}

function selectDate(dateStr) {
    const dateObj = new Date(dateStr);
    if (isMonday(dateObj)) {
        alert('We are closed on Mondays!');
        return;
    }

    selectedDate = dateStr;
    renderCalendar();
    renderTimeSlots();
    const container = document.getElementById('time-slots-container');
    if (container) {
        container.style.display = 'block';
    }
}

function renderTimeSlots() {
    const container = document.getElementById('time-slots-grid');
    if (!container) return;
    
    container.innerHTML = '';

    if (!selectedDate || !selectedService) return;

    const slots = generateTimeSlots(selectedService, selectedDate);
    const booked = bookedSlotsData[selectedDate] || [];

    slots.forEach(slotObj => {
        const timeDiv = document.createElement('div');
        const isBooked = booked.includes(slotObj.value);
        
        timeDiv.className = `time-slot ${isBooked ? 'booked' : 'available'}`;
        timeDiv.textContent = slotObj.display;

        if (!isBooked) {
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
            document.getElementById('summary-date').textContent = new Date(selectedDate).toLocaleDateString('en-US', 
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('summary-time').textContent = document.querySelector(`.time-slot.selected`)?.textContent || selectedTime;
            summaryDiv.style.display = 'block';
        }
    }
}

// Initialize booking system after DOM is ready
function initializeBooking() {
    console.log('Initializing booking system...');
    
    // Radio button listeners for service selection
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

    // Calendar navigation
    const prevBtn = document.getElementById('prev-month');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }

    const nextBtn = document.getElementById('next-month');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // Initial calendar render
    console.log('Rendering initial calendar...');
    renderCalendar();
    console.log('Calendar rendered successfully');
}

// Confirm booking and WhatsApp
async function addAppointmentRequest(appointment) {
    return await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointment)
    });
}

// YAHAN PAR 'async' ADD KIYA HAI
async function confirmBooking() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;

    if (!name || !phone) {
        alert('Please fill in your name and phone number!');
        return;
    }

    if (!selectedService || !selectedDate || !selectedTime) {
        alert('Please choose a service, date, and time slot first.');
        return;
    }

    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', 
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const userMessage = `Hello Norain Hair Salon, I want to book an appointment.
Name: ${name}
Phone: ${phone}
Service: ${selectedService}
Date: ${formattedDate}
Time: ${document.getElementById('summary-time').textContent}`;

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
        alert('There was a problem sending your request. Please try again.');
        return;
    }

    alert('Your booking request has been recorded. The owner will confirm it soon.');

    selectedService = null;
    selectedDate = null;
    selectedTime = null;
    document.querySelectorAll('input[name="service"]').forEach(el => el.checked = false);
    const container = document.getElementById('time-slots-container');
    if (container) container.style.display = 'none';
    const summaryDiv = document.getElementById('booking-summary');
    if (summaryDiv) summaryDiv.style.display = 'none';
    renderCalendar();
}

// Initialize when DOM is ready
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

// Auto-rotate testimonials
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
        const serviceValue = serviceName.includes('+') ? 'Hair Cutting + Shave' : 'Hair Cutting';
        const radio = document.querySelector(`input[name="service"][value="${serviceValue}"]`);
        if (radio) {
            radio.checked = true;
            selectedService = serviceValue;
            selectedDate = null;
            selectedTime = null;
            const container = document.getElementById('time-slots-container');
            if (container) container.style.display = 'none';
            const summaryDiv = document.getElementById('booking-summary');
            if (summaryDiv) summaryDiv.style.display = 'none';
            renderCalendar();
        }
        scrollToBooking();
    });
});