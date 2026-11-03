import restricted from '../../clinical-content/src/restricted-drugs.json' with {type:'json'};
// Browser-safe: no Node imports, so the prescription form can check as the doctor types.
const norm=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,' ');
/** Pure: which items name a restricted drug (word match on the medicine name). */
export function restrictedItems(items:{medicine:string}[]){
 return items.flatMap((item,index)=>{const words=` ${norm(item.medicine)} `;const hit=restricted.categories.find(c=>c.names.some(n=>words.includes(` ${n} `)||words.includes(` ${n}s `)));return hit?[{index,medicine:item.medicine,category:hit.label}]:[];});
}
export const restrictedList=restricted;
