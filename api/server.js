const express = require('express');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'norain_secret_key';
const AUTH_COOKIE = 'admin-auth';

// Twilio credentials (replace with your own for real sending)
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_twilio_account_sid';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_twilio_auth_token';
let twilioClient = null;
let twilioWhatsAppNumber = 'whatsapp:+14155238886'; // Twilio sandbox number

if (accountSid !== 'your_twilio_account_sid' && authToken !== 'your_twilio_auth_token') {
    twilioClient = twilio(accountSid, authToken);
}

// Admin credentials
const ADMIN_USERNAME = 'norainhairsalon';
let ADMIN_PASSWORD_HASH = bcrypt.hashSync('norainadmin123', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function parseCookies(req) {
    const cookieHeader = req.headers.cookie || '';
    return cookieHeader.split(';').reduce((acc, cookie) => {
        const [name, ...rest] = cookie.trim().split('=');
        if (!name) return acc;
        acc[name] = decodeURIComponent(rest.join('='));
        return acc;
    }, {});
}

function createAuthToken(username) {
    const payload = `${username}|${Date.now()}`;
    const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    return `${payload}|${signature}`;
}

function verifyAuthToken(token) {
    if (!token) return false;
    const parts = token.split('|');
    if (parts.length !== 3) return false;
    const [username, timestamp, signature] = parts;
    const expected = crypto.createHmac('sha256', SECRET).update(`${username}|${timestamp}`).digest('hex');
    return signature === expected;
}

app.use((req, res, next) => {
    const cookies = parseCookies(req);
    req.adminAuthenticated = verifyAuthToken(cookies[AUTH_COOKIE]);
    next();
});

// Appointment storage
const APPOINTMENTS_FILE = path.join(__dirname, 'appointments.json');

async function loadAppointments() {
  try {
    const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveAppointments(appointments) {
  try {
    await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
  } catch (err) {
    console.error("Save error on Vercel:", err);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  if (req.adminAuthenticated) {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
  } else {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    const token = createAuthToken(username);
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ success: true });
});

app.post('/change-password', async (req, res) => {
  if (!req.adminAuthenticated) return res.status(401).json({ success: false, message: 'Not logged in' });
  const { currentPassword, newPassword } = req.body;
  if (!bcrypt.compareSync(currentPassword, ADMIN_PASSWORD_HASH)) {
    return res.json({ success: false, message: 'Current password incorrect' });
  }
  ADMIN_PASSWORD_HASH = bcrypt.hashSync(newPassword, 10);
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ success: true, message: 'Password changed. Please login again.' });
});

app.get('/api/appointments', async (req, res) => {
  if (!req.adminAuthenticated) return res.status(401).json({ success: false });
  const appointments = await loadAppointments();
  res.json(appointments);
});

app.post('/api/appointments', async (req, res) => {
  const appointment = req.body;
  const appointments = await loadAppointments();
  appointments.unshift(appointment);
  await saveAppointments(appointments);
  res.json({ success: true });
});

app.put('/api/appointments/:id', async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ success: false });
  const { id } = req.params;
  const { status } = req.body;
  const appointments = await loadAppointments();
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) return res.status(404).json({ success: false });
  appointments[index].status = status;
  
  if (status === 'accepted') {
    appointments[index].acceptedAt = new Date().toISOString();
    // Send WhatsApp confirmation
    if (twilioClient) {
        const message = `Hello ${appointments[index].name}, your appointment at Norain Hair Salon has been confirmed.\nService: ${appointments[index].service}\nDate: ${new Date(appointments[index].date).toLocaleDateString()}\nTime: ${appointments[index].time}`;
        try {
            await twilioClient.messages.create({
                body: message,
                from: twilioWhatsAppNumber,
                to: `whatsapp:${appointments[index].phone}`
            });
        } catch (err) {
            console.error('WhatsApp send error:', err);
        }
    } else {
        console.log('Twilio not configured, skipping WhatsApp send');
    }
  }
  await saveAppointments(appointments);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// VERCEL SERVERLESS SUPPORT KE LIYE YE LINE ADD KI HAI
module.exports = app;