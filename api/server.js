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

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_twilio_account_sid';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_twilio_auth_token';
let twilioClient = null;
let twilioWhatsAppNumber = 'whatsapp:+14155238886'; 

if (accountSid !== 'your_twilio_account_sid' && authToken !== 'your_twilio_auth_token') {
    twilioClient = twilio(accountSid, authToken);
}

const ADMIN_USERNAME = 'norainhairsalon';
let ADMIN_PASSWORD_HASH = bcrypt.hashSync('norainadmin123', 10);

// NAYA: Payload limit 10MB ki hai kyunke image Base64 format mein aayegi
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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

let memoryAppointments = null;
const APPOINTMENTS_FILE = path.join(process.cwd(), 'appointments.json');

let closedDates = []; 

async function loadAppointments() {
  if (memoryAppointments) return memoryAppointments;
  try {
    const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
    memoryAppointments = JSON.parse(data);
    return memoryAppointments;
  } catch (err) {
    memoryAppointments = [];
    return memoryAppointments;
  }
}

async function saveAppointments(appointments) {
  memoryAppointments = appointments;
  try {
    await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
  } catch (err) {
    console.log("Vercel read-only mode: Data saved in memory instead of file.");
  }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));

app.get('/dashboard', (req, res) => {
  if (req.adminAuthenticated) res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
  else res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    const token = createAuthToken(username);
    res.cookie(AUTH_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
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
  if (!bcrypt.compareSync(currentPassword, ADMIN_PASSWORD_HASH)) return res.json({ success: false, message: 'Current password incorrect' });
  
  ADMIN_PASSWORD_HASH = bcrypt.hashSync(newPassword, 10);
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ success: true, message: 'Password changed. Please login again.' });
});

app.get('/api/appointments', async (req, res) => {
  const appointments = await loadAppointments();
  res.json({ appointments: appointments, closedDates: closedDates });
});

app.post('/api/appointments', async (req, res) => {
  const appointment = req.body;
  const appointments = await loadAppointments();
  
  if(closedDates.includes(appointment.date)) {
      return res.status(400).json({ success: false, message: "Day is closed" });
  }

  // NAYA: Token Generate Karna
  appointment.tokenId = String(appointments.length + 1).padStart(5, '0');

  appointments.unshift(appointment);
  await saveAppointments(appointments);
  
  // Frontend ko tokenId wapas bhejna taakay wo slip bana saky
  res.json({ success: true, tokenId: appointment.tokenId });
});

app.put('/api/appointments/:id', async (req, res) => {
  if (!req.adminAuthenticated) return res.status(401).json({ success: false });
  const { id } = req.params;
  const { status } = req.body;
  const appointments = await loadAppointments();
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) return res.status(404).json({ success: false });
  
  appointments[index].status = status;
  
  if (status === 'accepted') {
    appointments[index].acceptedAt = new Date().toISOString();
    if (twilioClient) {
        const msg = `Hello ${appointments[index].name}, your appointment at Norain Hair Salon is confirmed. Token #${appointments[index].tokenId}\nService: ${appointments[index].service}\nDate: ${new Date(appointments[index].date).toLocaleDateString()}\nTime: ${appointments[index].time}`;
        twilioClient.messages.create({ body: msg, from: twilioWhatsAppNumber, to: `whatsapp:${appointments[index].phone}` }).catch(e=>console.log(e));
    }
  } else if (status === 'rejected') {
      if (twilioClient) {
        const msg = `Hello ${appointments[index].name}, your appointment at Norain Hair Salon has been cancelled/rejected. Please contact us for more info.`;
        twilioClient.messages.create({ body: msg, from: twilioWhatsAppNumber, to: `whatsapp:${appointments[index].phone}` }).catch(e=>console.log(e));
    }
  }
  
  await saveAppointments(appointments);
  res.json({ success: true });
});

app.post('/api/closedates', async (req, res) => {
    if (!req.adminAuthenticated) return res.status(401).json({ success: false });
    const { date } = req.body;
    
    if(!closedDates.includes(date)) {
        closedDates.push(date);
    }
    
    const appointments = await loadAppointments();
    let changed = false;
    appointments.forEach(app => {
        if(app.date === date && (app.status === 'pending' || app.status === 'accepted')) {
            app.status = 'rejected';
            changed = true;
        }
    });
    
    if(changed) await saveAppointments(appointments);
    res.json({ success: true, closedDates });
});

app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
module.exports = app;