import {requireWorkspacePage} from '@/lib/page-access';
import {profilePath} from '@/lib/navigation';
export default async function Page({params}){const {id}=await params;await requireWorkspacePage({page:'Employees',profileId:id,path:profilePath(id)});return null}
