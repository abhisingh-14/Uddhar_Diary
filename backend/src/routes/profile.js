const express = require('express');

const { supabase } = require('../lib/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return res.status(502).json({ error: 'Failed to fetch profile' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json({
      profile: {
        id: data.id,
        fullName: data.full_name,
        email: data.email,
      },
    });
  } catch (handlerError) {
    return next(handlerError);
  }
});

router.patch('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    // Read ONLY fullName from the body and ignore every other field
    let { fullName } = req.body;

    if (typeof fullName !== 'string') {
      return res.status(400).json({ error: 'fullName must be a string' });
    }

    fullName = fullName.trim();

    if (fullName.length < 1 || fullName.length > 60) {
      return res.status(400).json({ error: 'fullName must be between 1 and 60 characters after trimming' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', userId)
      .select('id, full_name, email')
      .maybeSingle();

    if (error) {
      console.error('Failed to update profile:', error);
      return res.status(502).json({ error: 'Failed to update profile' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json({
      profile: {
        id: data.id,
        fullName: data.full_name,
        email: data.email,
      },
    });
  } catch (handlerError) {
    return next(handlerError);
  }
});

module.exports = router;
