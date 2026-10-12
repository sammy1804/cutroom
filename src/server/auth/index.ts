import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import type { Database } from "@/server/db/client";
import { schema } from "@/server/db/client";
import { ac, roles } from "@/lib/permissions";
import { getEmailProvider } from "./email";

interface AuthOptions {
  db: Database;
  secret: string;
  baseURL: string;
}

/** Factory so integration tests can build an auth instance against the test database. */
export function createAuth({ db, secret, baseURL }: AuthOptions) {
  return betterAuth({
    appName: "Cutroom",
    secret,
    baseURL,
    trustedOrigins: [baseURL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`, process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`].filter(
      (o): o is string => Boolean(o),
    ),
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: false }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        async sendInvitationEmail({ email, organization, inviter, id }) {
          const link = `${baseURL}/invite/${id}`;
          await getEmailProvider().send({
            to: email,
            subject: `${inviter.user.name} invited you to ${organization.name} on Cutroom`,
            text: `Accept the invitation: ${link}`,
          });
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
