# ⚡ Campus Crate - Quick Reference

## 🚀 Start Server

```powershell
# Development (single process)
npm run dev

# Production (with clustering)
$env:NODE_ENV="production"; npm start

# Custom worker count
$env:WEB_CONCURRENCY="8"; $env:NODE_ENV="production"; npm start
```

## 📊 Monitoring

| Endpoint | Description |
|----------|-------------|
| `/health` | System health & metrics |
| `/api/metrics` | Detailed metrics (admin only) |

## 🎯 Performance Targets

| Metric | Target |
|--------|--------|
| Concurrent Users | 2000+ |
| Response Time | < 200ms |
| Success Rate | > 99% |
| Cache Hit Rate | > 60% |

## 🔧 Key Configuration

### Database Connection Pool
- **Max:** 100 connections
- **Min:** 10 connections
- **File:** `config/database.js`

### Rate Limits
- **General API:** 100/15min
- **Auth:** 20/15min
- **Upload:** 30/hour
- **Read:** 60/min
- **Write:** 30/min
- **File:** `middleware/rateLimit.js`

### Cache Settings
- **TTL:** 5 minutes (default)
- **Max Keys:** 10,000
- **Type:** In-memory (node-cache)
- **File:** `config/cache.js`

### Workers
- **Default:** 4 workers
- **Max:** Number of CPU cores
- **Env Var:** `WEB_CONCURRENCY`

## 📁 Important Files

```
config/
├── database.js       # DB connection pooling
└── cache.js          # Caching configuration

middleware/
├── rateLimit.js      # Rate limiting rules
├── cache.js          # Caching middleware
└── performanceMonitor.js  # Metrics collection

utils/
└── dbIndexes.js      # Index creation
```

## 🛠️ Common Tasks

### Create Database Indexes
```powershell
npm run create:indexes
```

### View Metrics
```powershell
curl http://localhost:5000/health
```

### Load Test
```powershell
ab -n 2000 -c 100 http://localhost:5000/api/items
```

### Check Logs
```powershell
# Watch server logs
npm run dev

# Check for slow requests (> 1s)
# Logs appear as: "⚠️ Slow request: GET /api/items - 1234ms"
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| High memory | Reduce cache maxKeys or pool size |
| Slow queries | Check indexes with `/health` |
| Workers crashing | Reduce WEB_CONCURRENCY |
| Cache not working | Check `/health` for hit rate |

## 📈 Expected Metrics

### Good Performance
```
✅ Average Response Time: 50-150ms
✅ Success Rate: 99%+
✅ Cache Hit Rate: 60-80%
✅ Memory Usage: < 70%
```

### Needs Attention
```
⚠️ Average Response Time: 200-500ms
⚠️ Success Rate: 95-99%
⚠️ Cache Hit Rate: 40-60%
⚠️ Memory Usage: 70-85%
```

### Critical
```
❌ Average Response Time: > 500ms
❌ Success Rate: < 95%
❌ Cache Hit Rate: < 40%
❌ Memory Usage: > 85%
```

## 🔄 Restart Process

```powershell
# Kill all node processes (if stuck)
Stop-Process -Name "node" -Force

# Restart in production
$env:NODE_ENV="production"; npm start
```

## 📚 Documentation

- **[UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md)** - Setup instructions
- **[SCALABILITY.md](./SCALABILITY.md)** - Detailed documentation
- **[package.json](./package.json)** - Available scripts

## 💡 Tips

1. **Always run** `npm run setup:scalability` after pulling changes
2. **Monitor** `/health` endpoint regularly
3. **Test** with load testing before production
4. **Use** `NODE_ENV=production` for clustering
5. **Keep** WEB_CONCURRENCY ≤ CPU cores
6. **Create** database indexes in production
7. **Enable** compression for all responses
8. **Cache** frequently accessed data
9. **Log** slow requests (> 1s)
10. **Set up** automated monitoring alerts
