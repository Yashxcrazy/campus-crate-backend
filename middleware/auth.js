const jwt = require('jsonwebtoken');

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

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
        error: err.message
      });
    }
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  });
};

module.exports = authenticateToken;