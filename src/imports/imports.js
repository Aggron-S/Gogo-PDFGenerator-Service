const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");
const TEMP_DIR = path.join(__dirname, "..", "..", "temp");

// Zoho Creator
const ZOHO_CREATOR_UPLOAD_URL = process.env.ZOHO_CREATOR_UPLOAD_URL;
const ZOHO_CREATOR_DOWNLOAD_URL = process.env.ZOHO_CREATOR_DOWNLOAD_URL;

// Dropbox
const DROPBOX_UPLOAD_URL = process.env.DROPBOX_UPLOAD_URL;

module.exports = {
  fs,
  path,
  https,
  axios,
  TEMP_DIR,
  ZOHO_CREATOR_UPLOAD_URL,
  ZOHO_CREATOR_DOWNLOAD_URL,
  DROPBOX_UPLOAD_URL,
};
