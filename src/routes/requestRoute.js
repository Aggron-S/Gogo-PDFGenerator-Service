const express = require("express");
const router = express.Router();

// Request Controller
const requestController = require("../controller/requestController");

router.get("/ping", requestController.getHealth);
router.post("/upload-file", requestController.postZohoCreatorUpload);    // Zoho Creator File Upload Endpoint
router.post("/upload-to-dropbox", requestController.postDropboxUpload);  // Dropbox File Upload Endpoint

module.exports = router;