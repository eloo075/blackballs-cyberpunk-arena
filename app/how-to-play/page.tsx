import { redirect } from 'next/navigation';

/** Legacy URL — shareable guide lives at /guide */
export default function HowToPlayRedirect() {
  redirect('/guide');
}
