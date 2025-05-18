require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Configuration
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN; // Replace with your Pabbly domain
const ZOHO_TOKEN_URL = process.env.ZOHO_TOKEN_URL;
// const ZOHO_REVOKE_URL = process.env.ZOHO_REVOKE_URL;
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
    // Allow requests with no Origin (like same-origin or non-browser tools)
    if (!origin) return callback(null, true);  // 👈 Add this line
    
    if (origin === ALLOWED_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(limiter);

function getClientInfo(req) {
  const clientIP = req.ip;
  const userAgent = req.headers['user-agent'];
  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

  console.log('Client IP:', clientIP);
  console.log('User-Agent:', userAgent);
  console.log('Full URL Requested:', fullUrl);
}

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
    console.log(ZOHO_TOKEN_URL)
    console.error('Token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh token');
  }
}

// // Token revoke function (not yet working properly)
// async function revokeAccessToken() {
//   if (!tokenStore.accessToken) return;
  
//   try {
//     await axios.post(ZOHO_REVOKE_URL, new URLSearchParams({
//       token: tokenStore.accessToken
//     }));
    
//     console.log('Successfully revoked access token');
//   } catch (error) {
//     console.error('Revocation failed:', error.response?.data || error.message);
//   }
// }

// Token endpoint
app.get('/api/token', async (req, res) => {
  try {
    // Get some Client Info
    getClientInfo(req);
    
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

// Add this right before app.listen()
// let server;

// const shutdown = async () => {
//   console.log('Shutting down gracefully...');
//   await revokeAccessToken();
//   server?.close();
//   process.exit(0);
// };

// process.on('SIGTERM', shutdown);
// process.on('SIGINT', shutdown);

app.listen(PORT, () => {
  console.log(`Token service running on port ${PORT}`);
});