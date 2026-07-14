# 📸 SecureVault - Camera Phishing Simulation Lab

> **⚠️ AUTHORIZED USE ONLY** — This tool is for authorized penetration testing, 
> cybersecurity education, and awareness purposes only. Do not use against any 
> system without explicit written permission.

## 🔍 Overview

A complete **camera-first phishing simulation** web application built with Node.js 
for ethical security assessments. Demonstrates how social engineering attacks 
exploit browser camera permissions.

## ✨ Features

- 🔐 **User Registration/Login** — Session-based auth with bcrypt password hashing
- 📸 **Photo Upload & Camera Capture** — Upload or capture directly from webcam
- 🔗 **Unique Shareable Links** — Every photo gets a random secure link
- 🎯 **Target Capture Page** — When victim opens link, camera captures every 3 seconds
- 👁️ **Hidden Video Feed** — Target sees only a "Verification" page
- ⚡ **Admin Dashboard** — View all users, photos, captures in real-time

## 🚀 Quick Start

```bash
# 1. Clone or download
git clone https://github.com/YOUR_USERNAME/camera-phish-lab.git
cd camera-phish-lab

# 2. Install dependencies
npm install

# 3. Start server
npm start
