# Deployment Setup: Ubuntu VPS with Nginx + PM2

This guide walks through deploying the User Management application
(`server/` Express API + `client/` React/Vite frontend) to a fresh
Ubuntu VPS, served by Nginx with the backend managed by PM2.

---

## 1. Prerequisites

- A fresh Ubuntu 22.04/24.04 VPS with a non-root sudo user
- A domain or subdomain pointed at the VPS's IP address (optional, but
  required for HTTPS via Let's Encrypt)
- SSH access to the server

---

## 2. Update the System & Install Node.js

```bash
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x (LTS) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential

node -v   # v22.x
npm -v
```

---

## 3. Install Nginx and PM2

```bash
sudo apt install -y nginx

sudo npm install -g pm2
```

---

## 4. Clone and Build the Application

```bash
cd /var/www
sudo mkdir simplefe && sudo chown $USER:$USER simplefe
git clone <your-repo-url> simplefe
cd simplefe

# Install dependencies for both workspaces
npm install

# Build backend (TypeScript -> dist/) and frontend (static assets -> client/dist/)
npm run build
```

---

## 5. Configure the Backend Environment

```bash
cd /var/www/simplefe/server
cp .env.example .env
nano .env
```

Set production values:

```env
PORT=4000
JWT_SECRET=<generate a long random secret>
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://your-domain.com
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> The first time the server starts, it seeds `server/data/users.json`
> with a default admin (`admin` / `admin123`). Log in and change this
> password immediately after deployment.

---

## 6. Run the Backend with PM2

From `/var/www/simplefe/server`:

```bash
pm2 start dist/server.js --name simplefe-api
```

Persist PM2 across reboots:

```bash
pm2 save
pm2 startup systemd
# Run the command that 'pm2 startup' prints (it configures a systemd
# service to restore the saved process list on boot)
```

Useful PM2 commands:

```bash
pm2 status
pm2 logs simplefe-api
pm2 restart simplefe-api
```

---

## 7. Configure Nginx

The built frontend (`client/dist/`) is served as static files by
Nginx. API requests (`/api/*`) are reverse-proxied to the PM2-managed
backend on port 4000.

Create `/etc/nginx/sites-available/simplefe`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/simplefe/client/dist;
    index index.html;

    # Serve static frontend, fall back to index.html for client-side routing
    location / {
        try_files $uri /index.html;
    }

    # Reverse proxy API requests to the Express backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/simplefe /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. (Optional) Enable HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot will edit the Nginx config to add a `listen 443 ssl` block and
set up automatic certificate renewal (`certbot renew` runs via a
systemd timer).

After enabling HTTPS, update `CORS_ORIGIN` in `server/.env` to
`https://your-domain.com` and restart the backend:

```bash
pm2 restart simplefe-api
```

---

## 9. Verify the Deployment

```bash
# Frontend
curl -I https://your-domain.com

# API health check via the proxy
curl -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Open `https://your-domain.com` in a browser, log in with
`admin` / `admin123`, and **change the default admin password
immediately**.

---

## 10. Updating the Application

```bash
cd /var/www/simplefe
git pull
npm install
npm run build
pm2 restart simplefe-api
```

The frontend is static, so a new build (`client/dist/`) takes effect
immediately — no Nginx restart needed.

---

## 11. Firewall (Optional but Recommended)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

The backend port (4000) should **not** be exposed publicly — it is
only accessed via Nginx's reverse proxy on `127.0.0.1:4000`.
