const errorMiddleware = (err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS policy violation" });
  }
  res.status(500).json({ error: "Internal server error" });
}
module.exports = errorMiddleware;