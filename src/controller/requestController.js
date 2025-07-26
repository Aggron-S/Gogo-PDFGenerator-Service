const { fs, path, axios, TEMP_DIR, ZOHO_CREATOR_DOWNLOAD_URL} = require("../imports/imports");
const getValidToken = require("../services/auth/zohoAuth");
const uploadToDropbox = require("../services/dropboxUpload/uploadToDropbox");
const { uploadToZohoCreator, downloadFile } = require("../services/zohoCreatorUpload/uploadToZohoCreator");

module.exports = {
  getHealth: async (req, res, next) => {
    res.status(204).end();    // Health check
  },

  postZohoCreatorUpload: async (req, res, next) => {
    try {
      const {
        canva_design_export_url,
        owner,
        appLinkName,
        reportLinkName,
        record_id,
        field_link_name,
        helper_surname,
        helper_givenName,
        doc_type,
      } = req.body;
  
      if (
        !canva_design_export_url ||
        !owner ||
        !appLinkName ||
        !reportLinkName ||
        !record_id ||
        !field_link_name ||
        !helper_surname ||
        !helper_givenName ||
        !doc_type
      ) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
  
      // Create temp directory if it doesn't exist (if temp directory is deleted)
      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
      
      // Generate temp file path
      const tempFilePath = path.join(TEMP_DIR, `canva-export-${Date.now()}.pdf`);
  
      try {
        // Step 1: Download the Canva file
        console.log("Downloading file from Canva...");
        await downloadFile(canva_design_export_url, tempFilePath);
  
        // Step 2: Upload to Zoho Creator
        console.log("Uploading to Zoho Creator...");
        const uploadResult = await uploadToZohoCreator(
          tempFilePath,
          owner,
          appLinkName,
          reportLinkName,
          record_id,
          field_link_name,
          helper_surname,
          helper_givenName,
          doc_type
        );
  
        // Step 3: Clean up temp file
        fs.unlink(tempFilePath, err => {
          if (err) console.error("Error deleting temp file:", err);
          else console.log("Temp file deleted:", tempFilePath);
        });
  
        return res.json({
          success: true,
          message: "File uploaded successfully",
          result: uploadResult,
        });
      } catch (error) {
        // Clean up temp file if it exists
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
  
        console.error("Upload process failed:", error.message);
        return res.status(500).json({
          error: "File processing failed",
          details: error.message,
        });
      }
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  },

  postDropboxUpload: async (req, res, next) => {
    let tempFilePath;

    try {
      // 1. Extract parameters
      const {
        recordId,
        fieldLinkName,
        owner,
        appLinkName,
        reportLinkName,
        helper_surname,
        helper_givenName,
        doc_type,
      } = req.body;

      // 2. Validate all required parameters
      if (
        !recordId ||
        !fieldLinkName ||
        !owner ||
        !appLinkName ||
        !reportLinkName ||
        !helper_surname ||
        !helper_givenName ||
        !doc_type
      ) {
        return res.status(400).json({
          error: "MISSING_PARAMETERS",
          message:
            "All parameters (recordId, fieldLinkName, reportLinkName, owner, appLinkName) are required",
        });
      }

      // 3. Generate download URL
      const downloadUrl = `${ZOHO_CREATOR_DOWNLOAD_URL}/${owner}/${appLinkName}/report/${reportLinkName}/${recordId}/${fieldLinkName}/download`;

      // 4. Create temp directory if needed
      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
      tempFilePath = path.join(TEMP_DIR, `zoho-file-${Date.now()}.pdf`);

      // 5. Get valid Zoho token
      const zohoToken = await getValidToken(); // Reuses existing token management

      // 6. Download file from Zoho Creator
      console.log(`Downloading file from zoho creator...`);
      const response = await axios({
        method: "get",
        url: downloadUrl,
        responseType: "stream",
        headers: {
          Authorization: `Zoho-oauthtoken ${zohoToken}`,
        },
      });

      // 7. Save to temp file
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // 8. Verify downloaded file
      const stats = fs.statSync(tempFilePath);
      if (stats.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // 9. Verify it's a PDF (first 4 bytes should be '%PDF')
      const fileBuffer = fs.readFileSync(tempFilePath);
      if (fileBuffer.slice(0, 4).toString() !== "%PDF") {
        throw new Error("Downloaded file is not a valid PDF");
      }

      // 10. Upload to Dropbox
      console.log("Uploading to Dropbox...");
      const fileName = `${helper_surname},${helper_givenName}-${doc_type}.pdf`;
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

      console.error("File processing error:", error.message);
      return res.status(500).json({
        error: "PROCESSING_ERROR",
        message: error.message,
        ...(process.env.NODE_ENV === "development" && {
          stack: error.stack,
        }),
      });
    }
  }
}