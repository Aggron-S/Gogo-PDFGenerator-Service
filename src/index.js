require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Configuration
const ALLOWED_ORIGIN = 'https://your-pabbly-connect-domain.com'; // Replace with your Pabbly domain
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const PORT = process.env.PORT || 3000;

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (origin === ALLOWED_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(limiter);

// Token storage (use Redis in production)
let tokenStore = {
  accessToken: null,
  expiresAt: 0,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN
};

// Token refresh function
async function refreshZohoToken() {
  try {
    const response = await axios.post(ZOHO_TOKEN_URL, new URLSearchParams({
      refresh_token: tokenStore.refreshToken,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    }));

    tokenStore = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
      refreshToken: tokenStore.refreshToken // Refresh token remains the same
    };

    return tokenStore.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh token');
  }
}

// Token endpoint
app.get('/api/token', async (req, res) => {
  try {
    // Return cached token if still valid
    if (tokenStore.accessToken && Date.now() < tokenStore.expiresAt - 60000) {
      return res.json({
        access_token: tokenStore.accessToken,
        expires_in: Math.floor((tokenStore.expiresAt - Date.now()) / 1000)
      });
    }

    // Refresh token if expired
    const newToken = await refreshZohoToken();
    res.json({
      access_token: newToken,
      expires_in: Math.floor((tokenStore.expiresAt - Date.now()) / 1000)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Token refresh failed',
      details: error.message
    });
  }
});

// Health check
app.get('/ping', (req, res) => {
  res.status(204).end();
});

// Error handling
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Token service running on port ${PORT}`);
});