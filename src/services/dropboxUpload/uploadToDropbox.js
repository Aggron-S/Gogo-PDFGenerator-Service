const { axios, DROPBOX_UPLOAD_URL } = require("../../imports/imports");
const getValidDropboxToken = require("../auth/dropboxAuth");

// Upload to Dropbox
async function uploadToDropbox(fileBuffer, fileName, fileSize) {
  try {
    console.log(
      `Preparing to upload ${fileName} (${fileSize} bytes) to Dropbox`
    );

    // Validate inputs
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("File buffer is empty");
    }
    if (!fileName) {
      throw new Error("Filename is required");
    }

    // Get valid token
    const accessToken = await getValidDropboxToken();
    const baseName = fileName.substring(0, fileName.lastIndexOf('-'));    // unique directory for files
    const dropboxPath = `/uploads/${baseName}/${fileName}`;

    console.log(`Uploading to Dropbox path: ${dropboxPath}`);

    const response = await axios.post(`${DROPBOX_UPLOAD_URL}`, fileBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: "add",
          autorename: true,
          mute: false,
        }),
        "Content-Type": "application/octet-stream",
        "Content-Length": fileSize,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log("Dropbox upload successful");
    return {
      path: dropboxPath,
      // result: response.data
    };
  } catch (error) {
    console.error("Dropbox upload failed:", {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    throw error; // Re-throw for route handler to catch
  }
}

module.exports = uploadToDropbox;
