import { redirect } from 'next/navigation';

/** Legacy route — consolidated under Integrations → Setup guide. */
export default function OnboardingRedirectPage() {
  redirect('/settings/integrations?tab=setup');
}
