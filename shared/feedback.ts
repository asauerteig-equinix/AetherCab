export const invalidFeedbackEmailMessage = "Please enter a valid email address.";

export function isAllowedFeedbackEmail(email: string): boolean {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return false;
  }

  const match = trimmedEmail.match(/^[^\s@]+@([^\s@]+)$/);
  if (!match) {
    return false;
  }

  const domain = match[1].toLowerCase();
  return domain === "eu.equinix.com" || domain === "equinix.com";
}
