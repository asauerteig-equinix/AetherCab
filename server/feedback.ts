import { hostname } from "node:os";
import { Socket } from "node:net";
import type { FeedbackInput } from "../shared/types.js";

const smtpHost = "10.201.140.91";
const smtpPort = 25;
const feedbackFromAddress = "feedback-aethercad@eu.equinix.com";
const feedbackToAddress = "andreas.sauerteig@eu.equinix.com";
const smtpTimeoutMs = 10000;

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function dotStuff(value: string): string {
  return value
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

async function readResponse(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    function cleanup() {
      socket.off("data", handleData);
      socket.off("error", handleError);
      socket.off("close", handleClose);
      socket.off("timeout", handleTimeout);
    }

    function handleError(error: Error) {
      cleanup();
      reject(error);
    }

    function handleClose() {
      cleanup();
      reject(new Error("SMTP connection closed unexpectedly."));
    }

    function handleTimeout() {
      cleanup();
      reject(new Error("SMTP connection timed out."));
    }

    function handleData(chunk: Buffer | string) {
      buffer += chunk.toString();
      const lines = buffer.split("\r\n").filter(Boolean);
      if (lines.length === 0) {
        return;
      }

      const lastLine = lines[lines.length - 1];
      if (!/^\d{3} /.test(lastLine)) {
        return;
      }

      cleanup();
      resolve(lines.join("\n"));
    }

    socket.on("data", handleData);
    socket.on("error", handleError);
    socket.on("close", handleClose);
    socket.on("timeout", handleTimeout);
  });
}

async function sendCommand(socket: Socket, command: string, expectedCodes: number[]): Promise<void> {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));

  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP rejected command "${command}" with response ${response}`);
  }
}

export async function sendFeedbackEmail(input: FeedbackInput): Promise<void> {
  const userName = sanitizeHeaderValue(input.userName);
  const feedbackMessage = input.message.trim();

  if (!userName) {
    throw new Error("User name is required.");
  }

  if (!feedbackMessage) {
    throw new Error("Feedback message is required.");
  }

  const subject = sanitizeHeaderValue(`Feedback fuer Aether C.A.D von ${userName}`);
  const plainTextBody = [
    "Aether C.A.D feedback",
    "",
    `User: ${userName}`,
    input.auditName ? `Audit: ${input.auditName}` : null,
    input.contextPath ? `Context: ${input.contextPath}` : null,
    `Sent: ${new Date().toISOString()}`,
    "",
    feedbackMessage
  ]
    .filter(Boolean)
    .join("\r\n");

  const emailPayload = [
    `From: ${feedbackFromAddress}`,
    `To: ${feedbackToAddress}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(plainTextBody),
    "."
  ].join("\r\n");

  const socket = new Socket();
  socket.setTimeout(smtpTimeoutMs);

  await new Promise<void>((resolve, reject) => {
    function cleanup() {
      socket.off("connect", handleConnect);
      socket.off("error", handleError);
      socket.off("timeout", handleTimeout);
    }

    function handleConnect() {
      cleanup();
      resolve();
    }

    function handleError(error: Error) {
      cleanup();
      reject(error);
    }

    function handleTimeout() {
      cleanup();
      reject(new Error("SMTP connection timed out."));
    }

    socket.once("connect", handleConnect);
    socket.once("error", handleError);
    socket.once("timeout", handleTimeout);
    socket.connect(smtpPort, smtpHost);
  });

  try {
    const greeting = await readResponse(socket);
    if (!greeting.startsWith("220")) {
      throw new Error(`SMTP server rejected connection: ${greeting}`);
    }

    await sendCommand(socket, `HELO ${sanitizeHeaderValue(hostname() || "aethercad")}`, [250]);
    await sendCommand(socket, `MAIL FROM:<${feedbackFromAddress}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${feedbackToAddress}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    socket.write(`${emailPayload}\r\n`);

    const completion = await readResponse(socket);
    if (!completion.startsWith("250")) {
      throw new Error(`SMTP server rejected message body: ${completion}`);
    }

    await sendCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
    socket.destroy();
  }
}
