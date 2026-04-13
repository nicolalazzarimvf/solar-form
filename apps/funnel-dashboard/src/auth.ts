import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const MVF_DOMAIN = '@mvfglobal.com';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = (user?.email ?? '').toLowerCase();
      return email.endsWith(MVF_DOMAIN);
    },
  },
  pages: {
    signIn: '/login',
  },
});
