export const feedbackTypes = [
  "General feedback",
  "Bug report",
  "Feature idea",
] as const;

export type FeedbackType = (typeof feedbackTypes)[number];

export type FeedbackSubmission = {
  type: FeedbackType;
  message: string;
  contactEmail?: string;
};

export type FeedbackContext = {
  userId?: string;
  displayName?: string;
  timestamp: string;
};

export const maxFeedbackMessageLength = 5000;

export function isFeedbackType(value: string): value is FeedbackType {
  return feedbackTypes.includes(value as FeedbackType);
}

export function validateFeedbackSubmission(
  value: Partial<FeedbackSubmission>
): FeedbackSubmission {
  const type = typeof value.type === "string" ? value.type : "";
  const message = typeof value.message === "string" ? value.message.trim() : "";
  const contactEmail =
    typeof value.contactEmail === "string" ? value.contactEmail.trim() : "";

  if (!isFeedbackType(type)) {
    throw new Error("Choose a feedback type.");
  }

  if (!message) {
    throw new Error("Add a message before sending feedback.");
  }

  if (message.length > maxFeedbackMessageLength) {
    throw new Error("Keep feedback under 5000 characters.");
  }

  return {
    type,
    message,
    ...(contactEmail ? { contactEmail } : {}),
  };
}

export function formatFeedbackEmailText(
  submission: FeedbackSubmission,
  context: FeedbackContext
) {
  return [
    `Type: ${submission.type}`,
    `Submitted: ${context.timestamp}`,
    `User ID: ${context.userId ?? "Unknown"}`,
    `Display name: ${context.displayName ?? "Unknown"}`,
    `Contact email: ${submission.contactEmail ?? "Not provided"}`,
    "",
    "Message:",
    submission.message,
  ].join("\n");
}
