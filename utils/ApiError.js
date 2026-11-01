class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.isApiError = true;
  }
}
module.exports = ApiError;
