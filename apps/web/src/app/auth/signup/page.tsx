import { redirect } from 'next/navigation';

/** @deprecated Use `/auth?mode=signup` — kept for bookmarks and old links. */
export default function SignUpRedirectPage() {
  redirect('/auth?mode=signup');
}
