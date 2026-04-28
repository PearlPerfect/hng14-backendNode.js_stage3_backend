module.exports = function errorHandler(err, req, res, next) {
  const status  = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${message}`);
  res.status(status).json({ status: 'error', message });
};