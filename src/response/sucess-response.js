const sendErrorResponce = (res) => (statusCode, data) =>
  res.status(statusCode).json({
    data,
  });

export default sendErrorResponce;
