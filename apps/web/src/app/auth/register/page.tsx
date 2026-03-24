import { redirect } from 'next/navigation';

/** Registration uses the unified `/auth` screen. */
export default function RegisterRedirectPage() {
  redirect('/auth?mode=signup');
}
