# ============================================================
# PlantOps AWS EC2 Deployment Script (PowerShell)
# Instance: i-098914ab67c56895a | IP: 98.94.228.240
# Run from: PlantOps project root
# Usage: powershell -ExecutionPolicy Bypass -File deploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$EC2_IP    = "98.94.228.240"
$EC2_USER  = "ubuntu"
$PEM_KEY   = "C:\Users\yuvan\Downloads\PlantOps (1).pem"
$PROJECT   = "C:\Users\yuvan\OneDrive\Desktop\Yuvan\PlantOps"

function SSH-Cmd($cmd) {
    ssh -i $PEM_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${EC2_USER}@${EC2_IP}" $cmd
}
function SCP-Up($src, $dest) {
    scp -i $PEM_KEY -o StrictHostKeyChecking=no -r $src "${EC2_USER}@${EC2_IP}:${dest}"
}

Write-Host "`n=== [1/9] Fixing PEM key permissions ===" -ForegroundColor Cyan
icacls $PEM_KEY /inheritance:r /grant:r "${env:USERNAME}:(R)" | Out-Null
Write-Host "Done." -ForegroundColor Green

Write-Host "`n=== [2/9] Testing SSH connection ===" -ForegroundColor Cyan
$test = SSH-Cmd "echo SSH_OK"
if ($test -notlike "*SSH_OK*") { Write-Error "SSH failed"; exit 1 }
Write-Host "Connected!" -ForegroundColor Green

Write-Host "`n=== [3/9] Installing Node.js 20 + Nginx + PM2 on EC2 ===" -ForegroundColor Cyan
SSH-Cmd "sudo apt-get update -qq 2>&1 | tail -3"
SSH-Cmd "sudo apt-get install -y -qq curl git nginx 2>&1 | tail -3"
SSH-Cmd "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3"
SSH-Cmd "sudo apt-get install -y -qq nodejs 2>&1 | tail -3"
SSH-Cmd "sudo npm install -g pm2 2>&1 | tail -3"
SSH-Cmd "node --version && npm --version && pm2 --version"
Write-Host "Dependencies installed." -ForegroundColor Green

Write-Host "`n=== [4/9] Creating remote directories ===" -ForegroundColor Cyan
SSH-Cmd "rm -rf ~/plantops && mkdir -p ~/plantops/backend ~/plantops/frontend"
Write-Host "Directories ready." -ForegroundColor Green

Write-Host "`n=== [5/9] Uploading backend source ===" -ForegroundColor Cyan
SCP-Up "$PROJECT\backend\src"              "~/plantops/backend/"
SCP-Up "$PROJECT\backend\package.json"     "~/plantops/backend/"
SCP-Up "$PROJECT\backend\tsconfig.json"    "~/plantops/backend/"
Write-Host "Backend uploaded." -ForegroundColor Green

Write-Host "`n=== [6/9] Uploading frontend source ===" -ForegroundColor Cyan
SCP-Up "$PROJECT\frontend\src"             "~/plantops/frontend/"
# public/ holds the 3D .glb models + logo; Vite copies it into dist. Without it nginx
# falls back to index.html and the 3D Digital Twin crashes ("Unexpected token '<'").
SCP-Up "$PROJECT\frontend\public"          "~/plantops/frontend/"
SCP-Up "$PROJECT\frontend\index.html"      "~/plantops/frontend/"
SCP-Up "$PROJECT\frontend\package.json"    "~/plantops/frontend/"
SCP-Up "$PROJECT\frontend\tsconfig.json"   "~/plantops/frontend/"
SCP-Up "$PROJECT\frontend\vite.config.ts"  "~/plantops/frontend/"

# Optional config files (skip if not present)
if (Test-Path "$PROJECT\frontend\tsconfig.node.json")  { SCP-Up "$PROJECT\frontend\tsconfig.node.json"  "~/plantops/frontend/" }
if (Test-Path "$PROJECT\frontend\postcss.config.js")   { SCP-Up "$PROJECT\frontend\postcss.config.js"   "~/plantops/frontend/" }
if (Test-Path "$PROJECT\frontend\tailwind.config.js")  { SCP-Up "$PROJECT\frontend\tailwind.config.js"  "~/plantops/frontend/" }
Write-Host "Frontend uploaded." -ForegroundColor Green

Write-Host "`n=== [7/9] Writing .env files on server ===" -ForegroundColor Cyan
if (Test-Path "$PROJECT\backend\.env") {
    SCP-Up "$PROJECT\backend\.env" "~/plantops/backend/.env"
}
if (Test-Path "$PROJECT\frontend\.env") {
    SCP-Up "$PROJECT\frontend\.env" "~/plantops/frontend/.env"
}
Write-Host ".env files synced." -ForegroundColor Green

Write-Host "`n=== [8/9] Add swap + npm install + build ===" -ForegroundColor Cyan
# Add 2 GB swap so Vite doesn't get OOM-killed on small EC2 instances
SSH-Cmd "sudo fallocate -l 2G /swapfile 2>/dev/null || true; sudo chmod 600 /swapfile; sudo mkswap /swapfile; sudo swapon /swapfile; free -h"
SSH-Cmd "cd ~/plantops/backend && npm install && npm run build && echo 'Backend built OK'"
SSH-Cmd "cd ~/plantops/frontend && npm install && NODE_OPTIONS='--max-old-space-size=1024' npm run build && test -f dist/models/kenney-city-kit-roads/road-end.glb && echo 'Frontend built OK'"
Write-Host "Build complete." -ForegroundColor Green

Write-Host "`n=== [9/9] Configure Nginx + Start PM2 ===" -ForegroundColor Cyan

SSH-Cmd @"
sudo tee /etc/nginx/sites-available/plantops > /dev/null <<'NEOF'
server {
    listen 80;
    server_name _;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    root /home/ubuntu/plantops/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location /health {
        proxy_pass http://127.0.0.1:4000/health;
    }
}
NEOF
"@

SSH-Cmd "sudo ln -sf /etc/nginx/sites-available/plantops /etc/nginx/sites-enabled/plantops"
SSH-Cmd "sudo rm -f /etc/nginx/sites-enabled/default"
SSH-Cmd "sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx"
Write-Host "Nginx configured." -ForegroundColor Green

SSH-Cmd "cd ~/plantops/backend && pm2 stop plantops-api 2>/dev/null; pm2 delete plantops-api 2>/dev/null; pm2 start dist/server.js --name plantops-api && pm2 save"
SSH-Cmd "pm2 startup systemd -u ubuntu --hp /home/ubuntu | grep -E '^sudo' | bash"
Write-Host "PM2 started." -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "  Frontend:     http://$EC2_IP" -ForegroundColor White
Write-Host "  API:          http://$EC2_IP/api" -ForegroundColor White
Write-Host "  Health:       http://$EC2_IP/health" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green

# Quick health-check
Write-Host "`nHealth check..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
SSH-Cmd "curl -s http://localhost:4000/health || echo 'Backend not yet ready'"
SSH-Cmd "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost/ || echo 'Nginx check failed'"
