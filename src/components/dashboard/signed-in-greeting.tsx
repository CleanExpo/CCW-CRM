'use client';

import { authApi } from '@/lib/api/auth';
import { useEffect, useState } from 'react';

export function SignedInGreeting() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    void authApi.getCurrentUser().then((user) => {
      setName(user?.full_name?.trim() || user?.email || null);
    });
  }, []);

  return (
    <>
      Operations hub
      {name ? (
        <>
          {' for '}
          <span
            data-testid="signed-in-name"
            className="bg-gradient-to-r from-sky-200 via-white to-indigo-200 bg-clip-text text-transparent"
          >
            {name}
          </span>
        </>
      ) : null}
    </>
  );
}
