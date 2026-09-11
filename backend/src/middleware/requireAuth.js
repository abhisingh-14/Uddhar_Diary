/**
 * Authentication Middleware
 * 
 * Why Authorization: Bearer <token>?
 * We use the HTTP `Authorization` header rather than a body or query parameter because 
 * it is the standard, secure mechanism for transmitting credentials. Sending tokens in 
 * query parameters risks exposing them in server logs or browser history, while placing 
 * them in the body mixes authentication metadata with business logic payloads.
 * 
 * Why is req.userId trustworthy?
 * We set `req.userId` here *only* after cryptographically verifying the token with 
 * Supabase (`supabase.auth.getUser(token)`). This ensures the user is genuinely who they 
 * claim to be. If we relied on `req.query.userId` or `req.body.userId`, a malicious 
 * client could easily spoof another user's ID to access or modify their data.
 */

const { supabase } = require('../lib/supabaseClient');

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or malformed Authorization header. Expected format: Bearer <token>'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data || !data.user) {
      return res.status(401).json({
        error: 'Invalid or expired token.'
      });
    }

    // Attach the verified user ID to the request object for downstream use
    req.userId = data.user.id;
    next();
  } catch (err) {
    console.error('Unexpected error in requireAuth middleware:', err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = { requireAuth };
