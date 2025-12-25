const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Access token required',
      code: 'NO_TOKEN'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
        error: err.message
      });
    }

    try {
      const user = await User.findById(decoded.userId).select('isActive isBanned bannedUntil banReason role isVerified');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found', code: 'NO_USER' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Account deactivated', code: 'ACCOUNT_DEACTIVATED' });
      }
      if (user.isBanned) {
        return res.status(403).json({ success: false, message: 'Account banned', code: 'ACCOUNT_BANNED', until: user.bannedUntil, reason: user.banReason });
      }
      req.userId = decoded.userId;
      req.user = { ...decoded, role: user.role, isVerified: user.isVerified };
      next();
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Auth check failed', code: 'AUTH_ERROR' });
    }
  });
};

module.exports = authenticateToken;