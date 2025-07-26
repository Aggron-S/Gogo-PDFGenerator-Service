const { axios } = require("../../imports/imports");
const { tokenStore } = require("../authImport");

// Dropbox
const DROPBOX_TOKEN_URL = process.env.DROPBOX_TOKEN_URL;

// Token refresh function
async function refreshDropboxToken() {
  try {
    const response = await axios.post(
      DROPBOX_TOKEN_URL,
      new URLSearchParams({
        refresh_token: tokenStore.dropbox.refreshToken,
        grant_type: "refresh_token",
        client_id: process.env.DROPBOX_CLIENT_ID,
        client_secret: process.env.DROPBOX_CLIENT_SECRET,
      })
    );

    tokenStore.dropbox.accessToken = response.data.access_token;
    tokenStore.dropbox.expiresAt = Date.now() + response.data.expires_in * 1000;

    return tokenStore.dropbox.accessToken;
  } catch (error) {
    console.error(
      "Dropbox token refresh failed:",
      error.response?.data || error.message
    );
    throw new Error("Failed to refresh Dropbox token");
  }
}

async function getValidDropboxToken() {
  if (
    tokenStore.dropbox.accessToken &&
    Date.now() < tokenStore.dropbox.expiresAt - 60000
  ) {
    return tokenStore.dropbox.accessToken;
  }
  return await refreshDropboxToken();
}

module.exports = getValidDropboxToken;