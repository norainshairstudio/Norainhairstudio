const express = require('express');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const path = require('path');
const crypto = require('crypto');
// NAYA: MongoDB se connect karne ke liye Mongoose
const mongoose = require('mongoose'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'norain_secret_key';
const AUTH_COOKIE = 'admin-auth';

// --- MONGODB CONNECTION ---
// Tera Cluster ka link password ke sath
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://norainshairstudio_db_user:ygLshEGpDv5rFekv@cluster0.p3tthdy.mongodb.net/norain_salon?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- MONGODB SCHEMAS (Database ka structure) ---
const appointmentSchema = new mongoose.Schema({
    id: String,
    name: String,
    phone: String,
    service: String,
    price: Number,
    date: String,
    time: String,
    status: String,
    paymentImage: String,
    tokenId: String,
    createdAt: String,
    acceptedAt: String
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

const closedDateSchema = new mongoose.Schema({
    date: String
});
const ClosedDate = mongoose.model('ClosedDate', closedDateSchema);
// -----------------------------------------------

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_twilio_account_sid';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_twilio_auth_token';
let twilioClient = null;
let twilioWhatsAppNumber = 'whatsapp:+14155238886'; 

if (accountSid !== 'your_twilio_account_sid' && authToken !== 'your_twilio_auth_token') {
    twilioClient = twilio(accountSid, authToken);
}

const ADMIN_USERNAME = 'norainhairsalon';
let ADMIN_PASSWORD_HASH = bcrypt.hashSync('norainadmin123', 10);

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

// --- ROUTES ---
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

// --- API ROUTES FOR MONGODB ---

app.get('/api/appointments', async (req, res) => {
  try {
      // DB se saari appointments lay kar aao
      const appointments = await Appointment.find().sort({ createdAt: -1 });
      const closedDatesDocs = await ClosedDate.find();
      const closedDates = closedDatesDocs.map(doc => doc.date);
      res.json({ appointments, closedDates });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Database Error" });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
      const appointmentData = req.body;
      
      // Check agar date closed hai
      const closedDateExist = await ClosedDate.findOne({ date: appointmentData.date });
      if(closedDateExist) {
          return res.status(400).json({ success: false, message: "Day is closed" });
      }

      // Automatically Token ID generate karo total count dekh kar
      const count = await Appointment.countDocuments();
      appointmentData.tokenId = String(count + 1).padStart(5, '0');

      // Database mein save karo
      const newAppointment = new Appointment(appointmentData);
      await newAppointment.save();
      
      res.json({ success: true, tokenId: appointmentData.tokenId });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Failed to save booking" });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  if (!req.adminAuthenticated) return res.status(401).json({ success: false });
  
  try {
      const { id } = req.params;
      const { status } = req.body;
      
      const appointment = await Appointment.findOne({ id: id });
      if (!appointment) return res.status(404).json({ success: false });
      
      appointment.status = status;
      
      if (status === 'accepted') {
        appointment.acceptedAt = new Date().toISOString();
        if (twilioClient) {
            const msg = `Hello ${appointment.name}, your appointment at Norain Hair Salon is confirmed. Token #${appointment.tokenId}\nService: ${appointment.service}\nDate: ${new Date(appointment.date).toLocaleDateString()}\nTime: ${appointment.time}`;
            twilioClient.messages.create({ body: msg, from: twilioWhatsAppNumber, to: `whatsapp:${appointment.phone}` }).catch(e=>console.log(e));
        }
      } else if (status === 'rejected') {
          if (twilioClient) {
            const msg = `Hello ${appointment.name}, your appointment at Norain Hair Salon has been cancelled/rejected. Please contact us for more info.`;
            twilioClient.messages.create({ body: msg, from: twilioWhatsAppNumber, to: `whatsapp:${appointment.phone}` }).catch(e=>console.log(e));
        }
      }
      
      await appointment.save();
      res.json({ success: true });
  } catch (error) {
      res.status(500).json({ success: false });
  }
});

app.post('/api/closedates', async (req, res) => {
    if (!req.adminAuthenticated) return res.status(401).json({ success: false });
    
    try {
        const { date } = req.body;
        
        const existing = await ClosedDate.findOne({ date: date });
        if(!existing) {
            await new ClosedDate({ date: date }).save();
        }
        
        // Reject all pending/accepted for this date in MongoDB
        await Appointment.updateMany(
            { date: date, status: { $in: ['pending', 'accepted'] } },
            { $set: { status: 'rejected' } }
        );
        
        const closedDatesDocs = await ClosedDate.find();
        const closedDates = closedDatesDocs.map(d => d.date);
        res.json({ success: true, closedDates });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
module.exports = app;