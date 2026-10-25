// Public sample credentials. These accounts never authorize MongoDB workspace APIs.
export const DEMO_CREDENTIALS = [
  {role:'admin',email:'alex@peopleos.co',password:'PeopleOS@2026!'},
  {role:'hr',email:'lana@peopleos.co',password:'PeopleOS@2026!'},
  {role:'employee',email:'olivia@peopleos.co',password:'PeopleOS@2026!'},
];

export function demoCredentialRole(email,password){
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>128)return null;
  return DEMO_CREDENTIALS.find(account=>account.email===email.trim().toLowerCase()&&account.password===password)?.role||null;
}
