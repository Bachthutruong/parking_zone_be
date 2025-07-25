# 🚀 Deployment Guide - Parking Zone Backend

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- MongoDB (local or cloud)
- PM2 (for production process management)
- Docker (optional)

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd parking_zone/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

## 🚀 Deployment Options

### Option 1: Traditional Server Deployment

#### Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start in production mode
npm run pm2:start

# Monitor logs
npm run pm2:logs

# Monitor performance
npm run pm2:monit
```

#### Manual Deployment
```bash
# Build for production
npm run build

# Start production server
npm run deploy:prod
```

### Option 2: Docker Deployment

#### Build and Run Docker Container
```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run

# Or use docker-compose for full stack
docker-compose up -d
```

#### Docker Compose (with MongoDB)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 3: Cloud Platform Deployment

#### Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your_mongodb_uri
heroku config:set JWT_SECRET=your_jwt_secret

# Deploy
npm run heroku:deploy
```

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy
npm run railway:deploy
```

#### Render
```bash
# Connect your GitHub repository to Render
# Set environment variables in Render dashboard
# Deploy automatically on push to main branch
npm run render:deploy
```

#### Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
npm run vercel:deploy
```

## 🔧 Environment Variables

### Required Variables
```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://your-mongodb-uri
JWT_SECRET=your-super-secret-jwt-key
```

### Optional Variables
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CORS_ORIGIN=https://your-frontend-domain.com
```

## 📊 Monitoring & Logging

### PM2 Monitoring
```bash
# View all processes
pm2 list

# Monitor CPU/Memory
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart parking-zone-backend
```

### Health Check
```bash
# Check if API is running
curl http://localhost:5000/api/health
```

## 🔒 Security Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure CORS properly
- [ ] Use HTTPS in production
- [ ] Set up rate limiting
- [ ] Configure MongoDB authentication
- [ ] Set up firewall rules
- [ ] Enable helmet security headers
- [ ] Use environment variables for secrets

## 📈 Performance Optimization

### PM2 Cluster Mode
```bash
# Start with multiple instances
pm2 start ecosystem.config.js --env production
```

### Database Optimization
- Create indexes for frequently queried fields
- Use connection pooling
- Monitor slow queries

### Caching
- Implement Redis for session storage
- Cache frequently accessed data
- Use compression middleware

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

#### MongoDB Connection Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod
```

#### PM2 Issues
```bash
# Reset PM2
pm2 kill
pm2 start ecosystem.config.js

# Clear logs
pm2 flush
```

## 📝 Logs

### Application Logs
```bash
# View application logs
tail -f logs/app.log

# View PM2 logs
pm2 logs parking-zone-backend
```

### Error Logs
```bash
# View error logs
tail -f logs/err.log
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run deploy:prod
```

## 📞 Support

For deployment issues:
1. Check logs: `npm run pm2:logs`
2. Verify environment variables
3. Test database connection
4. Check firewall settings
5. Contact support team

## 🔗 Useful Commands

```bash
# Development
npm run dev

# Production
npm run deploy:prod

# Testing
npm test

# Linting
npm run lint

# Clean install
npm run clean:install

# Docker
npm run docker:deploy

# PM2
npm run pm2:start
npm run pm2:restart
npm run pm2:stop
``` 