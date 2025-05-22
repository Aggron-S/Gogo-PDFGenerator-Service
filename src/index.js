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
const DROPBOX_TOKEN_URL = process.env.DROPBOX_TOKEN_URL;
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
  zoho: {
    accessToken: null,
    expiresAt: 0,
    refreshToken: process.env.ZOHO_REFRESH_TOKEN
  },
  dropbox: {
    accessToken: null,
    expiresAt: 0,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN
  }
};

// ===== Zoho Creator ===== //
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
      refresh_token: tokenStore.zoho.refreshToken,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    }));

    tokenStore.zoho = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
      refreshToken: tokenStore.zoho.refreshToken
    };

    return tokenStore.zoho.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh token');
  }
}

// Get valid access token (checks expiration and refreshes if needed)
async function getValidToken() {
  if (tokenStore.zoho.accessToken && Date.now() < tokenStore.zoho.expiresAt - 60000) {
    return tokenStore.zoho.accessToken;
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



// ===== Dropbox ===== //
async function refreshDropboxToken() {
  try {
    const response = await axios.post(DROPBOX_TOKEN_URL, new URLSearchParams({
      refresh_token: tokenStore.dropbox.refreshToken,
      grant_type: 'refresh_token',
      client_id: process.env.DROPBOX_CLIENT_ID,
      client_secret: process.env.DROPBOX_CLIENT_SECRET
    }));

    tokenStore.dropbox.accessToken = response.data.access_token;
    tokenStore.dropbox.expiresAt = Date.now() + (response.data.expires_in * 1000);
    
    return tokenStore.dropbox.accessToken;
  } catch (error) {
    console.error('Dropbox token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh Dropbox token');
  }
}

async function getValidDropboxToken() {
  if (tokenStore.dropbox.accessToken && Date.now() < tokenStore.dropbox.expiresAt - 60000) {
    return tokenStore.dropbox.accessToken;
  }
  return await refreshDropboxToken();
}

async function uploadToDropbox(fileBuffer, fileName, fileSize) {
  try {
    console.log(`Preparing to upload ${fileName} (${fileSize} bytes) to Dropbox`);
    
    // Validate inputs
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File buffer is empty');
    }
    if (!fileName) {
      throw new Error('Filename is required');
    }

    // Get valid token
    const accessToken = await getValidDropboxToken();
    const dropboxPath = `/uploads/${fileName}`;

    console.log(`Uploading to Dropbox path: ${dropboxPath}`);
    
    const response = await axios.post(
      'https://content.dropboxapi.com/2/files/upload',
      fileBuffer,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: dropboxPath,
            mode: 'add',
            autorename: true,
            mute: false
          }),
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileSize
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log('Dropbox upload successful');
    return {
      path: dropboxPath,
      // result: response.data
    };
  } catch (error) {
    console.error('Dropbox upload failed:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    throw error; // Re-throw for route handler to catch
  }
}



// Zoho Creator File Upload Endpoint
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


// Dropbox File Upload Endpoint
// ===== Dropbox Upload Endpoint ===== //
app.post('/upload-to-dropbox', async (req, res) => {
  let tempFilePath;
  
  try {
    // 1. Extract parameters
    const { 
      recordId, 
      fieldLinkName, 
      reportLinkName, 
      owner, 
      appLinkName,
      helper_surname,
      helper_givenName,
      doc_type
    } = req.body;
    
    // 2. Validate all required parameters
    if (
      !recordId || 
      !fieldLinkName || 
      !reportLinkName || 
      !owner || 
      !appLinkName ||
      !helper_surname ||
      !helper_givenName ||
      !doc_type
    ) {
      return res.status(400).json({
        error: 'MISSING_PARAMETERS',
        message: 'All parameters (recordId, fieldLinkName, reportLinkName, owner, appLinkName) are required'
      });
    }

    // 3. Generate download URL
    const downloadUrl = `https://www.zohoapis.com/creator/v2.1/data/${owner}/${appLinkName}/report/${reportLinkName}/${recordId}/${fieldLinkName}/download`;
    
    // 4. Create temp directory if needed
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    tempFilePath = path.join(tempDir, `zoho-file-${Date.now()}.pdf`);

    // 5. Get valid Zoho token
    const zohoToken = await getValidToken(); // Reuses your existing token management
    
    // 6. Download file from Zoho Creator
    console.log(`Downloading file from zoho creator...`);
    const response = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream',
      headers: {
        'Authorization': `Zoho-oauthtoken ${zohoToken}`
      }
    });

    // 7. Save to temp file
    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 8. Verify downloaded file
    const stats = fs.statSync(tempFilePath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    // 9. Verify it's a PDF (first 4 bytes should be '%PDF')
    const fileBuffer = fs.readFileSync(tempFilePath);
    if (fileBuffer.slice(0, 4).toString() !== '%PDF') {
      throw new Error('Downloaded file is not a valid PDF');
    }

    // 10. Upload to Dropbox
    console.log('Uploading to Dropbox...');
    const fileName = `${helper_surname}, ${helper_givenName}-${doc_type}.pdf`;
    const uploadResult = await uploadToDropbox(
      fileBuffer,
      fileName,
      stats.size
    );

    // 11. Clean up
    fs.unlinkSync(tempFilePath);

    return res.json({
      success: true,
      message: "File uploaded to Dropbox successfully",
      dropboxPath: uploadResult.path,
      // fileSize: stats.size,
      // zohoSource: downloadUrl
    });

  } catch (error) {
    // Clean up temp file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    console.error('File processing error:', error.message);
    return res.status(500).json({
      error: 'PROCESSING_ERROR',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack
      })
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