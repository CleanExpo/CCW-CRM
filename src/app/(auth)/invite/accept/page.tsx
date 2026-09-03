import { Suspense } from 'react';
import { AcceptInviteForm } from './accept-invite-form';

function AcceptInviteFallback() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-6">
      <div className="border-primary/40 border-t-primary h-8 w-8 animate-spin rounded-full border-2" />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteFallback />}>
      <AcceptInviteForm />
    </Suspense>
  );
}
