import { redirect } from 'next/navigation';

/** Legacy route — consolidated under Integrations → Setup guide. */
export default function OnboardingWizardRedirectPage() {
  redirect('/settings/integrations?tab=setup');
}
