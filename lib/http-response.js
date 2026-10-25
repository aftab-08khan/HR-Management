export function privateJson(body,init={}){
  const headers=new Headers(init.headers);
  headers.set('Cache-Control','private, no-store');
  const vary=headers.get('Vary');
  if(!vary?.split(',').some(value=>value.trim().toLowerCase()==='cookie'))headers.set('Vary',vary?`${vary}, Cookie`:'Cookie');
  return Response.json(body,{...init,headers});
}

export class RequestBodyError extends Error{
  constructor(message,status){super(message);this.status=status;}
}

export async function readJsonBody(req,limit=64000){
  if(Number(req.headers.get('content-length'))>limit)throw new RequestBodyError('Request is too large',413);
  if(!req.body)throw new RequestBodyError('Invalid JSON record',400);
  const reader=req.body.getReader();const chunks=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new RequestBodyError('Request is too large',413);}chunks.push(Buffer.from(value));}
  }finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new RequestBodyError('Invalid JSON record',400);}
}
