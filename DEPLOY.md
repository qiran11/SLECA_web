# Server Deployment

This project can be deployed as two containers:

- `web`: Nginx serves the built React app and forwards `/api` requests.
- `api`: FastAPI reads `cell_metadata_umap.parquet` and returns filtered UMAP data.

The large data file is not committed to git. Copy `cell_metadata_umap.parquet` to the project root on the server before starting the app.

## 1. Prepare the Server

Install Docker and Docker Compose on the server.

Open these firewall ports:

- `80` for the website
- `443` if you later add HTTPS

## 2. Upload the Project

On the server:

```bash
git clone https://github.com/qiran11/SLECA_web.git
cd SLECA_web
```

Then upload or copy the data file into this folder:

```bash
ls cell_metadata_umap.parquet
```

The file must be at:

```text
SLECA_web/cell_metadata_umap.parquet
```

## 3. Start

```bash
docker compose up -d --build
```

Open:

```text
http://SERVER_IP/
```

## Bind The Domain

Use these records in the domain control panel after the server has a public IP address:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `SERVER_PUBLIC_IP` |
| A | `www` | `SERVER_PUBLIC_IP` |

After DNS takes effect, open:

```text
http://sleca-repository.com/
http://www.sleca-repository.com/
```

The included Nginx config already accepts both domain names:

```text
sleca-repository.com
www.sleca-repository.com
```

If the server is in mainland China, the domain may also need ICP filing before public HTTP/HTTPS access is allowed by the hosting provider.

## 4. Check Status

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

The backend health check should return JSON:

```bash
curl http://127.0.0.1/api/health
```

## 5. Update Later

```bash
git pull
docker compose up -d --build
```

If you replace the parquet file, restart the API:

```bash
docker compose restart api
```

## Notes

For local development, `.env.development` keeps the frontend pointed at `http://127.0.0.1:8000`.

For production, the built frontend uses same-origin `/api` requests, so the browser does not need to connect to `127.0.0.1:8000`.

## Windows Server Notes

The Docker Compose files in this repository use Linux containers (`python:3.11-slim`, `node:20-alpine`, and `nginx:1.27-alpine`).

On Windows Server, you have two practical deployment choices.

### Option A: Use WSL 2 / Linux VM, then Docker Compose

This is closest to the standard Linux deployment.

You need:

- Windows Server 2022 or newer is preferred.
- WSL 2 or a small Linux virtual machine.
- Hardware virtualization enabled in BIOS/UEFI.
- Enough memory for the browser workload and backend, preferably 16 GB or more.
- Port `80` open in Windows Firewall.

After entering the Linux environment, use the normal commands:

```bash
git clone https://github.com/qiran11/SLECA_web.git
cd SLECA_web
docker compose up -d --build
```

Copy `cell_metadata_umap.parquet` into the project root before starting.

### Option B: Native Windows Deployment

This avoids Docker on Windows Server.

You need:

- Git for Windows
- Node.js 20 LTS or newer
- Conda environment with `fastapi`, `uvicorn`, `pandas`, and `pyarrow`
- Nginx for Windows or IIS URL Rewrite / ARR
- A Windows service manager such as NSSM to keep the backend running
- Port `80` open in Windows Firewall

Build the frontend:

```powershell
cd D:\SLECA_web
npm ci
npm run build
```

Run the backend:

```powershell
cd D:\SLECA_web
D:\Anaconda3\envs\sleca_api\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Serve `dist/` with Nginx or IIS, and reverse proxy `/api/` to:

```text
http://127.0.0.1:8000/api/
```

For this project, Option B is usually simpler if the machine is truly Windows Server and you do not already have WSL 2 or a Linux VM ready.

## Alibaba Cloud ECS Deployment

For this project, an Alibaba Cloud Linux ECS instance is simpler than a Windows ECS instance.

Recommended starting point:

- OS: Alibaba Cloud Linux 3 or Ubuntu 22.04 LTS
- CPU / memory: at least 2 vCPU and 8 GB RAM; 4 vCPU and 16 GB RAM is safer for full-data use
- System disk: at least 40 GB
- Public bandwidth: start with 5 Mbps or higher if many people will use the atlas
- Public IP: required if you want to bind `sleca-repository.com` directly

### 1. Buy ECS

In the Alibaba Cloud console:

1. Create an ECS instance.
2. Choose a Linux image.
3. Assign a public IP.
4. Create or select a security group.
5. Save the login password or SSH key.

### 2. Open Security Group Ports

Add inbound rules:

| Port | Use | Source |
| --- | --- | --- |
| `22` | SSH login | your own IP only if possible |
| `80` | HTTP website | `0.0.0.0/0` |
| `443` | HTTPS website | `0.0.0.0/0` |

Do not expose backend port `8000` to the public internet. Nginx forwards `/api` to it internally.

### 3. Install Docker

Connect to the ECS instance with SSH, then install Docker and Docker Compose according to the OS you chose.

After installation, verify:

```bash
docker --version
docker compose version
```

### 4. Upload Project And Data

Clone the project:

```bash
git clone https://github.com/qiran11/SLECA_web.git
cd SLECA_web
```

Upload `cell_metadata_umap.parquet` to this same directory:

```text
SLECA_web/cell_metadata_umap.parquet
```

You can upload with `scp`, SFTP, Xftp, or the Alibaba Cloud workbench file tool.

Example:

```bash
scp cell_metadata_umap.parquet root@SERVER_PUBLIC_IP:/root/SLECA_web/
```

### 5. Start The Website

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs -f api
```

Open:

```text
http://SERVER_PUBLIC_IP/
```

### 6. Bind Domain

In the DNS control panel for `sleca-repository.com`, add:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `SERVER_PUBLIC_IP` |
| A | `www` | `SERVER_PUBLIC_IP` |

After DNS takes effect:

```text
http://sleca-repository.com/
http://www.sleca-repository.com/
```

### 7. Enable HTTPS Later

After the HTTP site works, add HTTPS with either:

- Alibaba Cloud certificate + Nginx config
- Certbot / Let's Encrypt on the ECS instance
- A CDN or WAF service in front of the ECS instance

If the ECS instance is in mainland China, the domain may need ICP filing before stable public HTTP/HTTPS access is allowed.
