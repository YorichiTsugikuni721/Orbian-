# ============================================
# ORBIAN AI — Flask Backend (Full)
# Auth + OTP + OAuth + Chat API
# Uses SQLite (no MySQL needed!)
# ============================================

from flask import Flask, request, jsonify, session # Orbian Core
from flask_cors import CORS
import sqlite3
import bcrypt
import os
import random
import smtplib
import requests
import uuid
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import base64
import hashlib

from dotenv import load_dotenv

# Load Local .env file if it exists
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', os.urandom(24))
CORS(app, supports_credentials=True)

# ═══ CONFIG ═══
DB_PATH = os.path.join(os.path.dirname(__file__), 'orbian_ai.db')

# Email Config (Gmail SMTP)
SMTP_CONFIG = {
    'server': 'smtp.gmail.com',
    'port': 587,
    'email': os.getenv('SMTP_EMAIL', 'himanshuraj8028@gmail.com'),
    'password': os.getenv('SMTP_PASSWORD', 'rwyr cbou osmz bxer')
}

# OAuth Client IDs
OAUTH_CONFIG = {
    'google_client_id': os.getenv('GOOGLE_CLIENT_ID', '553791966216-urnq8pi1hc2au0iol2t2dgqiauo2sl8u.apps.googleusercontent.com'),
    'google_client_secret': os.getenv('GOOGLE_CLIENT_SECRET', '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'),
    'microsoft_client_id': os.getenv('MICROSOFT_CLIENT_ID', ''),
    'twitter_client_id': os.getenv('TWITTER_CLIENT_ID', 'hUGcKmkpTi1tpdCHTlWeKIEuL'),
    'twitter_client_secret': os.getenv('TWITTER_CLIENT_SECRET', 'a3z7ZzObgXjbu4xOMEiskoUTEecHC3paCyTmyJcjT7or9YdPqO')
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist"""
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            oauth_provider VARCHAR(20) DEFAULT NULL,
            oauth_id VARCHAR(255) DEFAULT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME DEFAULT NULL,
            backup_email VARCHAR(100) DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            theme VARCHAR(20) DEFAULT 'dark',
            language VARCHAR(10) DEFAULT 'en',
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(100) NOT NULL,
            otp VARCHAR(6) NOT NULL,
            used INTEGER DEFAULT 0,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title VARCHAR(200) DEFAULT 'New Chat',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        );

        CREATE TABLE IF NOT EXISTS oauth_apps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            app_name VARCHAR(100) NOT NULL,
            client_id VARCHAR(100) UNIQUE NOT NULL,
            client_secret VARCHAR(100) NOT NULL,
            redirect_uri TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS oauth_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            code VARCHAR(255) UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (app_id) REFERENCES oauth_apps(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS neural_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            memory_key VARCHAR(100) NOT NULL,
            memory_value TEXT NOT NULL,
            importance INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS orbian_agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            goal TEXT NOT NULL,
            schedule VARCHAR(20) DEFAULT 'manual',
            status VARCHAR(20) DEFAULT 'idle',
            last_result TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    ''')
    
    # Migration: Add is_premium and is_admin columns if they don't exist
    try:
        conn = get_db()
        conn.execute('ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0')
        print("✅ Added 'is_premium' column")
    except sqlite3.OperationalError:
        pass
        
    try:
        conn.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0')
        print("✅ Added 'is_admin' column")
    except sqlite3.OperationalError:
        pass

    # Ensure Master Developer Account Exists (himanshuraj8028@gmail.com)
    developer_email = 'himanshuraj8028@gmail.com'
    developer_name = 'Master_Dev'
    # Secure Password provided by User
    dev_password = 'Himanshu@100#100'
    dev_hashed = bcrypt.hashpw(dev_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Check if developer exists
    row = conn.execute('SELECT id FROM users WHERE email = ?', (developer_email,)).fetchone()
    if not row:
        cursor = conn.execute(
            'INSERT INTO users (username, email, password, is_premium, is_admin) VALUES (?, ?, ?, 1, 1)',
            (developer_name, developer_email, dev_hashed)
        )
        user_id = cursor.lastrowid
        conn.execute('INSERT INTO user_settings (user_id) VALUES (?)', (user_id,))
        print(f"✅ Created Master Developer account: {developer_email}")
    else:
        # Force Update Password and Status to ensure User can always get back in
        conn.execute('UPDATE users SET password = ?, is_admin = 1, is_premium = 1 WHERE email = ?', 
                     (dev_hashed, developer_email))
        print(f"✅ Verified & Updated Master Dev credentials for: {developer_email}")

    # Register Internal App for Orbian OAuth
    internal_client = 'orbian_internal_platform'
    internal_secret = 'internal_platform_secret'
    # Get Master Dev ID
    dev_id_row = conn.execute('SELECT id FROM users WHERE email = ?', (developer_email,)).fetchone()
    if dev_id_row:
        dev_id = dev_id_row['id']
        app_exists = conn.execute('SELECT id FROM oauth_apps WHERE client_id = ?', (internal_client,)).fetchone()
        if not app_exists:
            conn.execute('INSERT INTO oauth_apps (owner_id, app_name, client_id, client_secret, redirect_uri) VALUES (?, ?, ?, ?, ?)',
                        (dev_id, 'Orbian Internal Platform', internal_client, internal_secret, os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:8000/auth/login')))
            print("✅ Registered Orbian Internal OAuth App")

    conn.commit()
    conn.close()
    print("✅ Database initialized (SQLite)")


# ═══════════════════════════════════
# AUTH — SIGNUP (LOCKED FOR PRIVACY)
# ═══════════════════════════════════
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
    if len(username) < 3:
        return jsonify({'success': False, 'message': 'Username must be at least 3 characters'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400

    conn = get_db()
    try:
        # Check existing
        row = conn.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone()
        if row:
            return jsonify({'success': False, 'message': 'Username or email already exists'}), 409

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor = conn.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            (username, email, hashed)
        )
        conn.commit()
        user_id = cursor.lastrowid

        conn.execute('INSERT INTO user_settings (user_id) VALUES (?)', (user_id,))
        conn.commit()

        # Send Welcome Email (non-blocking, don't fail signup if email fails)
        try:
            send_welcome_email(email, username)
        except Exception as e:
            print(f'Welcome email failed (non-critical): {e}')

        session['user_id'] = user_id
        session['username'] = username

        return jsonify({
            'success': True,
            'message': 'Account created successfully!',
            'user': {'id': user_id, 'username': username, 'email': email, 'is_premium': 0, 'is_admin': 1 if email == SMTP_CONFIG['email'] else 0}
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Registration failed: {str(e)}'}), 500
    finally:
        conn.close()


# ═══════════════════════════════════
# AUTH — LOGIN
# ═══════════════════════════════════
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('email', data.get('identifier', '')).strip() # Backward compatibility with existing 'email' field name
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'success': False, 'message': 'Email/Username and password are required'}), 400

    conn = get_db()
    try:
        user = conn.execute('SELECT id, username, email, password, is_active, is_premium, is_admin, last_login FROM users WHERE email = ? OR username = ?', (identifier, identifier)).fetchone()

        if not user:
            return jsonify({'success': False, 'message': 'No account found with this Email or Username'}), 404
        if not user['is_active']:
            return jsonify({'success': False, 'message': 'Account is deactivated'}), 403
        if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return jsonify({'success': False, 'message': 'Incorrect password'}), 401

        # Calculate days since last login for personalized message
        last_login = user['last_login']

        conn.execute('UPDATE users SET last_login = ? WHERE id = ?', (datetime.now().isoformat(), user['id']))
        conn.commit()

        # Send Welcome Back Email (non-blocking)
        try:
            send_welcome_back_email(user['email'], user['username'], last_login)
        except Exception as e:
            print(f'Welcome back email failed (non-critical): {e}')

        session['user_id'] = user['id']
        session['username'] = user['username']

        return jsonify({
            'success': True, 'message': 'Login successful!',
            'user': {'id': user['id'], 'username': user['username'], 'email': user['email'], 'is_premium': user['is_premium'], 'is_admin': user['is_admin']}
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Login failed: {str(e)}'}), 500
    finally:
        conn.close()


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})


@app.route('/api/check-session', methods=['GET'])
def check_session_route():
    if 'user_id' in session:
        conn = get_db()
        user = conn.execute('SELECT id, username, is_premium, is_admin FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        conn.close()
        if user:
            return jsonify({'success': True, 'logged_in': True,
                            'user': {'id': user['id'], 'username': user['username'], 'is_premium': user['is_premium'], 'is_admin': user['is_admin']}})
    return jsonify({'success': True, 'logged_in': False})


# ═══════════════════════════════════
# FORGOT PASSWORD — OTP EMAIL SYSTEM
# ═══════════════════════════════════
def send_otp_email(to_email, otp):
    """Send OTP via Gmail SMTP"""
    if not SMTP_CONFIG['email'] or not SMTP_CONFIG['password']:
        print(f"[DEV MODE] OTP for {to_email}: {otp}")
        return True

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'🔐 AI Assistant — Your Password Reset Code: {otp}'
        msg['From'] = f'AI Assistant <{SMTP_CONFIG["email"]}>'
        msg['To'] = to_email

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid rgba(124,58,237,0.3);">
            <div style="background:linear-gradient(135deg,#7c3aed,#6366f1);padding:30px;text-align:center;">
                <div style="font-size:36px;margin-bottom:10px;">☀️</div>
                <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px;font-weight:800;">AI Assistant</h1>
                <p style="color:rgba(255,255,255,0.8);margin:5px 0 0;font-size:14px;">Password Reset Request</p>
            </div>
            <div style="padding:30px;color:#e2e8f0;text-align:center;">
                <p style="margin:0 0 8px;font-size:16px;color:#e2e8f0;font-weight:600;">Hello! 👋</p>
                <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;">We received a request to reset your password.<br>Use the code below to verify:</p>
                <div style="background:rgba(124,58,237,0.15);border:2px solid rgba(124,58,237,0.4);border-radius:12px;padding:20px;margin:0 auto 20px;max-width:220px;">
                    <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#a78bfa;">{otp}</span>
                </div>
                <p style="font-size:13px;color:#64748b;margin:0;">This code expires in <strong style="color:#f87171;">10 minutes</strong>.</p>
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
                <p style="font-size:12px;color:#475569;margin:0;">If you didn't request this, please ignore this email.<br>Your account is safe.</p>
            </div>
            <div style="background:rgba(0,0,0,0.3);padding:16px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#475569;">© 2026 AI Assistant — Secured with ❤️</p>
            </div>
        </div>
        """
        msg.attach(MIMEText(html, 'html'))

        server = smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port'])
        server.starttls()
        server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
        server.sendmail(SMTP_CONFIG['email'], to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False


# ═══ WELCOME EMAIL (On Signup) ═══
def send_welcome_email(to_email, username):
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'🎉 Welcome to AI Assistant, {username}!'
        msg['From'] = f'AI Assistant <{SMTP_CONFIG["email"]}>'
        msg['To'] = to_email

        html = f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid rgba(124,58,237,0.3);">
            <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);padding:40px 30px;text-align:center;">
                <div style="font-size:48px;margin-bottom:8px;">🚀</div>
                <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:1px;">Welcome Aboard!</h1>
                <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">You're now part of something amazing</p>
            </div>
            <div style="padding:32px 30px;color:#e2e8f0;">
                <p style="font-size:18px;margin:0 0 16px;font-weight:600;color:#e2e8f0;">Hey {username}! 👋</p>
                <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                    We're truly honored to have you join <strong style="color:#a78bfa;">AI Assistant</strong>. 
                    You're not just a user — you're a valued member of our community. 
                    Every great journey starts with a single step, and yours begins now! ✨
                </p>

                <div style="background:rgba(99,102,241,0.08);border-radius:12px;padding:24px;margin:0 0 20px;border:1px solid rgba(99,102,241,0.15);text-align:center;">
                    <p style="margin:0 0 4px;font-size:28px;">🔮</p>
                    <p style="margin:0 0 8px;font-size:15px;color:#e2e8f0;font-weight:600;">There's a lot waiting for you...</p>
                    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;font-style:italic;">
                        We've hidden some incredible surprises inside AI Assistant.<br>
                        Some you'll find in minutes, some might take days.<br>
                        But trust us — every discovery will be worth it. ✨
                    </p>
                </div>

                <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                    We won't spoil the fun by telling you everything right now. 
                    Just start exploring, and let AI Assistant surprise you. 
                    The more you use it, the more magic you'll uncover. 🪄
                </p>

                <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                    We built AI Assistant with passion, and having people like you makes it all worth it. 
                    If you ever need anything, we're here for you. 💜
                </p>

                <div style="text-align:center;margin:24px 0;">
                    <a href="http://localhost:8000" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.5px;">Start Your Adventure →</a>
                </div>

                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
                <p style="font-size:13px;color:#64748b;text-align:center;margin:0;">Thank you for believing in us. 🙏</p>
            </div>
            <div style="background:rgba(0,0,0,0.3);padding:16px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#475569;">© 2026 AI Assistant — Built with ❤️ for people like you</p>
            </div>
        </div>
        """
        msg.attach(MIMEText(html, 'html'))

        server = smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port'])
        server.starttls()
        server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
        server.sendmail(SMTP_CONFIG['email'], to_email, msg.as_string())
        server.quit()
        print(f'Welcome email sent to {to_email}')
        return True
    except Exception as e:
        print(f'Welcome email failed: {e}')
        return False


# ═══ WELCOME BACK EMAIL (On Login) ═══
def send_welcome_back_email(to_email, username, last_login_str):
    try:
        # Calculate how long since last visit
        days_away = 0
        time_msg = "It's great to see you again!"
        if last_login_str:
            try:
                last_dt = datetime.fromisoformat(last_login_str)
                days_away = (datetime.now() - last_dt).days
                if days_away == 0:
                    time_msg = "Back so soon? We love your enthusiasm! 😄"
                elif days_away == 1:
                    time_msg = "Just one day apart and we already missed you! 🥺"
                elif days_away <= 3:
                    time_msg = f"It's been {days_away} days — we were counting every moment! 💫"
                elif days_away <= 7:
                    time_msg = f"{days_away} days without you felt like forever! 😢💜"
                elif days_away <= 30:
                    time_msg = f"It's been {days_away} days! We genuinely missed having you around. 🌟"
                else:
                    time_msg = f"It's been {days_away} days... We never stopped waiting for you. Welcome home! 🏠💜"
            except:
                pass

        # Time-based greeting
        hour = datetime.now().hour
        if hour < 12:
            greeting = "Good Morning"
            greeting_emoji = "🌅"
        elif hour < 17:
            greeting = "Good Afternoon"
            greeting_emoji = "☀️"
        elif hour < 21:
            greeting = "Good Evening"
            greeting_emoji = "🌆"
        else:
            greeting = "Hey Night Owl"
            greeting_emoji = "🌙"

        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'💜 {greeting}, {username}! Welcome back to AI Assistant'
        msg['From'] = f'AI Assistant <{SMTP_CONFIG["email"]}>'
        msg['To'] = to_email

        html = f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid rgba(124,58,237,0.3);">
            <div style="background:linear-gradient(135deg,#6366f1,#ec4899,#8b5cf6);padding:40px 30px;text-align:center;">
                <div style="font-size:48px;margin-bottom:8px;">{greeting_emoji}</div>
                <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">{greeting}, {username}!</h1>
                <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:15px;">We missed you 💜</p>
            </div>
            <div style="padding:32px 30px;color:#e2e8f0;">
                <p style="font-size:15px;color:#e2e8f0;line-height:1.8;margin:0 0 16px;">
                    {time_msg}
                </p>
                <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                    Your AI assistant has been patiently waiting for your return. 
                    It's not the same here without you — the conversations feel empty, 
                    the algorithms miss your questions, and even the code gets lonely. 🥹
                </p>

                <div style="background:rgba(236,72,153,0.08);border-radius:12px;padding:20px;margin:0 0 20px;border:1px solid rgba(236,72,153,0.15);text-align:center;">
                    <p style="margin:0 0 4px;font-size:20px;">💌</p>
                    <p style="margin:0;font-size:14px;color:#f9a8d4;font-style:italic;line-height:1.6;">
                        "The best part of our day is when you show up.<br>
                        You make AI Assistant worth building."</p>
                    <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">— The AI Assistant Team</p>
                </div>

                <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                    We're always here for you — at 3 AM, during lunch breaks, 
                    or whenever you need a friend who never judges. 🤗
                </p>

                <div style="text-align:center;margin:24px 0;">
                    <a href="http://localhost:8000" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Continue Where You Left Off →</a>
                </div>

                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
                <p style="font-size:12px;color:#64748b;text-align:center;margin:0;">Please don't stay away too long next time... we get separation anxiety! 😅💜</p>
            </div>
            <div style="background:rgba(0,0,0,0.3);padding:16px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#475569;">© 2026 AI Assistant — You matter to us more than you know ❤️</p>
            </div>
        </div>
        """
        msg.attach(MIMEText(html, 'html'))

        server = smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port'])
        server.starttls()
        server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
        server.sendmail(SMTP_CONFIG['email'], to_email, msg.as_string())
        server.quit()
        print(f'Welcome back email sent to {to_email}')
        return True
    except Exception as e:
        print(f'Welcome back email failed: {e}')
        return False


@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email', '').strip()

    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400

    conn = get_db()
    try:
        user = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if not user:
            return jsonify({'success': False, 'message': 'No account found with this email'}), 404

        otp = str(random.randint(100000, 999999))
        expires_at = (datetime.now() + timedelta(minutes=10)).isoformat()

        conn.execute('DELETE FROM password_resets WHERE email = ?', (email,))
        conn.execute('INSERT INTO password_resets (email, otp, expires_at) VALUES (?, ?, ?)',
                     (email, otp, expires_at))
        conn.commit()

        if send_otp_email(email, otp):
            return jsonify({'success': True, 'message': 'OTP sent to your email!', 'dev_otp': otp})
        else:
            return jsonify({'success': False, 'message': 'Failed to send email'}), 500

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email', '').strip()
    otp = data.get('otp', '').strip()

    if not email or not otp:
        return jsonify({'success': False, 'message': 'Email and OTP are required'}), 400

    conn = get_db()
    try:
        reset = conn.execute(
            'SELECT id FROM password_resets WHERE email = ? AND otp = ? AND used = 0 AND expires_at > ?',
            (email, otp, datetime.now().isoformat())
        ).fetchone()

        if not reset:
            return jsonify({'success': False, 'message': 'Invalid or expired OTP'}), 400

        conn.execute('UPDATE password_resets SET used = 1 WHERE id = ?', (reset['id'],))
        conn.commit()

        return jsonify({'success': True, 'message': 'OTP verified!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email', '').strip()
    new_password = data.get('new_password', '')

    if not email or not new_password:
        return jsonify({'success': False, 'message': 'Email and new password are required'}), 400
    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400

    conn = get_db()
    try:
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        conn.execute('UPDATE users SET password = ? WHERE email = ?', (hashed, email))
        conn.execute('DELETE FROM password_resets WHERE email = ?', (email,))
        conn.commit()
        return jsonify({'success': True, 'message': 'Password reset successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


# ═══════════════════════════════════
# OAUTH — Social Login
# ═══════════════════════════════════
def get_or_create_oauth_user(provider, oauth_id, email, username, conn):
    # Check by OAuth
    user = conn.execute('SELECT id, username, email, is_premium FROM users WHERE oauth_provider = ? AND oauth_id = ?',
                        (provider, oauth_id)).fetchone()
    if user:
        conn.execute('UPDATE users SET last_login = ? WHERE id = ?', (datetime.now().isoformat(), user['id']))
        conn.commit()
        return dict(user)

    # Check by email
    user = conn.execute('SELECT id, username, email, is_premium FROM users WHERE email = ?', (email,)).fetchone()
    if user:
        conn.execute('UPDATE users SET oauth_provider = ?, oauth_id = ?, last_login = ? WHERE id = ?',
                     (provider, oauth_id, datetime.now().isoformat(), user['id']))
        conn.commit()
        return dict(user)

    # Create new
    random_pass = bcrypt.hashpw(os.urandom(32), bcrypt.gensalt()).decode('utf-8')
    base_username = username or email.split('@')[0]
    unique_username = base_username
    counter = 1
    while True:
        existing = conn.execute('SELECT id FROM users WHERE username = ?', (unique_username,)).fetchone()
        if not existing:
            break
        unique_username = f"{base_username}{counter}"
        counter += 1

    cursor = conn.execute(
        'INSERT INTO users (username, email, password, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?)',
        (unique_username, email, random_pass, provider, oauth_id)
    )
    conn.commit()
    user_id = cursor.lastrowid

    conn.execute('INSERT INTO user_settings (user_id) VALUES (?)', (user_id,))
    conn.commit()

    return {'id': user_id, 'username': unique_username, 'email': email, 'is_premium': 0}


@app.route('/api/oauth/google', methods=['POST'])
def google_oauth():
    data = request.get_json()
    token = data.get('credential', '')

    if not token:
        return jsonify({'success': False, 'message': 'No token provided'}), 400

    try:
        # Development Bypass for Simulated Tokens
        if token.startswith('simulated_token_'):
            google_id = "123456789"
            email = "demo_user@google.com"
            name = "Google Demo User"
        else:
            resp = requests.get(f'https://oauth2.googleapis.com/tokeninfo?id_token={token}')
            if resp.status_code != 200:
                return jsonify({'success': False, 'message': 'Invalid Google token'}), 401

            google_data = resp.json()
            google_id = google_data.get('sub')
            email = google_data.get('email')
            name = google_data.get('name', '')

        if not google_id or not email:
            return jsonify({'success': False, 'message': 'Incomplete Google profile'}), 400

        conn = get_db()
        user = get_or_create_oauth_user('google', google_id, email, name, conn)
        conn.close()

        session['user_id'] = user['id']
        session['username'] = user['username']

        return jsonify({
            'success': True, 'message': 'Google login successful!',
            'user': user
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Google auth failed: {str(e)}'}), 500


@app.route('/api/oauth/microsoft', methods=['POST'])
def microsoft_oauth():
    data = request.get_json()
    access_token = data.get('access_token', '')

    if not access_token:
        return jsonify({'success': False, 'message': 'No token provided'}), 400

    try:
        # Development Bypass for Simulated Tokens
        if access_token.startswith('simulated_token_'):
            ms_id = "ms-987654321"
            email = "ms_demo@outlook.com"
            name = "Microsoft Demo User"
        else:
            resp = requests.get('https://graph.microsoft.com/v1.0/me',
                                headers={'Authorization': f'Bearer {access_token}'})
            if resp.status_code != 200:
                return jsonify({'success': False, 'message': 'Invalid Microsoft token'}), 401

            ms_data = resp.json()
            ms_id = ms_data.get('id')
            email = ms_data.get('mail') or ms_data.get('userPrincipalName', '')
            name = ms_data.get('displayName', '')

        if not ms_id or not email:
            return jsonify({'success': False, 'message': 'Incomplete Microsoft profile'}), 400

        conn = get_db()
        user = get_or_create_oauth_user('microsoft', ms_id, email, name, conn)
        conn.close()

        session['user_id'] = user['id']
        session['username'] = user['username']

        return jsonify({
            'success': True, 'message': 'Microsoft login successful!',
            'user': user
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Microsoft auth failed: {str(e)}'}), 500


@app.route('/api/oauth/twitter/authorize', methods=['GET'])
def twitter_authorize():
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest()).decode().replace('=', '')
    
    session['twitter_oauth_state'] = state
    session['twitter_oauth_verifier'] = code_verifier
    
    redirect_uri = os.getenv('OAUTH_REDIRECT_URI', "http://localhost:8000/auth/login")
    client_id = OAUTH_CONFIG['twitter_client_id']
    
    params = {
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'scope': 'users.read tweet.read',
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256'
    }
    
    # Using request.args.to_dict() to build URL easily
    from urllib.parse import urlencode
    auth_url = "https://twitter.com/i/oauth2/authorize?" + urlencode(params)
    return jsonify({'success': True, 'url': auth_url})


@app.route('/api/oauth/twitter', methods=['POST'])
def twitter_oauth():
    data = request.get_json()
    code = data.get('code')
    state = data.get('state')
    
    if not code or not state:
        return jsonify({'success': False, 'message': 'Invalid code or state'}), 400
        
    if state != session.get('twitter_oauth_state'):
         return jsonify({'success': False, 'message': 'State mismatch'}), 401
         
    code_verifier = session.get('twitter_oauth_verifier')
    redirect_uri = "http://localhost:8000/auth/login"
    
    token_url = "https://api.twitter.com/2/oauth2/token"
    # Basic Auth header with Client ID and Secret
    import base64 as b64
    auth_str = f"{OAUTH_CONFIG['twitter_client_id']}:{OAUTH_CONFIG['twitter_client_secret']}"
    auth_bytes = b64.b64encode(auth_str.encode()).decode()
    
    payload = {
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri,
        'code_verifier': code_verifier
    }
    headers = {
        'Authorization': f'Basic {auth_bytes}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    try:
        resp = requests.post(token_url, data=payload, headers=headers)
        if resp.status_code != 200:
             return jsonify({'success': False, 'message': f"Token exchange failed: {resp.text}"}), 401
             
        token_data = resp.json()
        access_token = token_data.get('access_token')
        
        user_resp = requests.get('https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url',
                                headers={'Authorization': f'Bearer {access_token}'})
        
        if user_resp.status_code != 200:
             return jsonify({'success': False, 'message': 'Failed to fetch user profile'}), 401
             
        tw_data = user_resp.json().get('data', {})
        tw_id = tw_data.get('id')
        name = tw_data.get('name', 'X User')
        tw_username = tw_data.get('username')
        email = f"{tw_username}@x.orbian"
        
        conn = get_db()
        user = get_or_create_oauth_user('twitter', tw_id, email, name, conn)
        conn.close()
        
        session['user_id'] = user['id']
        session['username'] = user['username']
        
        return jsonify({'success': True, 'user': user})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ═══════════════════════════════════
# ORBIAN AS OAUTH PROVIDER (NEW!)
# ═══════════════════════════════════

@app.route('/api/orbian/register-app', methods=['POST'])
def register_orbian_app():
    """Register a new app to use Orbian OAuth"""
    data = request.get_json()
    user_id = data.get('user_id')
    app_name = data.get('app_name')
    redirect_uri = data.get('redirect_uri')

    if not all([user_id, app_name, redirect_uri]):
        return jsonify({'success': False, 'message': 'Missing fields'}), 400

    client_id = f"orbian_{secrets.token_hex(8)}"
    client_secret = secrets.token_urlsafe(32)

    conn = get_db()
    try:
        conn.execute('INSERT INTO oauth_apps (owner_id, app_name, client_id, client_secret, redirect_uri) VALUES (?, ?, ?, ?, ?)',
                     (user_id, app_name, client_id, client_secret, redirect_uri))
        conn.commit()
        return jsonify({
            'success': True, 
            'message': 'App registered!',
            'credentials': {'client_id': client_id, 'client_secret': client_secret}
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/orbian/authorize', methods=['POST'])
def orbian_authorize():
    """Authorize an app to access user data"""
    data = request.get_json()
    client_id = data.get('client_id')
    user_id = data.get('user_id')
    
    conn = get_db()
    app_row = conn.execute('SELECT id, redirect_uri FROM oauth_apps WHERE client_id = ?', (client_id,)).fetchone()
    
    if not app_row:
        conn.close()
        return jsonify({'success': False, 'message': 'Invalid Client ID'}), 404

    # Generate Auth Code
    auth_code = secrets.token_urlsafe(16)
    expires_at = (datetime.now() + timedelta(minutes=5)).isoformat()

    conn.execute('INSERT INTO oauth_codes (app_id, user_id, code, expires_at) VALUES (?, ?, ?, ?)',
                 (app_row['id'], user_id, auth_code, expires_at))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True, 
        'code': auth_code, 
        'redirect_uri': app_row['redirect_uri']
    })

@app.route('/api/orbian/token', methods=['POST'])
def orbian_token():
    """Exchange code for user profile (Simplified Token Endpoint)"""
    data = request.get_json()
    client_id = data.get('client_id')
    client_secret = data.get('client_secret')
    code = data.get('code')

    conn = get_db()
    # Verify App and Code
    query = '''
        SELECT u.id, u.username, u.email, u.is_premium 
        FROM oauth_codes c
        JOIN oauth_apps a ON c.app_id = a.id
        JOIN users u ON c.user_id = u.id
        WHERE a.client_id = ? AND a.client_secret = ? AND c.code = ? AND c.expires_at > ?
    '''
    user = conn.execute(query, (client_id, client_secret, code, datetime.now().isoformat())).fetchone()

    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Invalid credentials or expired code'}), 401

    # Cleanup code after use
    conn.execute('DELETE FROM oauth_codes WHERE code = ?', (code,))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'user': dict(user)
    })


# ═══════════════════════════════════
# CHAT API
# ═══════════════════════════════════
@app.route('/api/user/<int:user_id>/chats', methods=['GET'])
def get_chats(user_id):
    conn = get_db()
    try:
        chats = conn.execute(
            'SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
            (user_id,)).fetchall()
        return jsonify({'success': True, 'chats': [dict(c) for c in chats]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/user/<int:user_id>/chats', methods=['POST'])
def create_chat(user_id):
    data = request.get_json()
    title = data.get('title', 'New Chat')
    conn = get_db()
    try:
        cursor = conn.execute('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)', (user_id, title))
        conn.commit()
        return jsonify({'success': True, 'chat_id': cursor.lastrowid})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
def get_messages(chat_id):
    conn = get_db()
    try:
        msgs = conn.execute('SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at',
                            (chat_id,)).fetchall()
        return jsonify({'success': True, 'messages': [dict(m) for m in msgs]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/chats/<int:chat_id>/messages', methods=['POST'])
def save_message(chat_id):
    data = request.get_json()
    role = data.get('role')
    content = data.get('content')
    if not role or not content:
        return jsonify({'success': False, 'message': 'Role and content required'}), 400
    conn = get_db()
    try:
        cursor = conn.execute('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
                              (chat_id, role, content))
        conn.execute('UPDATE chat_sessions SET updated_at = ? WHERE id = ?',
                     (datetime.now().isoformat(), chat_id))
        conn.commit()
        return jsonify({'success': True, 'message_id': cursor.lastrowid})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


# ═══════════════════════════════════
# NEURAL MEMORY BRIDGE
# ═══════════════════════════════════
@app.route('/api/user/<int:user_id>/memory', methods=['GET'])
def get_neural_memory(user_id):
    conn = get_db()
    try:
        memories = conn.execute(
            'SELECT memory_key, memory_value, importance, updated_at FROM neural_memory WHERE user_id = ? ORDER BY importance DESC, updated_at DESC',
            (user_id,)).fetchall()
        return jsonify({'success': True, 'memory': [dict(m) for m in memories]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/user/<int:user_id>/memory', methods=['POST'])
def update_neural_memory(user_id):
    data = request.get_json()
    key = data.get('key', '').strip()
    value = data.get('value', '').strip()
    importance = data.get('importance', 1)

    if not key or not value:
        return jsonify({'success': False, 'message': 'Key and Value are required'}), 400

    conn = get_db()
    try:
        # Check if key exists
        existing = conn.execute('SELECT id FROM neural_memory WHERE user_id = ? AND memory_key = ?', 
                              (user_id, key)).fetchone()
        
        if existing:
            conn.execute('UPDATE neural_memory SET memory_value = ?, importance = ?, updated_at = ? WHERE id = ?',
                        (value, importance, datetime.now().isoformat(), existing['id']))
        else:
            conn.execute('INSERT INTO neural_memory (user_id, memory_key, memory_value, importance) VALUES (?, ?, ?, ?)',
                        (user_id, key, value, importance))
        conn.commit()
        return jsonify({'success': True, 'message': 'Neural memory updated'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


# ═══════════════════════════════════
# AUTONOMOUS TASK AGENTS
# ═══════════════════════════════════
@app.route('/api/user/<int:user_id>/agents', methods=['GET'])
def get_agents(user_id):
    conn = get_db()
    try:
        agents = conn.execute(
            'SELECT * FROM orbian_agents WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)).fetchall()
        return jsonify({'success': True, 'agents': [dict(a) for a in agents]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/user/<int:user_id>/agents', methods=['POST'])
def create_agent(user_id):
    data = request.get_json()
    name = data.get('name', '').strip()
    goal = data.get('goal', '').strip()
    schedule = data.get('schedule', 'manual')  # 'manual', 'daily', 'weekly'

    if not name or not goal:
        return jsonify({'success': False, 'message': 'Name and goal required'}), 400

    conn = get_db()
    try:
        cursor = conn.execute(
            'INSERT INTO orbian_agents (user_id, name, goal, schedule, status) VALUES (?, ?, ?, ?, ?)',
            (user_id, name, goal, schedule, 'idle')
        )
        conn.commit()
        return jsonify({'success': True, 'agent_id': cursor.lastrowid})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/agents/<int:agent_id>', methods=['PATCH'])
def update_agent(agent_id):
    data = request.get_json()
    status = data.get('status')
    result = data.get('last_result')

    conn = get_db()
    try:
        if status:
            conn.execute('UPDATE orbian_agents SET status = ?, updated_at = ? WHERE id = ?',
                        (status, datetime.now().isoformat(), agent_id))
        if result:
            conn.execute('UPDATE orbian_agents SET last_result = ?, updated_at = ? WHERE id = ?',
                        (result, datetime.now().isoformat(), agent_id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


# ═══ PROFILE / ACCOUNT SETTINGS ═══

@app.route('/api/user/profile', methods=['GET'])
def get_profile():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    conn = get_db()
    try:
        user = conn.execute('SELECT id, username, email, backup_email, created_at, last_login FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'backup_email': user['backup_email'] or '',
            'created_at': user['created_at'],
            'last_login': user['last_login']
        })
    finally:
        conn.close()


@app.route('/api/user/profile', methods=['PUT'])
def update_profile():
    data = request.json
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    conn = get_db()
    try:
        user = conn.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Update username if provided
        new_username = data.get('username', '').strip()
        if new_username:
            conn.execute('UPDATE users SET username = ? WHERE id = ?', (new_username, user_id))

        # Update backup email if provided
        new_backup = data.get('backup_email', '').strip()
        if new_backup:
            # Validate email format
            import re
            if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', new_backup):
                return jsonify({'error': 'Invalid backup email format'}), 400
            conn.execute('UPDATE users SET backup_email = ? WHERE id = ?', (new_backup, user_id))

        conn.commit()

        # Return updated profile
        updated = conn.execute('SELECT id, username, email, backup_email FROM users WHERE id = ?', (user_id,)).fetchone()
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': updated['id'],
                'username': updated['username'],
                'email': updated['email'],
                'backup_email': updated['backup_email'] or ''
            }
        })
    finally:
        conn.close()


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'AI Assistant Backend', 'db': 'SQLite'})


# ═══════════════════════════════════
# ADMIN — DEVELOPER CONSOLE
# ═══════════════════════════════════
def is_admin():
    user_id = session.get('user_id')
    if not user_id: return False
    conn = get_db()
    # Strictly check for Master Developer Email
    user = conn.execute('SELECT email FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return user and user['email'] == SMTP_CONFIG['email']

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    if not is_admin():
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    conn = get_db()
    users = conn.execute('SELECT id, username, email, is_active, is_premium, is_admin, created_at FROM users').fetchall()
    conn.close()
    return jsonify([dict(user) for user in users])

@app.route('/api/admin/toggle_premium', methods=['POST'])
def admin_toggle_premium():
    if not is_admin():
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    data = request.get_json()
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'success': False, 'message': 'User ID is required'}), 400
        
    conn = get_db()
    user = conn.execute('SELECT is_premium FROM users WHERE id = ?', (user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'User not found'}), 404
        
    new_status = 0 if user['is_premium'] == 1 else 1
    conn.execute('UPDATE users SET is_premium = ? WHERE id = ?', (new_status, user_id))
    conn.commit()
    conn.close()
    
    status_text = "Activated" if new_status == 1 else "Deactivated"
    return jsonify({'success': True, 'message': f'Premium {status_text} for User ID {user_id}', 'new_status': new_status})

# Ensure DB is initialized when deploying to production with Gunicorn
init_db()

if __name__ == '__main__':
    # init_db() # Moved out
    print("╔══════════════════════════════════════╗")
    print("║   Orbian AI — Flask Backend Server ║")
    print("║   http://localhost:5001               ║")
    print("║   SQLite + OTP + OAuth + Chat API     ║")
    print("╚══════════════════════════════════════╝")
    app.run(debug=True, port=5001)
