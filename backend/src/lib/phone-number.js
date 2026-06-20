import { AppError } from './errors.js';

export function normalizeMobileNumber(value) {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  if (international.startsWith('+') && !/^\+[1-9]\d{6,14}$/.test(international)) {
    throw new AppError(400, 'invalid_mobile_number', 'Enter the mobile number in international format, for example +966536547919');
  }
  if (!international.startsWith('+') && !/^\d{6,15}$/.test(international)) {
    throw new AppError(400, 'invalid_mobile_number', 'Enter a valid mobile number');
  }
  return international;
}
