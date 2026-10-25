import NextAuth from 'next-auth';
import {authOptions} from '@/lib/auth';
const createAuth=typeof NextAuth==='function'?NextAuth:NextAuth.default;
const handler=createAuth(authOptions);export {handler as GET,handler as POST};
