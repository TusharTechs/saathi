import { service, RIDER } from '../../../../packages/workflow/src/service-config';
export const metadata={title:'Saathi · Service terms and consent (draft)'};
const hours=(m:number)=>m>=120?`${m/60} hours`:`${m} minutes`;
/**
 * Service agreement shown before a family signs in. It is a draft: Dr. Rao is asking a lawyer about the wording,
 * so nothing here is presented as approved.
 */
export default function Terms(){
  const f=service.fees;
  return <main className="terms">
    <a className="brand" href="/login"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a>
    <p className="terms-draft">DRAFT prepared for the demo · it needs review by the institution’s legal team before it can be adopted in practice · synthetic data only</p>
    <h1>Service terms and consent</h1>
    <p className="terms-rider"><b>Saathi is not an emergency service.</b> {RIDER}</p>
    <h2>1. What Saathi is</h2>
    <p>Saathi is a care continuity service from your palliative care team for patients at home. You tell us what is worrying you, by WhatsApp or on this website, in your own words or as a voice note. The care team then calls you back. Saathi helps the team keep in touch with the patient between hospital visits and keeps a record of every contact.</p>
    <h2>2. What Saathi does not do</h2>
    <ul>
      <li>It does not diagnose, prescribe, or decide treatment. Only a doctor, nurse or psychologist from the care team gives advice, on a call.</li>
      <li>A computer program writes down and translates what you send. It does not judge how serious it is. Fixed rules written by the care team sort messages so the most urgent are called first.</li>
      <li>Teleconsultation is only suitable for patients who are stable. If the rules find a possible emergency, you will receive a message asking you to go to the nearest hospital, and the on-call doctor is told at once.</li>
      <li>By law (Telemedicine Practice Guidelines 2020), narcotic medicines such as morphine and fentanyl, other Schedule X and psychotropic medicines, and anti-cancer medicines cannot be prescribed by teleconsultation. Refills of these are collected from your registered hospital.</li>
    </ul>
    <h2>3. When we call back</h2>
    <p>Target call-back times: urgent concerns within {hours(service.callbackMinutes.RED!)} at any hour, with advice to seek urgent care at once; other concerns within {hours(service.callbackMinutes.AMBER!)} of working time ({service.dutyHours.label}) or on the next working day. These are targets, not guarantees.</p>
    <h2>4. Fees</h2>
    <p>{f.enabled?`Some organisations charge for a call-back, for example ₹${f.audioCall} for a consultation and half that for a follow-up within ${f.followUpWithinDays} days. The organisation tells you the fee before the call. Free and NGO services do not charge. This demonstration collects no payment.`:'This service does not charge for call-backs.'}</p>
    <h2>5. Your information</h2>
    <ul>
      <li>We keep the patient’s details, your messages and the care team’s call notes, so the team has the full history. Medical records are kept for at least 3 years, as the Telemedicine Practice Guidelines require.</li>
      <li>Your information is used only for the patient’s care and, without names, for audit and research approved by an ethics committee. It is handled under India’s Digital Personal Data Protection Act, 2023.</li>
      <li>Voice notes are turned into text and the audio is not kept.</li>
      <li>You can stop at any time by sending <b>/stop</b> on WhatsApp or telling the care team, and you can ask for your data to be deleted. See the <a href="https://tushartechs.github.io/saathi-privacy/" target="_blank" rel="noreferrer">privacy policy</a> and the <a href="https://tushartechs.github.io/saathi-privacy/data-deletion.html" target="_blank" rel="noreferrer">data deletion page</a>.</li>
    </ul>
    <h2>6. Consent</h2>
    <p>In the real service, consent is taken at the hospital outpatient clinic with a printed leaflet, and only consenting patients are registered. Signing in here confirms that you have read these terms and that you will go to the nearest hospital or call 108 in an emergency.</p>
    <p className="muted">This demonstration contains only invented (synthetic) patients. Do not enter real patient information.</p>
  </main>;
}
