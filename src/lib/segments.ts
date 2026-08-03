export type SegmentRule = {
  field: "outlet" | "region" | "tags";
  op: "in" | "contains";
  value: string[] | string;
};

export type JournalistLike = {
  outlet: string | null;
  region: string | null;
  tags: string[] | null;
};

export function matchesRules(journalist: JournalistLike, rules: SegmentRule[]): boolean {
  if (!rules || rules.length === 0) return true;
  return rules.every((rule) => {
    if (rule.field === "tags") {
      const tags = (journalist.tags ?? []).map((t) => t.toLowerCase().trim());
      const wanted = Array.isArray(rule.value) ? rule.value : [rule.value];
      return wanted.some((tag) => tags.includes(tag.toLowerCase().trim()));
    }
    const current = journalist[rule.field];
    if (!current) return false;
    const wanted = Array.isArray(rule.value) ? rule.value : [rule.value];
    return wanted.some((item) => item.toLowerCase() === current.toLowerCase());
  });
}

export function describeRules(rules: SegmentRule[]): string {
  const labels: Record<SegmentRule["field"], string> = {
    outlet: "Veículo",
    region: "Região",
    tags: "Etiqueta",
  };
  if (!rules || rules.length === 0) return "Toda a base com opt-in";
  return rules
    .map((rule) => {
      const values = Array.isArray(rule.value) ? rule.value.join(", ") : rule.value;
      return `${labels[rule.field]}: ${values}`;
    })
    .join(" · ");
}

export function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}
