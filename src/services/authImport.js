// Token storage
module.exports = {
  tokenStore: {
    zoho: {
      accessToken: null,
      expiresAt: 0,
      refreshToken: process.env.ZOHO_REFRESH_TOKEN,
    },
    dropbox: {
      accessToken: null,
      expiresAt: 0,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    },
  }
}