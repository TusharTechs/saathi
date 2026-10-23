import type { Metadata } from 'next';
import './styles.css';
export const metadata:Metadata={title:'Saathi · Care team workspace',description:'Synthetic local demonstration of home palliative care reporting and care-team follow-up.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
