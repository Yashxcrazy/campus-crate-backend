# Render Deployment Configuration

## Build Command
```bash
npm install
```

## Start Command
```bash
npm start
```

## Environment Variables

Add these in your Render Dashboard (Settings → Environment):

### Required Variables
```
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret_here

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

### Optional But Recommended for High Scalability
```
# Redis for caching (add Render Redis service)
REDIS_URL=redis://your-redis-url

# CORS - Add your Vercel frontend URL
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app-preview.vercel.app

# Worker Configuration
WEB_CONCURRENCY=4

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Render Service Configuration

### 1. Create New Web Service
- Connect your GitHub repository
- Select branch: `main` or `master`
- Root directory: Leave blank (or specify if backend is in subfolder)

### 2. Service Settings
- **Name**: campus-crate-backend
- **Region**: Choose closest to your users
- **Branch**: main
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Starter (for testing) or Standard (for production)

### 3. Add MongoDB Atlas Database
1. Go to MongoDB Atlas (mongodb.com)
2. Create a cluster (M0 free tier or higher)
3. In Network Access: Add `0.0.0.0/0` (allow from anywhere)
4. Get connection string and add as `MONGODB_URI` in Render

### 4. Add Redis (Optional but Recommended)
1. In Render Dashboard, create new Redis service
2. Copy the "Internal Redis URL"
3. Add as `REDIS_URL` environment variable in your web service

### 5. Auto-Deploy
- Enable "Auto-Deploy" in Render settings
- Every push to main branch will trigger deployment

## Scaling Configuration on Render

### Free/Starter Plan
- **Concurrency**: The app uses Node.js clustering (4 workers by default)
- **Connections**: Handles ~500 concurrent users
- **Limitations**: Spins down after 15 min of inactivity

### Standard Plan ($7/month)
- **Instances**: 1 instance always running
- **Concurrency**: 4 worker processes
- **Connections**: Handles ~1000-1500 concurrent users
- **No spin-down**

### Standard Plus ($15/month) - Recommended for 2000+ Users
- **Instances**: 2+ instances with load balancing
- **Concurrency**: 4 workers per instance = 8+ total workers
- **Connections**: Handles 2000+ concurrent users
- **Auto-scaling**: Can scale instances automatically

### Pro Plan ($25+/month)
- **Instances**: Multiple with auto-scaling
- **Best for**: 5000+ concurrent users

## How to Scale to 2000 Concurrent Users

### Option 1: Standard Plus with 2 Instances (Recommended)
```
Cost: ~$30/month
Setup:
1. Upgrade to Standard Plus
2. Horizontal scaling → Set min instances: 2, max instances: 3
3. Add Redis service ($7/month)
4. MongoDB Atlas M10+ ($57/month) or higher

Total: ~$100/month for reliable 2000+ user support
```

### Option 2: Multiple Standard Instances
```
Cost: ~$50/month + database
Setup:
1. Create 2-3 Standard web services
2. Use Render's built-in load balancer
3. All point to same MongoDB and Redis
```

## Monitoring and Optimization

### Built-in Metrics Endpoint
The app includes a `/metrics` endpoint:
```
GET https://your-app.onrender.com/metrics
```

Returns:
- Request count
- Average response time
- Active connections
- Memory usage
- Uptime

### Render Metrics
- Go to your service → Metrics tab
- Monitor:
  - CPU usage (should be < 80%)
  - Memory usage (should be < 90%)
  - Response time (should be < 500ms)

### Alerts
Set up alerts in Render:
1. Service Settings → Notifications
2. Add alerts for:
   - High CPU usage (> 80%)
   - High memory (> 90%)
   - Failed health checks

## Health Checks

The app includes health check endpoint:
```
GET https://your-app.onrender.com/health
```

Configure in Render:
1. Service Settings → Health Check Path: `/health`
2. Health check endpoint will prevent unhealthy instances from receiving traffic

## Performance Tips

### 1. Use Render Redis
- Significantly improves response time
- Reduces database load
- Only $7/month

### 2. Database Optimization
- Use MongoDB Atlas M10 or higher for production
- Enable connection pooling (already configured)
- Create proper indexes (run: `npm run create:indexes`)

### 3. Enable Compression
- Already enabled in the app
- Reduces bandwidth by 60-80%

### 4. CDN for Static Assets
- Use Cloudinary for images (already configured)
- Frontend on Vercel already has CDN

### 5. Monitor and Scale
- Check metrics regularly
- Scale up before hitting limits
- Use auto-scaling for traffic spikes

## Connecting Frontend (Vercel)

### Update Frontend Environment Variables
In your Vercel project settings:
```
VITE_API_URL=https://your-app.onrender.com
# or for production:
REACT_APP_API_URL=https://your-app.onrender.com
```

### Update CORS in Backend
Already configured to accept Vercel domains. To add more:
```
ALLOWED_ORIGINS=https://your-main-app.vercel.app,https://your-preview.vercel.app
```

## Testing the Deployment

### 1. Test Health Check
```bash
curl https://your-app.onrender.com/health
```

### 2. Test API Endpoint
```bash
curl https://your-app.onrender.com/api/items
```

### 3. Load Testing
```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 https://your-app.onrender.com/api/items
```

## Troubleshooting

### Service Won't Start
- Check logs in Render dashboard
- Verify all environment variables are set
- Check MongoDB connection string

### High Response Times
- Add Redis if not using
- Upgrade MongoDB plan
- Increase Render instances

### CORS Errors
- Add your Vercel URL to `ALLOWED_ORIGINS`
- Check URL has no trailing slash
- Verify frontend is making requests to correct backend URL

### Memory Issues
- Upgrade to higher plan
- Check for memory leaks in code
- Increase WEB_CONCURRENCY if needed (but not too high)

## Cost Breakdown for 2000 Users

### Recommended Setup
```
Render Standard Plus (2 instances): $30/month
Render Redis: $7/month
MongoDB Atlas M10: $57/month
Cloudinary Free/Pro: $0-25/month
Vercel Pro (frontend): $20/month

Total: ~$115-140/month
```

### Budget Setup (handles ~1500 users)
```
Render Standard: $7/month
MongoDB Atlas M0 (Free): $0
Cloudinary Free: $0
Vercel Hobby (frontend): $0

Total: ~$7/month
```

## Support

For issues:
1. Check Render logs: Service → Logs tab
2. Check application metrics: `/metrics` endpoint
3. Review MongoDB Atlas logs
4. Check Redis connection status
