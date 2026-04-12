const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

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

// Session setup
app.use(session({
  secret: 'norain_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

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
  await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'admin.html'));
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    req.session.loggedIn = true;
    req.session.username = username;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.post('/change-password', async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ success: false, message: 'Not logged in' });
  const { currentPassword, newPassword } = req.body;
  if (!bcrypt.compareSync(currentPassword, ADMIN_PASSWORD_HASH)) {
    return res.json({ success: false, message: 'Current password incorrect' });
  }
  ADMIN_PASSWORD_HASH = bcrypt.hashSync(newPassword, 10);
  // Invalidate all sessions by changing secret or clearing sessions
  req.session.destroy();
  res.json({ success: true, message: 'Password changed. Please login again.' });
});

app.get('/api/appointments', async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ success: false });
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