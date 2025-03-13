const sendErrorResponce = (res) => (statusCode, message, errors) =>
  res.status(statusCode).json({
    message,
    errors,
    code: statusCode,
  });

export default sendErrorResponce;
