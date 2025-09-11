# Microservice Chat App - Docker Deployment

This repository contains a microservice-based chat application with the following architecture:

## Services

- **Auth Service** (`pritam25/microservice-auth:latest`) - Port 5000
- **Backend1** (`pritam25/microservice-backend1:latest`) - Port 4000
- **Backend2** (`pritam25/microservice-backend2:latest`) - Port 4001
- **Frontend1** (`pritam25/microservice-frontend1:latest`) - Port 3000
- **Frontend2** (`pritam25/microservice-frontend2:latest`) - Port 3001

## Quick Deployment

## Quick Deployment

Pull and run everything with a single container:

```bash
# Download the all-in-one compose file
curl -O https://raw.githubusercontent.com/Pritam-25/microservice_chat_app/main/docker-compose.allinone.yml
curl -O https://raw.githubusercontent.com/Pritam-25/microservice_chat_app/main/.env.production.example

# Setup environment
cp .env.production.example .env
# Edit .env with your MongoDB and Redis credentials

# Run everything in one container
docker compose -f docker-compose.allinone.yml up -d
```

**Alternative: Direct Docker Run**

```bash
docker run -d \
  -p 3000:3000 -p 3001:3001 -p 4000:4000 -p 4001:4001 -p 5000:5000 \
  -e MONGO_URI="your-mongo-uri" \
  -e JWT_SECRET="your-jwt-secret" \
  -e REDIS_URL="your-redis-url" \
  pritam25/microservice-chat-allinone:latest
```

**Access the application:**

- Frontend1: http://localhost:3000
- Frontend2: http://localhost:3001
- Auth API: http://localhost:5000
- Backend1 API: http://localhost:4000
- Backend2 API: http://localhost:4001

## Environment Variables

### Required Variables

| Variable          | Description                  | Example                                              |
| ----------------- | ---------------------------- | ---------------------------------------------------- |
| `MONGO_ATLAS_URI` | MongoDB connection string    | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `JWT_SECRET`      | Secret for JWT token signing | `your-super-secure-secret`                           |
| `REDIS_URL`       | Redis connection URL         | `redis://user:pass@host:port`                        |

### Optional Variables

| Variable         | Default      | Description            |
| ---------------- | ------------ | ---------------------- |
| `NODE_ENV`       | `production` | Environment mode       |
| `AUTH_PORT`      | `5000`       | Auth service port      |
| `BACKEND1_PORT`  | `4000`       | Backend1 service port  |
| `BACKEND2_PORT`  | `4001`       | Backend2 service port  |
| `FRONTEND1_PORT` | `3000`       | Frontend1 service port |
| `FRONTEND2_PORT` | `3001`       | Frontend2 service port |

## Production Deployment

For production deployment on a server with a domain:

1. **Update environment variables:**

   ```bash
   # In your .env file
   AUTH_PUBLIC_URL=https://yourdomain.com:5000
   FRONTEND1_PUBLIC_BACKEND_URL=https://yourdomain.com:4000
   FRONTEND2_PUBLIC_BACKEND_URL=https://yourdomain.com:4001
   ```

2. **Use a reverse proxy (Nginx/Traefik) for SSL termination**

3. **Configure firewall rules for the required ports**

## Development

To build images locally instead of pulling from Docker Hub:

```bash
git clone https://github.com/Pritam-25/microservice_chat_app.git
cd microservice_chat_app
docker compose build
docker compose up -d
```

## Monitoring

Check service status:

```bash
docker compose -f docker-compose.allinone.yml ps
docker compose -f docker-compose.allinone.yml logs
```

## Development

To build the all-in-one image locally instead of pulling from Docker Hub:

```bash
git clone https://github.com/Pritam-25/microservice_chat_app.git
cd microservice_chat_app
docker build -f Dockerfile.allinone -t pritam25/microservice-chat-allinone:latest .
docker compose -f docker-compose.allinone.yml up -d
```

## Troubleshooting

1. **Services not connecting:** Check that MONGO_URI and REDIS_URL are correct
2. **Frontend not loading:** Verify that the API URLs in environment variables are accessible
3. **Socket connections failing:** Ensure REDIS_URL is configured properly for pub/sub

## Architecture

All services run in a single container with PM2 process manager:

```
┌─────────────────────────────────────┐
│        All-in-One Container         │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │  Frontend1  │ │  Frontend2  │   │
│  │   :3000     │ │   :3001     │   │
│  └─────┬───────┘ └─────┬───────┘   │
│        │               │           │
│        ▼               ▼           │
│  ┌─────────────┐ ┌─────────────┐   │
│  │  Backend1   │ │  Backend2   │   │
│  │   :4000     │ │   :4001     │   │
│  └─────┬───────┘ └─────┬───────┘   │
│        │               │           │
│        └──────┬────────┘           │
│               ▼                    │
│         ┌─────────────┐            │
│         │    Auth     │            │
│         │   :5000     │            │
│         └─────────────┘            │
└─────────────────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   ┌─────────┐   ┌─────────┐
   │ MongoDB │   │  Redis  │
   └─────────┘   └─────────┘
   (External)    (External)
```
