import { env } from "@/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Email is a provider like any other; swap "console" for a real transport later. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

const consoleProvider: EmailProvider = {
  async send({ to, subject, text }) {
    console.info(`\n[email] → ${to}\n[email] ${subject}\n${text}\n`);
  },
};

export function getEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "console":
      return consoleProvider;
  }
}
