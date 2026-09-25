const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Shared email format check. Used by the person email-update (PATCH) route and
// the person-create (POST) route so both enforce exactly the same rule.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ISO date pattern (YYYY-MM-DD)
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateUserIdField(userId) {
  if (typeof userId !== "string" || userId.trim() === "") {
    return { status: 400, body: { error: "userId is required" } };
  }
  const trimmedUserId = userId.trim();
  if (!UUID_PATTERN.test(trimmedUserId)) {
    return { status: 400, body: { error: "userId must be a valid UUID" } };
  }
  return { userId: trimmedUserId };
}

module.exports = {
  UUID_PATTERN,
  EMAIL_PATTERN,
  ISO_DATE_PATTERN,
  validateUserIdField,
};
