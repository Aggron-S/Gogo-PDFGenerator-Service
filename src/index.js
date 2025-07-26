require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const { TEMP_DIR } = require("./imports/imports");

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

// System
const PORT = process.env.PORT || 3000;

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // ayusin logic ng CORS if may time
    if (origin === ALLOWED_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(limiter);

// Route
const requestRoute = require("./routes/requestRoute");
app.use("/", requestRoute);

// Error Handler
const errorMiddleware = require("./error/errorMiddleware"); 
app.use(errorMiddleware);


app.listen(PORT, () => {
  console.log(`File upload service running on port ${PORT}`);
});
