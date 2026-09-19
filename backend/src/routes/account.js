const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/requireAuth');
const { supabase } = require('../lib/supabaseClient');
const { createVerifierClient } = require('../lib/supabaseVerifier');

const router = express.Router();

// Apply authentication middleware first
router.use(requireAuth);

// Rate limiter for failed password change attempts
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 failed attempts per window
  skipSuccessfulRequests: true, // only count failed requests
  keyGenerator: (req) => req.userId, // rate limit by user ID
  message: {
    error: 'Too many failed password change attempts. Please try again later.',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(passwordChangeLimiter);

/**
 * POST /api/account/change-password
 * 
 * Changes the user's password after verifying the current password.
 * 
 * Security considerations:
 * - Current password is re-verified to prevent unauthorized changes if someone
 *   gains access to a valid session token (e.g., via XSS or token theft)
 * - A fresh anon-key verifier client is used for password verification to follow
 *   Supabase's intended authentication flow (signInWithPassword) rather than
 *   using admin privileges which bypass normal auth security checks
 * - admin.updateUserById is used for the actual password change as it requires
 *   service-role privileges and is the only secure way to update a user's password
 * - Wrong password returns 400 (not 401) because the user is already authenticated
 *   via requireAuth - this is a validation error, not an authentication failure
 * - Rate limiter comes after requireAuth so we can key by req.userId
 */
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Step 1: Validate input
    if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({
        error: 'Both currentPassword and newPassword are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({
        error: 'New password must be between 8 and 72 characters',
        code: 'WEAK_PASSWORD'
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        error: 'New password must be different from current password',
        code: 'SAME_PASSWORD'
      });
    }

    // Step 2: Get user's email via service-role client
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(req.userId);
    
    if (userError || !userData || !userData.user || !userData.user.email) {
      return res.status(502).json({
        error: 'Failed to retrieve user information'
      });
    }

    const email = userData.user.email;

    // Step 3: Verify current password using anon-key verifier client
    let verifierClient;
    try {
      verifierClient = createVerifierClient();
    } catch (err) {
      return res.status(500).json({
        error: 'Server configuration error'
      });
    }

    const { error: signInError } = await verifierClient.auth.signInWithPassword({
      email,
      password: currentPassword
    });

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        return res.status(400).json({
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }
      return res.status(502).json({
        error: 'Failed to verify current password'
      });
    }

    // Step 4: Set new password using service-role client
    const { error: updateError } = await supabase.auth.admin.updateUserById(req.userId, {
      password: newPassword
    });

    if (updateError) {
      return res.status(502).json({
        error: 'Failed to update password'
      });
    }

    // Step 5: Optional hardening - sign out other devices
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      try {
        // Check if signOut method is available in the admin API
        if (supabase.auth.admin.signOut) {
          await supabase.auth.admin.signOut(token, 'others');
        }
      } catch (err) {
        // Silently ignore signOut failure - it's optional hardening
      }
    }

    // Step 6: Success
    res.json({ success: true });

  } catch (err) {
    // Generic error response without exposing details
    res.status(502).json({
      error: 'Failed to change password'
    });
  }
});

module.exports = router;
