import { redirect } from 'next/navigation';

/** Sign-in lives on the unified `/auth` screen. */
export default function SignInRedirectPage() {
  redirect('/auth?mode=signin');
}
