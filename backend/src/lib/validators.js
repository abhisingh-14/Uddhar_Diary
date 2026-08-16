const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  validateUserIdField,
};
