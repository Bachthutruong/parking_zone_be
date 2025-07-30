# Deployment Guide for Parking Zone Backend

## Render Deployment

### 1. Environment Variables Setup

Make sure to set these environment variables in your Render dashboard:

```bash
# Required
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/your-database
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=production
PORT=10000

# Optional
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@parkingzone.com
ADMIN_PASSWORD=admin123
```

### 2. Build & Start Commands

In your Render service settings:

- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 3. Health Check

The application provides health check endpoints:

- **Root Health Check**: `GET /`
- **API Health Check**: `GET /api/health`

### 4. Troubleshooting

#### Common Issues:

1. **SIGTERM Error**: The server now handles graceful shutdown properly
2. **MongoDB Connection**: Ensure MONGODB_URI is correctly set
3. **Port Issues**: Render automatically sets PORT environment variable

#### Debug Commands:

```bash
# Check if server is running
curl https://your-app.onrender.com/api/health

# Check logs in Render dashboard
# Go to your service > Logs tab
```

### 5. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server locally
npm run start:prod

# Start with safe mode (with environment checks)
npm run start:safe
```

### 6. Docker Deployment

If using Docker:

```bash
# Build image
docker build -t parking-zone-backend .

# Run container
docker run -p 5002:5002 -e MONGODB_URI=your-uri parking-zone-backend
```

### 7. PM2 Deployment

For production servers with PM2:

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# View logs
pm2 logs
```

## API Endpoints

### Health Checks
- `GET /` - Root health check
- `GET /api/health` - Detailed health check

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Parking Management
- `GET /api/parking/types` - Get parking types
- `GET /api/parking/lots` - Get parking lots
- `POST /api/parking/lots` - Create parking lot

### Booking Management
- `GET /api/bookings` - Get bookings
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking

### Admin Functions
- `GET /api/admin/users` - Get all users
- `GET /api/admin/bookings` - Get all bookings
- `POST /api/admin/maintenance` - Create maintenance day

## Monitoring

The application includes:

1. **Graceful Shutdown**: Handles SIGTERM/SIGINT properly
2. **Error Logging**: Comprehensive error handling
3. **Health Checks**: Multiple health check endpoints
4. **Process Monitoring**: PM2 integration for production

## Security

- CORS configured for cross-origin requests
- Helmet.js for security headers
- Rate limiting (optional)
- JWT authentication
- Input validation with express-validator 