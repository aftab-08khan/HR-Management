'use client';

import {usePathname} from 'next/navigation';
import {workspaceRoute} from '@/lib/navigation';

// Mount the App Router boundary so server redirects and errors always execute.
// Workspace UI lives in the persistent shell; route validation has no visible UI.
export function RouteOutlet({children}) {
  const route=workspaceRoute(usePathname());
  return <div hidden={!!route}>{children}</div>;
}
