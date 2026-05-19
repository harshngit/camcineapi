/**
 * Translates PostgreSQL database errors into user-friendly messages.
 * 
 * @param {Error} err - The error object from the database driver (pg).
 * @returns {Object} - An object containing a user-friendly message and appropriate status code.
 */
const handleDbError = (err) => {
  // PostgreSQL error code 23505 is for unique_violation
  if (err.code === '23505') {
    const detail = err.detail || '';
    
    // Example detail: Key (phone_number)=(1234567890) already exists.
    const match = detail.match(/Key \((.*?)\)=\((.*?)\) already exists/);
    
    if (match) {
      const field = match[1].replace(/_/g, ' ');
      const value = match[2];
      return {
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists.`,
        statusCode: 409 // Conflict
      };
    }
    
    return {
      message: 'A record with this information already exists.',
      statusCode: 409
    };
  }

  // PostgreSQL error code 23503 is for foreign_key_violation
  if (err.code === '23503') {
    return {
      message: 'This operation violates a relationship constraint.',
      statusCode: 400
    };
  }

  // PostgreSQL error code 23502 is for not_null_violation
  if (err.code === '23502') {
    const field = err.column || 'a required field';
    return {
      message: `${field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')} is required.`,
      statusCode: 400
    };
  }

  // PostgreSQL error code 23514 is for check_violation
  if (err.code === '23514') {
    return {
      message: 'One or more fields contain values outside the allowed range.',
      statusCode: 400
    };
  }

  // PostgreSQL error code 22P02 is for invalid_text_representation (e.g., invalid UUID or integer)
  if (err.code === '22P02') {
    return {
      message: 'Invalid data format provided for one or more fields.',
      statusCode: 400
    };
  }

  // Default error
  return {
    message: 'A database error occurred.',
    statusCode: 500
  };
};

module.exports = { handleDbError };
