class ApiError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
    this.isApiError = true;
  }
}
module.exports = ApiError;
