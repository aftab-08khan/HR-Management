export const PAGE_PATHS = {Overview:'/dashboard', Employees:'/employees', 'Time off':'/time-off', Recruitment:'/recruitment', Payroll:'/payroll', Compensation:'/compensation', Compliance:'/compliance', Performance:'/performance', Announcements:'/announcements', Settings:'/settings', Workspace:'/workspace'};
export const RESOURCE_PAGES = {employees:'Employees', requests:'Time off', jobs:'Recruitment', reviews:'Performance', announcements:'Announcements', compliance:'Compliance', compensation:'Compensation', memberships:'Workspace'};
export const RESOURCE_MODAL = {employees:'employee', requests:'request', jobs:'job', reviews:'review', announcements:'announcement', compliance:'compliance', compensation:'compensation', memberships:'membership'};
export const pageForSection = section => Object.entries(PAGE_PATHS).find(([,path])=>path === `/${section}`)?.[0];
export const profilePath = id => `/employees/${encodeURIComponent(id)}`;
export const recordPath = (resource,id) => `/records/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`;
export function workspaceRoute(pathname='/') {
  let parts;
  try {parts=pathname.split('/').filter(Boolean).map(decodeURIComponent);} catch {return null;}
  if(!parts.length)return {page:'Overview',path:'/'};
  if(parts.length===1&&parts[0]==='profile')return {page:'Overview',selfProfile:true,path:'/profile'};
  if(parts.length===1){const page=pageForSection(parts[0]);return page?{page,path:PAGE_PATHS[page]}:null;}
  if(parts.length===2&&parts[0]==='employees'&&parts[1])return {page:'Employees',profileId:parts[1],path:profilePath(parts[1])};
  if(parts.length===3&&parts[0]==='records'&&Object.hasOwn(RESOURCE_PAGES,parts[1])&&parts[1]!=='employees')return {page:RESOURCE_PAGES[parts[1]],resource:parts[1],recordId:parts[2],path:recordPath(parts[1],parts[2])};
  return null;
}
