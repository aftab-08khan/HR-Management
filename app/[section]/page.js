import {notFound} from 'next/navigation';
import {pageForSection} from '@/lib/navigation';
import {requireWorkspacePage} from '@/lib/page-access';
export default async function Page({params}){const {section}=await params;const page=pageForSection(section);if(!page&&section!=='profile')notFound();await requireWorkspacePage({page:section==='profile'?'Overview':page,path:`/${section}`});return null}
