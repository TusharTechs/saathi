/** Draft substring safety net. Negation is recorded, never used to suppress a hit. */
const concepts = [
  {id:'unresponsive', en:['cannot wake','hard to wake','cannot be woken'], hi:['जग नहीं रहे','जगा नहीं पा'], kn:['ಎಚ್ಚರವಾಗುತ್ತಿಲ್ಲ']},
  {id:'sedation',en:['falling asleep while talking','falls asleep while talking'],hi:['बात करते करते सो जाते'],kn:['ಮಾತನಾಡುವಾಗ ನಿದ್ರೆ']},
  {id:'breathing',en:['not breathing','blue lips','long pauses'],hi:['सांस नहीं','होंठ नीले'],kn:['ಉಸಿರಾಡುತ್ತಿಲ್ಲ']},
  {id:'seizure',en:['seizure','convulsions'],hi:['दौरा'],kn:['ಸೆಳೆತ']},
  {id:'bleeding',en:['heavy bleeding','vomiting blood','black stools'],hi:['खून की उल्टी'],kn:['ರಕ್ತ ವಾಂತಿ']},
] as const;
export function scanSafetyNet(messages: {id:string;text:string}[]) {
  return messages.flatMap(message => concepts.flatMap(concept =>
    (['en','hi','kn'] as const).flatMap(language => concept[language].flatMap(phrase => {
      const normalized=message.text.normalize('NFKC').toLocaleLowerCase('en');
      const term=phrase.normalize('NFKC').toLocaleLowerCase('en');
      const index=normalized.indexOf(term);
      if(index<0) return [];
      if(language==='en' && (/[a-z]/i.test(normalized[index-1]??'') || /[a-z]/i.test(normalized[index+term.length]??''))) return [];
      const preceding=normalized.slice(Math.max(0,index-30),index);
      return [{id:concept.id,language,phrase,messageId:message.id,sourceText:message.text,
        possibleNegation:/\b(no|not|never|without)\b|नहीं|ಇಲ್ಲ/u.test(preceding),status:'draft' as const}];
    }))));
}
