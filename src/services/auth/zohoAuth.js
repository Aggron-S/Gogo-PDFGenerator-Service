const { axios } = require("../../imports/imports");
const { tokenStore } = require("../authImport");

// Zoho Creator
const ZOHO_TOKEN_URL = process.env.ZOHO_TOKEN_URL;

// Token refresh function
async function refreshZohoToken() {
  try {
    const response = await axios.post(
      ZOHO_TOKEN_URL,
      new URLSearchParams({
        refresh_token: tokenStore.zoho.refreshToken,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token",
      })
    );

    tokenStore.zoho = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
      refreshToken: tokenStore.zoho.refreshToken,
    };

    return tokenStore.zoho.accessToken;
  } catch (error) {
    console.error(
      "Token refresh failed:",
      error.response?.data || error.message
    );
    throw new Error("Failed to refresh token");
  }
}

// Get valid access token (checks expiration and refreshes if needed)
async function getValidToken() {
  if (
    tokenStore.zoho.accessToken &&
    Date.now() < tokenStore.zoho.expiresAt - 60000
  ) {
    return tokenStore.zoho.accessToken;
  }
  return await refreshZohoToken();
}

module.exports = getValidToken;