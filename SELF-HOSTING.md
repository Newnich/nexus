# Self-Hosting NEXUS on a VPS

> Deploy NEXUS on your own VPS for full control — complete with automatic SSL via Caddy, persistent storage, and the AI worker.

---

## 🖥️ Requirements

| Resource | Minimum                                | Recommended              |
| -------- | -------------------------------------- | ------------------------ |
| RAM      | 2 GB                                   | 4 GB                     |
| CPU      | 2 cores                                | 4 cores                  |
| Disk     | 20 GB                                  | 50 GB                    |
| OS       | Ubuntu 22.04+                          | Debian 12 / Ubuntu 24.04 |
| Docker   | v24+                                   | v26+                     |
| Domain   | Any `A` record pointing to your VPS IP | —                        |

---

## 🚀 One-Line Deploy

SSH into your VPS and run:

```bash
bash <(curl -s https://raw.githubusercontent.com/Newnich/nexus/master/scripts/setup-vps.sh)
```

> **Coming soon:** The setup script above automates everything below.

---

## 📋 Manual Setup

### 1. Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to docker group (no sudo needed)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version && docker compose version
```

### 2. Clone NEXUS

```bash
git clone https://github.com/Newnich/nexus.git /opt/nexus
cd /opt/nexus
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Required variables (see [PRODUCTION.md](./PRODUCTION.md) for full table):

| Variable                        | How to Get                                             |
| ------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Dashboard → Settings → API → Project URL      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → Anon Key         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase Dashboard → Settings → API → Service Role Key |
| `REDIS_HOST`                    | Upstash Dashboard → Redis Database → Endpoint          |
| `REDIS_PORT`                    | Upstash default: `6379`                                |
| `REDIS_PASSWORD`                | Upstash Dashboard → Redis Database → Password          |
| `REDIS_TLS`                     | Set to `true` for Upstash                              |

> 💡 **Tip:** Use [Upstash](https://upstash.com) (free tier: 10k commands/day) for Redis — it's managed and requires no server.

### 4. Create Caddyfile for Automatic SSL

Create a `Caddyfile` in the project root:

```caddy
nexus.yourdomain.com {
    reverse_proxy nexus:3000

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }

    # Rate limiting (Caddy Enterprise)
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 60
            window 1m
        }
    }
}
```

### 5. Update Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  # ── Caddy reverse proxy (automatic SSL) ──
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - nexus-net
    depends_on:
      - nexus

  # ── NEXUS Next.js app ──
  nexus:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BUILD_TARGET: standalone
    restart: unless-stopped
    env_file: .env
    environment:
      - NODE_ENV=production
      - BUILD_TARGET=standalone
    networks:
      - nexus-net
    depends_on:
      - worker

  # ── AI Worker ──
  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    restart: unless-stopped
    env_file: .env
    environment:
      - NODE_ENV=production
    networks:
      - nexus-net

  # ── Ollama (AI model server) ──
  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    volumes:
      - ollama_models:/root/.ollama
    networks:
      - nexus-net
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

networks:
  nexus-net:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
  ollama_models:
```

### 6. Launch Everything

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Pull Ollama models
docker compose -f docker-compose.prod.yml exec ollama ollama pull nomic-embed-text
docker compose -f docker-compose.prod.yml exec ollama ollama pull llama3.2

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 7. Verify Deployment

```bash
# Health check
curl https://nexus.yourdomain.com/api/health

# Queue status
curl https://nexus.yourdomain.com/api/queue/status
```

---

## 🛡️ Security Hardening

### Firewall (UFW)

```bash
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80/tcp       # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp      # HTTPS
sudo ufw enable
```

### Automatic Updates

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### Fail2Ban (SSH protection)

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

---

## 🔄 Maintenance

### Update NEXUS

```bash
cd /opt/nexus
git pull origin master
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f nexus
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Backup Database

```bash
# Get connection string from Supabase Dashboard → Settings → Database
pg_dump "postgresql://..." > /opt/backups/nexus_$(date +%Y%m%d).sql
```

### Restart Services

```bash
docker compose -f docker-compose.prod.yml restart
```

---

## 🧠 With GPU Acceleration

If your VPS has an NVIDIA GPU, enable GPU passthrough for Ollama:

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt update && sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker

# Deploy with GPU
docker compose -f docker-compose.prod.yml up -d
```

---

## 🚨 Troubleshooting

| Problem                       | Solution                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSL certificate not issued    | Ensure domain's `A` record points to your VPS IP. Caddy auto-provisions certs via Let's Encrypt.                                                                    |
| Ollama out of memory          | Reduce model size (`ollama pull llama3.2:1b` instead of `llama3.2`) or add swap: `sudo fallocate -l 4G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Worker can't connect to Redis | Verify `REDIS_HOST` and `REDIS_PASSWORD`. For Upstash, ensure `REDIS_TLS=true`.                                                                                     |
| App returns 502               | Caddy can't reach the app. Check `docker compose ps nexus` — ensure it's running on port 3000.                                                                      |
| Disk space full               | Prune Docker images: `docker system prune -a`. Remove old backups.                                                                                                  |

---

> **NEXUS** — Your AI-Native Knowledge Operating System. Save anything. Find everything. Know more.
