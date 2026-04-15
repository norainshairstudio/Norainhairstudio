const express = require('express');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose'); 
const nodemailer = require('nodemailer'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'norain_secret_key';
const AUTH_COOKIE = 'admin-auth';

// --- MONGODB CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://norainshairstudio_db_user:ygLshEGpDv5rFekv@cluster0.p3tthdy.mongodb.net/norain_salon?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- MONGODB SCHEMAS ---
const appointmentSchema = new mongoose.Schema({
    id: String,
    name: String,
    phone: String,
    email: String, // NAYA: Email Field
    service: String,
    price: Number,
    date: String,
    time: String,
    displayTime: String,
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

// --- EMAIL TRANSPORTER SETUP (Spaceship/Titan Email) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.titan.email', // Spaceship/Titan ka SMTP host
    port: 465,
    secure: true, // Port 465 ke liye true
    auth: {
        user: process.env.EMAIL_USER, // Vercel mein update karein: contact@norainhairstudio.com
        pass: process.env.EMAIL_PASS  // Aapka email password
    }
});

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

// --- API ROUTES FOR MONGODB & EMAILS ---

app.get('/api/appointments', async (req, res) => {
  try {
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
      
      const closedDateExist = await ClosedDate.findOne({ date: appointmentData.date });
      if(closedDateExist) {
          return res.status(400).json({ success: false, message: "Day is closed" });
      }

      const count = await Appointment.countDocuments();
      appointmentData.tokenId = String(count + 1).padStart(5, '0');

      const newAppointment = new Appointment(appointmentData);
      await newAppointment.save();

      // --- EMAIL 1: PENDING NOTIFICATION ---
      if (appointmentData.email) {
          const mailOptions = {
              from: '"Norain Hair Studio" <contact@norainhairstudio.com>', // Yahan change kiya
              to: appointmentData.email,
              subject: 'Booking Request Received - Norain Hair Salon',
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e8e8e8; border-radius: 10px;">
                  <h2 style="color: #c9a961; text-align: center;">Norain Hair Salon</h2>
                  <p><strong>Hello ${appointmentData.name},</strong></p>
                  <p>We have successfully received your booking request and payment screenshot.</p>
                  <p>You will shortly receive a confirmation email containing your official <strong>Token Slip</strong> once our team verifies the payment.</p>
                  <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 20px 0;">
                  <p style="color: #666;"><em>Hamein aapki booking request aur payment screenshot mil gayi hai. Verification ke baad aapko jald hi Token Slip ke sath confirmation email bhej di jayegi.</em></p>
                  <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">© 2026 Norain Hair Salon. Powered by AnA Softechs.</p>
              </div>
              `
          };
          transporter.sendMail(mailOptions).catch(err => console.log("Email Send Error:", err));
      }
      
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
        
        // --- EMAIL 2: CONFIRMED & VIP TOKEN SLIP ---
        if (appointment.email) {
            const formattedDate = new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const mailOptions = {
                from: '"Norain Hair Studio" <contact@norainhairstudio.com>', // Yahan change kiya
                to: appointment.email,
                subject: `Booking Confirmed! Token #${appointment.tokenId} - Norain Hair Salon`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 2px solid #c9a961; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <div style="background: #1a1a1a; padding: 20px; text-align: center;">
                        <h1 style="color: #c9a961; margin: 0; font-family: 'Playfair Display', serif;">NORAIN HAIR SALON</h1>
                        <p style="color: #fff; margin: 5px 0 0 0;">Official Appointment Token</p>
                    </div>
                    <div style="padding: 30px; text-align: center;">
                        <h2 style="font-size: 36px; margin: 0; color: #1a1a1a;">TOKEN: #${appointment.tokenId}</h2>
                        <div style="text-align: left; margin-top: 30px; line-height: 1.8; color: #333; background: #fafaf8; padding: 20px; border-radius: 10px;">
                            <p style="margin: 5px 0;"><strong>Name:</strong> ${appointment.name}</p>
                            <p style="margin: 5px 0;"><strong>Service:</strong> ${appointment.service}</p>
                            <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> ${appointment.displayTime || appointment.time}</p>
                            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> <span style="color: #10B981; font-weight: bold;">Rs. ${appointment.price}</span></p>
                        </div>
                        <div style="margin-top: 30px; padding: 15px; background: rgba(46, 204, 113, 0.1); border-radius: 8px; border: 1px solid #10B981;">
                            <p style="margin: 0; color: #10B981; font-weight: bold; font-size: 18px;">STATUS: CONFIRMED ✅</p>
                            <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Please show this digital slip at the salon counter.</p>
                            <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;"><em>Baraye meharbani salon counter par ye slip dikhayen.</em></p>
                        </div>
                    </div>
                </div>
                `
            };
            transporter.sendMail(mailOptions).catch(err => console.log("Token Email Send Error:", err));
        }

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