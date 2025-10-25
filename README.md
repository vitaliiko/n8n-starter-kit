# n8n Starter Kit

A complete n8n automation platform setup with PostgreSQL, Ollama (ARM64), Qdrant vector database, and Traefik reverse proxy.

## Features

- **n8n**: Self-hosted workflow automation
- **PostgreSQL**: Reliable database backend with automated backups
- **Ollama**: Local LLM support (optimized for ARM64/Raspberry Pi 5)
- **Qdrant**: Vector database for AI/ML workflows
- **Traefik**: Reverse proxy with automatic HTTPS
- **Automated Backups**: Daily PostgreSQL backups

## Prerequisites

- Docker and Docker Compose
- Raspberry Pi 5 (or other ARM64 device) for Ollama support
- Domain name (for Traefik HTTPS)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd n8n-starter-kit
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Configure your `.env` file**
   ```bash
   # Database
   POSTGRES_USER=n8n
   POSTGRES_PASSWORD=<secure-password>
   POSTGRES_DB=n8n
   
   # n8n
   N8N_ENCRYPTION_KEY=<generate-random-key>
   N8N_DEMO_CREDENTIALS_KEY=<generate-random-key>
   N8N_USER_MANAGEMENT_JWT_SECRET=<generate-random-key>
   
   # Domain
   SUBDOMAIN=n8n
   DOMAIN_NAME=yourdomain.com
   
   # Ollama Model (optional, defaults to phi-2)
   OLLAMA_MODEL=llama3.2
   ```

4. **Start the stack**
   ```bash
   docker compose up -d
   ```

5. **Access n8n**
   - Open `https://n8n.yourdomain.com` (or your configured subdomain)
   - Complete the initial setup

## Local Development (Without Traefik)

If you want to run the stack locally without Traefik and SSL, use the local override configuration:

1. **Start the stack locally**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
   ```

2. **Access n8n locally**
   - Open `http://localhost:5678`
   - No domain or SSL certificates required

3. **Stop the local stack**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.local.yml down
   ```

**What's different in local mode:**
- Traefik is disabled
- n8n runs on HTTP instead of HTTPS
- Direct access via `localhost:5678` (no reverse proxy)
- No SSL certificates needed
- Perfect for development and testing

## Ollama Configuration

### Supported Models

The Ollama service uses the ARM64-optimized image (`ghcr.io/justincv/ollama-arm64:latest`) for Raspberry Pi 5.

You can specify which model to use by setting the `OLLAMA_MODEL` environment variable in your `.env` file:

```bash
OLLAMA_MODEL=llama3.2
```

Default model: `phi-2`

### Changing Models

**If containers are already running:**

1. Pull the new model directly:
   ```bash
   docker compose exec ollama ollama pull llama3.2
   ```

2. Restart the ollama container:
   ```bash
   docker compose restart ollama
   ```

**If starting fresh:**

1. Update `OLLAMA_MODEL` in `.env`
2. Start the stack:
   ```bash
   docker compose up -d
   ```

The `ollama-pull-llama` service will automatically download the specified model.

### Available Models

Some popular models compatible with ARM64:
- `phi-2` (default, ~2.7GB)
- `llama3.2` (~2GB)
- `llama3.2:1b` (~1.3GB)
- `gemma2:2b` (~1.6GB)
- `qwen2.5:0.5b` (~397MB)

See [Ollama Model Library](https://ollama.com/library) for more options.

## Services

### n8n
- **Port**: 5678 (via Traefik)
- **Data**: Stored in `n8n_storage` volume
- **Shared Folder**: `./shared` mounted to `/data/shared`

### PostgreSQL
- **Version**: 16-alpine
- **Data**: Stored in `postgres_storage` volume
- **Backups**: Automated daily backups to `./backups`

### Ollama
- **Image**: `ghcr.io/justincv/ollama-arm64:latest`
- **Port**: 11434
- **Data**: Stored in `ollama_storage` volume
- **Memory Limit**: 8GB (configurable)

### Qdrant
- **Port**: 6333
- **Data**: Stored in `qdrant_storage` volume

### Traefik
- **Port**: 5678
- **Config**: `./traefik/dynamic/tls.yml`
- **Certificates**: `./certs/`

## Backup & Restore

### PostgreSQL Backups

Automated backups run daily at 3 AM (configurable via `POSTGRES_BACKUP_CRON`).

**Manual Backup:**
```bash
docker compose exec postgres-maintenance /backup.sh
```

**Restore from Backup:**
```bash
docker compose exec postgres-maintenance /restore.sh /backups/n8n-backup.sql
```

## Maintenance

### View Logs
```bash
docker compose logs -f n8n
docker compose logs -f ollama
```

### Update Services
```bash
docker compose pull
docker compose up -d
```

### Clean Up
```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes all data)
docker compose down -v
```

## Troubleshooting

### Ollama out of memory
Adjust memory limits in `docker-compose.yml`:
```yaml
x-ollama: &service-ollama
  mem_limit: 6g      # Reduce if needed
  memswap_limit: 12g # Reduce if needed
```

### n8n can't connect to Ollama
Check that both services are on the same network:
```bash
docker compose exec n8n ping ollama
```

### Model download fails
Try pulling manually:
```bash
docker compose exec ollama ollama pull <model-name>
```

## Development

### Demo Data
Demo workflows and credentials are located in `./n8n/demo-data/` and are automatically imported on first run.

### Re-keying Demo Credentials
```bash
docker compose run --rm n8n-import
```

## Security Notes

- Always use strong, unique passwords for `POSTGRES_PASSWORD`
- Generate secure random keys for n8n encryption keys
- Keep your `.env` file secure and never commit it to version control
- Use proper SSL/TLS certificates for production

## License

See [LICENSE](LICENSE) file for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
