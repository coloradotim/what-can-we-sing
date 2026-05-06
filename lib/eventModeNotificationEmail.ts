export type EventModeMessageNotificationEmailInput = {
  eventName: string;
  senderDisplayName: string;
  eventUrl: string;
};

export function formatEventModeMessageNotificationEmail(
  input: EventModeMessageNotificationEmailInput
) {
  const senderName = input.senderDisplayName.trim() || "A singer";
  const eventName = input.eventName.trim() || "your Event Mode event";

  return [
    `${senderName} sent you a message for ${eventName}.`,
    "",
    "Open Event Mode to read and reply:",
    input.eventUrl,
    "",
    "To protect privacy, this email does not include the message text, sender email address, or sender phone number.",
  ].join("\n");
}
