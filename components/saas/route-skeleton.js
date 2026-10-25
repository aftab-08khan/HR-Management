'use client';
import {usePathname} from 'next/navigation';
import {PageSkeleton} from './dashboard-skeleton';
import {pageForSection} from '@/lib/navigation';
export function RouteSkeleton(){const pathname=usePathname()||'/';const parts=pathname.split('/').filter(Boolean);const page=parts[0]==='employees'&&parts[1]?'Employee profile':parts[0]==='records'?'Record details':pageForSection(parts[0])||'Overview';return <PageSkeleton page={page} fullPage/>}
