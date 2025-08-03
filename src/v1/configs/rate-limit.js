const rateLimit = {
  windowMs: 1 * 60 * 1000, // 1 minute(s)
  limit: 100,
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: "Too many requests. try again later",
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      code: options.statusCode,
      message: options.message,
    });
  },
};

export default rateLimit;
