import {notFound} from 'next/navigation';
import {RESOURCE_PAGES} from '@/lib/navigation';
import {requireWorkspacePage} from '@/lib/page-access';
import {recordPath} from '@/lib/navigation';
export default async function Page({params}){const {resource,id}=await params;if(!Object.hasOwn(RESOURCE_PAGES,resource)||resource==='employees')notFound();await requireWorkspacePage({page:RESOURCE_PAGES[resource],resource,recordId:id,path:recordPath(resource,id)});return null}
