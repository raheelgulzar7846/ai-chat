# AI Chat App - VPS Deployment Guide

## Prerequisites
- Ubuntu 22.04 VPS (DigitalOcean, Vultr, Hetzner, etc.)
- Domain name pointed to your VPS IP
- Anthropic API key from console.anthropic.com

---

## Step 1: Server Setup

```bash
# Update server
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## Step 2: Upload Your App

```bash
# On your local machine - zip the project
zip -r ai-chat.zip ai-chat/ --exclude "*/node_modules/*" --exclude "*/.next/*"

# Upload to VPS
scp ai-chat.zip root@YOUR_VPS_IP:/var/www/

# On VPS - extract
cd /var/www
unzip ai-chat.zip
cd ai-chat
```

---

## Step 3: Configure Environment

```bash
# Create .env.local with your API key
cp .env.local.example .env.local
nano .env.local

# Fill in:
# ANTHROPIC_API_KEY=sk-ant-your-key-here
# AI_NAME=YourAssistantName
# AI_SYSTEM_PROMPT=Your custom persona here
```

---

## Step 4: Build & Start

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start with PM2
pm2 start npm --name "ai-chat" -- start
pm2 save
pm2 startup  # Run the command it gives you
```

---

## Step 5: Nginx Config

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/ai-chat
sudo ln -s /etc/nginx/sites-available/ai-chat /etc/nginx/sites-enabled/

# Edit and replace yourdomain.com with your actual domain
sudo nano /etc/nginx/sites-available/ai-chat

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Step 6: SSL Certificate (Free)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Done! Your app is live at https://yourdomain.com

---

## Useful Commands

```bash
pm2 status          # Check app status
pm2 logs ai-chat    # View logs
pm2 restart ai-chat # Restart app

# Update app after changes
npm run build
pm2 restart ai-chat
```

---

## Customize Your AI

Edit `.env.local` to change:
- `AI_NAME` - Your assistant's name
- `AI_SYSTEM_PROMPT` - Personality, language, restrictions

Example system prompt for Urdu/Hinglish:
```
You are a helpful AI assistant. Reply in Hinglish or Roman Urdu by default unless user writes in English. Be direct, smart, and genuinely useful. No unnecessary fluff.
```
