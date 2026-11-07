import { NextResponse, type NextRequest } from 'next/server';
// Optimistic page routing by role. Every API route still verifies the signed session itself.
const home:Record<string,string>={medical:'/',coordinator:'/coordinator',family:'/c'};
const allowed:Record<string,RegExp>={medical:/^\/(?!c(\/|$))/,coordinator:/^\/(coordinator|login|terms)(\/|$)/,family:/^\/(c|login|terms)(\/|$)/};
export function proxy(request:NextRequest){
  const path=request.nextUrl.pathname,raw=request.cookies.get('saathi_session')?.value;
  let role:string|undefined;try{role=raw?JSON.parse(Buffer.from(raw.split('.')[0]!,'base64url').toString('utf8')).role:undefined;}catch{role=undefined;}
  // Sign-in and the service terms are readable before signing in.
  // The clinical review form and its results page check their own private link tokens.
  if(path==='/login'||path==='/terms'||path==='/review'||path.startsWith('/review/'))return NextResponse.next();
  if(!role||!home[role])return NextResponse.redirect(new URL('/login',request.url));
  if(!allowed[role]!.test(path))return NextResponse.redirect(new URL(home[role]!,request.url));
  return NextResponse.next();
}
export const config={matcher:['/((?!api|_next|favicon.ico).*)']};
