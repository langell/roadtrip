import { redirect } from 'next/navigation';

// The discover feed is now the home page.
export default function DiscoverRedirect() {
  redirect('/');
}
