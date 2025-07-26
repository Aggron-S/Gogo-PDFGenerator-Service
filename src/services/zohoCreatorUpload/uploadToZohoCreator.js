const { fs, https, ZOHO_CREATOR_UPLOAD_URL, axios } = require("../../imports/imports");
const FormData = require("form-data");
const getValidToken = require("../auth/zohoAuth");

// Upload file to Zoho Creator
async function uploadToZohoCreator(
  filePath,
  owner,
  appLinkName,
  reportLinkName,
  recordId,
  fieldLinkName,
  helper_surname,
  helper_givenName,
  doc_type
) {
  const accessToken = await getValidToken();

  const uploadUrl = `${ZOHO_CREATOR_UPLOAD_URL}/${owner}/${appLinkName}/report/${reportLinkName}/${recordId}/${fieldLinkName}/upload?skip_workflow=["schedules","form_workflow"]`;

  // Create form data with proper file attachment
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), {
    filename: `${helper_surname},${helper_givenName}-${doc_type}.pdf`,
    contentType: "application/pdf",
  });

  const response = await axios.post(uploadUrl, form, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ...form.getHeaders(), // This adds the proper multipart headers
    },
    maxContentLength: Infinity, // For larger files
    maxBodyLength: Infinity, // For larger files
  });

  return response.data;
}

// Helper function to download file from URL
async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https
      .get(url, response => {
        response.pipe(file);
        file.on("finish", () => {
          console.log(`File written to ${filePath}`);
          file.close(resolve);
        });
      })
      .on("error", err => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });
}

module.exports = { uploadToZohoCreator, downloadFile };