const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return emailRegex.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function validateFullName(fullName) {
  return typeof fullName === "string" && fullName.trim().length >= 2;
}

module.exports = { validateEmail, validatePassword, validateFullName };
