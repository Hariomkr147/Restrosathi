import { prisma } from "./db";


export async function reportError(error: Error | string, where: string) {
  try {
    const message = typeof error === "string" ? error : error.message || String(error);
    
    // Scrub phone numbers (7+ digits) and emails
    let scrubbedMessage = message
      .replace(/\d{7,}/g, "[REDACTED_PHONE]")
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
      
    const truncatedMessage = scrubbedMessage.length > 300 
      ? scrubbedMessage.substring(0, 300) + "..." 
      : scrubbedMessage;

    const name = error instanceof Error ? error.name : "Error";
    const data = new TextEncoder().encode(name + truncatedMessage);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const digest = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    await prisma.errorLog.create({
      data: {
        where,
        message: truncatedMessage,
        digest,
      }
    });
  } catch (e) {
    // Fail silently so reporting doesn't break the app
    console.error("Failed to report error:", e);
  }
}
