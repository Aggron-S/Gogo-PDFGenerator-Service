require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const https = require('https');
const FormData = require('form-data');


const app = express();

// Configuration
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const ZOHO_TOKEN_URL = process.env.ZOHO_TOKEN_URL;
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);     // ayuin logic ng CORS if may time
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

// Token storage
let tokenStore = {
  accessToken: null,
  expiresAt: 0,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN
};

// Helper function to download file from URL
async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        console.log(`File written to ${filePath}`);
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

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
      refreshToken: tokenStore.refreshToken
    };

    return tokenStore.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh token');
  }
}

// Get valid access token (checks expiration and refreshes if needed)
async function getValidToken() {
  if (tokenStore.accessToken && Date.now() < tokenStore.expiresAt - 60000) {
    return tokenStore.accessToken;
  }
  return await refreshZohoToken();
}

// Upload file to Zoho Creator
async function uploadToZohoCreator(filePath, recordId, fieldLinkName, helper_surname, helper_givenName, doc_type) {
  const accessToken = await getValidToken();
  
  const uploadUrl = `https://www.zohoapis.com/creator/v2.1/data/raolay25/my-first-creator-app/report/Sheet1_Report/${recordId}/${fieldLinkName}/upload?skip_workflow=["schedules","form_workflow"]`
  
  // Create form data with proper file attachment
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: `${helper_surname}, ${helper_givenName}-${doc_type}.pdf`,
    contentType: 'application/pdf'
  });

  const response = await axios.post(uploadUrl, form, {
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      ...form.getHeaders() // This adds the proper multipart headers
    },
    maxContentLength: Infinity, // For larger files
    maxBodyLength: Infinity    // For larger files
  });

  return response.data;
}

// File upload endpoint
app.post('/upload-file', async (req, res) => {
  try {
    const { canva_design_export_url, record_id, field_link_name, helper_surname, helper_givenName, doc_type } = req.body;
    
    if (!canva_design_export_url 
      || !record_id 
      || !field_link_name 
      || !helper_surname 
      || !helper_givenName 
      || !doc_type
    ) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Generate temp file path
    const tempFilePath = path.join(TEMP_DIR, `canva-export-${Date.now()}.pdf`);
    
    try {
      // Step 1: Download the Canva file
      console.log('Downloading file from Canva...');
      await downloadFile(canva_design_export_url, tempFilePath);

      // Step 2: Upload to Zoho Creator
      console.log('Uploading to Zoho Creator...');
      const uploadResult = await uploadToZohoCreator(
        tempFilePath, 
        record_id, 
        field_link_name, 
        helper_surname, 
        helper_givenName, 
        doc_type
      );

      // Step 3: Clean up temp file
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
        else console.log('Temp file deleted:', tempFilePath);
      });
      
      return res.json({
        success: true,
        message: 'File uploaded successfully',
        result: uploadResult
      });
    } catch (error) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      console.error('Upload process failed:', error);
      return res.status(500).json({ 
        error: 'File processing failed',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
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
  console.log(`File upload service running on port ${PORT}`);
});