/** One consistent 18 px line-icon set for the sidebar, so every item aligns whatever the font. */
const paths:Record<string,string>={
  queue:'M4 6h16M4 12h16M4 18h10',
  plus:'M12 5v14M5 12h14',
  search:'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16.5 16.5 20 20',
  hospital:'M4 20V8l8-4 8 4v12M9 20v-5h6v5M12 8v4M10 10h4',
  report:'M6 3h9l3 3v15H6zM9 12h6M9 16h6M9 8h3',
  play:'M8 5l11 7-11 7z',
  external:'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
};
export default function Icon({name,size=18}:{name:keyof typeof paths|string;size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name==='play'?'currentColor':'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
