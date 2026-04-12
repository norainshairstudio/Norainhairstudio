# Norain Hair Salon - Premium Booking Website with Admin Dashboard

## 🚀 Vercel Deployment

This project is configured for Vercel deployment with serverless functions.

### File Structure for Vercel:
```
/
├── api/
│   └── server.js          # Serverless API routes
├── public/
│   ├── index.html         # Customer website
│   ├── admin.html         # Admin dashboard
│   ├── login.html         # Admin login
│   ├── styles.css         # Customer styles
│   ├── admin.css          # Admin styles
│   ├── login.css          # Login styles
│   ├── script.js          # Customer booking logic
│   ├── admin.js           # Admin dashboard logic
│   └── login.js           # Login logic
├── appointments.json      # Appointment storage
├── vercel.json           # Vercel configuration
└── package.json          # Dependencies
```

### Access URLs:
- **Customer Site**: `https://your-domain.vercel.app/`
- **Admin Login**: `https://your-domain.vercel.app/dashboard`
  - Username: `norainhairsalon`
  - Password: `norainadmin123`

### Environment Variables (Optional):
Set these in Vercel dashboard for WhatsApp functionality:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SESSION_SECRET` (optional, defaults to 'norain_secret_key')

## 🎨 Features Implemented

### 1. **Modern Light Theme UI**
- Clean white/smoky background (#fafaf8)
- Black text (#1a1a1a) for premium, classy look
- Gold accents (#c9a961) for premium feel
- Smooth shadows and glassmorphism effects
- Responsive mobile-first design

### 2. **Advanced Booking System**
- Interactive calendar with month navigation
- **Monday is OFF** - Automatically grayed out
- Service-based time slot generation:
  - Hair Cutting: 30-minute slots
  - Hair Cutting + Shave: 60-minute slots
- Color-coded availability:
  - ✓ Green = Available slots
  - ● Orange = Fully booked day
  - OFF = Monday (Closed)
  - Gray = Past dates

### 3. **Working Hours**
- **Operating Hours**: 12:00 PM to 10:00 PM (10 hours)
- **Days**: Tuesday to Sunday (Closed Mondays)
- All time slots generated automatically based on service duration

### 4. **Smart Time Slot Logic**
- Only shows available time slots
- Booked slots are disabled and grayed out
- Selected time shows in gold highlight
- 12-hour format with AM/PM display

### 5. **Booking Form**
- Full name input
- Phone number input
- Service selection with icons (Radio buttons)
- Calendar date picker with availability indicators
- Time slot selector

### 6. **Booking Summary**
- Shows selected service, date, and time
- Professional card design
- Direct WhatsApp integration

### 7. **WhatsApp Integration**
- Pre-filled message with all booking details
- Works seamlessly with WhatsApp Web/App
- Professional message format

### 8. **Backend Server (Node.js + Express)**
- Persistent appointment storage (JSON file)
- Session-based authentication
- RESTful API for appointments
- Password hashing with bcrypt
- Twilio WhatsApp API integration (optional)

### 9. **Admin Dashboard**
- **Login Required**: Username `norainhairsalon`, Password `norainadmin123`
- **Access URL**: `/dashboard` (no visible link on customer site)
- Day-wise appointment view (not monthly calendar)
- Live request notifications
- Accept/reject appointments
- Password change functionality (logs out all devices)
- Mobile responsive design
- Real-time updates every 10 seconds

### 10. **WhatsApp Automation**
- When admin accepts appointment, confirmation message sent via WhatsApp
- No need to open WhatsApp manually
- Uses Twilio WhatsApp Business API
- Falls back to console log if Twilio not configured

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure WhatsApp (Optional)
Create a Twilio account and get WhatsApp Business API:
```bash
export TWILIO_ACCOUNT_SID=your_account_sid
export TWILIO_AUTH_TOKEN=your_auth_token
```
Without Twilio, messages will be logged to console instead of sent.

### 3. Start Server
```bash
npm start
```

### 4. Access Website
- **Customer Site**: `http://localhost:3000`
- **Admin Dashboard**: `http://localhost:3000/dashboard`
  - Username: `norainhairsalon`
  - Password: `norainadmin123`

## 📱 Mobile Responsive
- Admin dashboard works perfectly on mobile devices
- Touch-friendly interface
- Optimized layouts for small screens

## 🔒 Security Features
- Password hashing with bcrypt
- Session-based authentication
- Password change invalidates all sessions
- No admin access without login

## 📋 File Structure
- `server.js` - Backend server with API
- `index.html` - Customer booking page
- `admin.html` - Admin dashboard
- `login.html` - Admin login page
- `script.js` - Customer booking logic
- `admin.js` - Admin dashboard logic
- `styles.css` - Customer styles
- `admin.css` - Admin styles
- `login.css` - Login styles
- `appointments.json` - Appointment storage

### 8. **Additional Sections**
- Hero section with CTA button
- Services display with hover effects
- Premium gallery with zoom animation
- About section
- Testimonials carousel (auto-rotating)
- Footer with contact info and social icons
- Sticky navbar with smooth scrolling
- Floating "Book Now" button (visible on scroll)

### 9. **Animations & Interactions**
- GSAP animations on page load
- Smooth scroll transitions
- Hover effects on all interactive elements
- Loading animation
- Smooth micro-interactions

## 📋 Files

1. **index.html** - Complete HTML structure
2. **styles.css** - Premium light theme stylesheet (750+ lines)
3. **script.js** - Booking system logic & interactions

## 🚀 How to Use

1. Open `index.html` in a modern web browser
2. Scroll through different sections
3. Click "Book Appointment" or scroll to booking section
4. **Select Service** (Hair Cutting or Hair Cutting + Shave)
5. **Pick Date** from calendar (Mondays are grayed out - OFF)
6. **Choose Time** from available slots
7. **Fill in Details** (Name & Phone)
8. **Confirm Booking** - Redirects to WhatsApp with pre-filled message

## 📅 Booking Logic

- **Service Selection**: Choose between 2 services
- **Date Selection**: Calendar shows only available dates with services
- **Time Slot Generation**:
  - Hair Cutting (30 min): Shows 30-minute intervals
  - Hair Cutting + Shave (60 min): Shows 60-minute intervals
- **Booked Slots**: Pre-populated booking data simulates real salon
- **Off Days**: Mondays automatically disabled (OFF)

## 🎯 Key Features

✅ Ultra-premium light theme (white + gold + black)
✅ Fully functional booking system
✅ Smart calendar with Monday off logic
✅ Duration-based time slot generation
✅ Real-time availability indicators
✅ WhatsApp integration
✅ Responsive design (mobile-friendly)
✅ Professional animations
✅ Clean, production-ready code

## 🛠️ Customization

### Change WhatsApp Number
Edit `script.js` - Find `https://wa.me/1234567890` and replace `1234567890` with your actual WhatsApp number

### Change Business Hours
Edit `script.js` - Modify `workingHours`:
```javascript
const workingHours = { start: 12, end: 22 }; // 12 PM to 10 PM
```

### Add/Remove Services
Edit `script.js` - Update services object:
```javascript
const services = {
    'Hair Cutting': 30,
    'Hair Cutting + Shave': 60
};
```

### Update Booked Slots
Edit `script.js` - Modify `bookedSlotsData`:
```javascript
const bookedSlotsData = {
    '2026-04-12': ['14:00', '15:00', '16:30'],
    // Add more dates...
};
```

## 💎 Premium Design Elements

- **Typography**: Playfair Display (headings) + Inter (body)
- **Color Palette**: 
  - Primary: #fafaf8 (off-white)
  - Accent: #333333 (charcoal black)
  - Gold: #c9a961 (premium accent)
  - Success: #2ecc71 (available)
  - Danger: #e74c3c (booked)
- **Spacing**: Generous padding and margins
- **Shadows**: Subtle 8px shadows for depth
- **Radius**: 15px border-radius for softness

## ✨ Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## 📱 Responsive Breakpoints

- Desktop: 1200px max-width container
- Tablet: Adjusted grid layouts
- Mobile: Single column, optimized interactions

---

**Created for: Norain Hair Salon**
**Premium Men's Grooming | Precision. Style. Confidence.**
