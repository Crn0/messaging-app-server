import { httpStatus } from "../../constants/index.js";

const success = (message) => ({ message, success: true });
const forbidden = (message) => ({
  message,
  success: false,
  code: httpStatus.FORBIDDEN,
});
const notFound = (message) => ({
  message,
  success: false,
  code: httpStatus.NOT_FOUND,
});
const conflict = (message, type) => ({
  message,
  type,
  success: false,
  code: httpStatus.CONFLICT,
});

export { success, forbidden, notFound, conflict };
