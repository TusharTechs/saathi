import { z } from 'zod';
import { inputSchema, fieldsSchema, contextSchema, type Input } from '../../shared/src/index.ts';
import { adultProtocol } from '../../clinical-content/src/index.ts';

type Scalar = string | number | boolean;
type Condition = { all: Condition[] } | { any: Condition[] } |
  { field: string; op: '==' | '<=' | '>=' | 'in'; value: Scalar | Scalar[] } |
  { difference: { left: string; right: string; gte: number } };
const validPaths = new Set([...Object.keys(fieldsSchema.shape), ...Object.keys(contextSchema.shape).filter(k => k !== 'pack').map(k => `context.${k}`)]);
const pathSchema = z.string().refine(p => validPaths.has(p), 'Unknown fact path');
const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const conditionSchema: z.ZodType<Condition> = z.lazy(() => z.union([
  z.object({all:z.array(conditionSchema).min(1)}).strict(),
  z.object({any:z.array(conditionSchema).min(1)}).strict(),
  z.object({field:pathSchema, op:z.enum(['==','<=','>=','in']), value:z.union([scalarSchema,z.array(scalarSchema)])}).strict(),
  z.object({difference:z.object({left:pathSchema,right:pathSchema,gte:z.number()}).strict()}).strict(),
]));
const protocol = z.object({
  version:z.string(), status:z.literal('demo_only'), approved_by:z.null(), approved_at:z.null(), source:z.string(),
  rules:z.array(z.object({id:z.string(),tier:z.enum(['RED','AMBER']),label:z.string(),
    source_status:z.enum(['accepted_pending_review','confirmed_in_handoff','draft']),
    approved_by:z.null(),approved_at:z.null(),when:conditionSchema}).strict()),
}).strict().parse(adultProtocol);

type Truth = true | false | 'unknown';
export type Evidence = { path: string; value: unknown; confidence?: number; quote?: string; messageId?: string };
export type Trace = { condition: Condition; outcome: Truth; evidence: Evidence[] };
const CONFIDENCE_THRESHOLD = 0.8; // Engineering demo setting, not clinically validated.

/** Pure, local demo evaluator. This protocol has no signed production approval. */
export type Evaluation = {
  protocolVersion: string; mode: 'demo_only'; tier: 'RED' | 'AMBER' | 'GREEN' | null;
  status: 'unsupported_pack' | 'needs_followup' | 'complete'; matched: string[];
  unknownRuleIds: string[]; followupFields: string[]; reason?: string;
  traces: (Trace & {ruleId:string; tier:'RED'|'AMBER'; label:string; sourceStatus:string})[];
};
export function evaluate(raw: unknown): Evaluation {
  const input = inputSchema.parse(raw);
  const pendingFields = new Set<string>();
  const read = (path: string): Evidence => {
    if (path.startsWith('context.')) {
      const key = path.slice(8) as keyof Input['context'];
      return {path, value:input.context[key] ?? null};
    }
    const field = input.fields[path as keyof Input['fields']];
    return {path, value:field?.value ?? null, ...(field ? {confidence:field.confidence,quote:field.quote,messageId:field.messageId} : {})};
  };
  const compare = (node: Condition): Trace => {
    if ('all' in node || 'any' in node) {
      const children = ('all' in node ? node.all : node.any).map(compare);
      const outcomes = children.map(c => c.outcome);
      const outcome = 'all' in node
        ? outcomes.includes(false) ? false : outcomes.includes('unknown') ? 'unknown' : true
        : outcomes.includes(true) ? true : outcomes.includes('unknown') ? 'unknown' : false;
      return {condition:node,outcome,evidence:children.flatMap(c => c.evidence)};
    }
    const evidence = 'difference' in node ? [read(node.difference.left),read(node.difference.right)] : [read(node.field)];
    if (evidence.some(e => e.value === null)) {
      evidence.filter(e => e.value === null).forEach(e => pendingFields.add(e.path));
      return {condition:node,outcome:'unknown',evidence};
    }
    let outcome: Truth;
    if ('difference' in node) {
      const [left,right] = evidence;
      outcome = typeof left?.value === 'number' && typeof right?.value === 'number'
        ? left.value-right.value >= node.difference.gte : 'unknown';
    } else {
      const actual = evidence[0]!.value;
      if (node.op === '==') outcome = actual === node.value;
      else if (node.op === 'in') outcome = Array.isArray(node.value) && node.value.includes(actual as Scalar);
      else outcome = typeof actual === 'number' && typeof node.value === 'number'
        ? node.op === '<=' ? actual <= node.value : actual >= node.value : 'unknown';
    }
    // Positive low-confidence reports can raise alerts; uncertain negatives cannot clear them.
    const uncertain = evidence.filter(e => e.confidence !== undefined && e.confidence < CONFIDENCE_THRESHOLD);
    uncertain.forEach(e => pendingFields.add(e.path));
    if (uncertain.length && outcome === false) outcome = 'unknown';
    return {condition:node,outcome,evidence};
  };
  if (input.context.pack !== 'adult') return {
    protocolVersion:protocol.version, mode:'demo_only' as const, tier:null,
    status:'unsupported_pack', matched:[], unknownRuleIds:[], followupFields:[], traces:[],
    reason:'Paediatric protocol awaits age-specific review; adult rules were not evaluated.',
  };
  const traces = protocol.rules.filter(r => r.source_status !== 'draft').map(rule => ({
    ruleId:rule.id, tier:rule.tier, label:rule.label, sourceStatus:rule.source_status, ...compare(rule.when),
  }));
  const matched = traces.filter(t => t.outcome === true);
  const unknownRuleIds = traces.filter(t => t.outcome === 'unknown').map(t => t.ruleId);
  const needsFollowup = unknownRuleIds.length > 0 || pendingFields.size > 0;
  const tier = matched.some(r => r.tier === 'RED') ? 'RED' : matched.some(r => r.tier === 'AMBER') ? 'AMBER' : needsFollowup ? null : 'GREEN';
  return {
    protocolVersion:protocol.version, mode:'demo_only' as const, tier,
    status:needsFollowup ? 'needs_followup' : 'complete',
    matched:matched.map(r => r.ruleId), unknownRuleIds, followupFields:[...pendingFields].sort(), traces,
  };
}
