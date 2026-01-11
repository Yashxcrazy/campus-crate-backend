const os = require('os');
const mongoose = require('mongoose');

/**
 * Performance monitoring middleware
 */
class PerformanceMonitor {
  constructor() {
    this.requestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
    
    this.systemMetrics = {
      startTime: Date.now(),
      cpuUsage: [],
      memoryUsage: []
    };
    
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }
  
  collectSystemMetrics() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    this.systemMetrics.cpuUsage.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    this.systemMetrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });
    
    // Keep only last 100 data points
    if (this.systemMetrics.cpuUsage.length > 100) {
      this.systemMetrics.cpuUsage.shift();
    }
    if (this.systemMetrics.memoryUsage.length > 100) {
      this.systemMetrics.memoryUsage.shift();
    }
  }
  
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Capture response
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Update metrics
        performanceMonitor.requestMetrics.totalRequests++;
        
        if (res.statusCode >= 200 && res.statusCode < 400) {
          performanceMonitor.requestMetrics.successfulRequests++;
        } else {
          performanceMonitor.requestMetrics.failedRequests++;
        }
        
        // Track response times (keep last 1000)
        performanceMonitor.requestMetrics.responseTimes.push(responseTime);
        if (performanceMonitor.requestMetrics.responseTimes.length > 1000) {
          performanceMonitor.requestMetrics.responseTimes.shift();
        }
        
        // Calculate average response time
        const sum = performanceMonitor.requestMetrics.responseTimes.reduce((a, b) => a + b, 0);
        performanceMonitor.requestMetrics.averageResponseTime = 
          sum / performanceMonitor.requestMetrics.responseTimes.length;
        
        // Log slow requests (> 1 second)
        if (responseTime > 1000) {
          console.warn(`⚠️ Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
        }
        
        // Add response time header
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
  
  getMetrics() {
    const uptime = Date.now() - this.systemMetrics.startTime;
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      server: {
        uptime: Math.floor(uptime / 1000), // seconds
        process: process.pid,
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch()
      },
      requests: {
        total: this.requestMetrics.totalRequests,
        successful: this.requestMetrics.successfulRequests,
        failed: this.requestMetrics.failedRequests,
        successRate: this.requestMetrics.totalRequests > 0 
          ? (this.requestMetrics.successfulRequests / this.requestMetrics.totalRequests * 100).toFixed(2) + '%'
          : '0%',
        averageResponseTime: Math.round(this.requestMetrics.averageResponseTime) + 'ms',
        requestsPerSecond: this.requestMetrics.totalRequests > 0
          ? (this.requestMetrics.totalRequests / (uptime / 1000)).toFixed(2)
          : '0'
      },
      system: {
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0].model,
          usage: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          loadAverage: os.loadavg()
        },
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
          free: Math.round(os.freemem() / 1024 / 1024) + 'MB',
          used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024) + 'MB',
          usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%',
          process: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
            external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
          }
        }
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        collections: Object.keys(mongoose.connection.collections).length
      }
    };
  }
  
  cleanup() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}

const performanceMonitor = new PerformanceMonitor();

// Cleanup on process exit
process.on('SIGTERM', () => {
  performanceMonitor.cleanup();
});

process.on('SIGINT', () => {
  performanceMonitor.cleanup();
});

module.exports = performanceMonitor;
