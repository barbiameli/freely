import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/signin",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;
        // Google-only accounts have no passwordHash — credentials sign-in
        // must not fall through to bcrypt.compare(..., null).
        if (!user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // Only registered when GOOGLE_CLIENT_ID/SECRET are set — the app works
    // fine without Google configured, this provider just doesn't appear.
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const email = user.email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        // Link by email — an existing Credentials (or previously-Google)
        // account can sign in with Google without a separate merge step.
        user.id = existing.id;
        return true;
      }

      // No account with this email yet — signup is open, so just create one
      // (mirrors signUpAction's credentials-based flow).
      const created = await prisma.user.create({
        data: { email, passwordHash: null, name: user.name || null },
      });
      user.id = created.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = (user as { id: string }).id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
        // Re-fetch name/studioName fresh from the DB each time, rather than
        // trusting whatever was true at login — so Account settings edits
        // show up immediately without needing to sign out and back in.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, studioName: true, email: true },
        });
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.studioName = dbUser.studioName;
          session.user.email = dbUser.email;
          // Whether this account may see the product's own dashboard. On the
          // session rather than passed down as a prop, because Topbar is
          // rendered from fourteen places and threading a boolean through all
          // of them to show one menu item is not a trade worth making. The
          // page checks again on the server: this only decides whether a link
          // is drawn.
          (session.user as { isAdmin?: boolean }).isAdmin = isAdminEmail(dbUser.email);
        }
      }
      return session;
    },
  },
};
