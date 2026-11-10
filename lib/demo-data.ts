import { leadId, PLATFORMS, type Lead } from "./lead-utils";

// CSV fields can contain commas, escaped quotes and line breaks.
export function parseDemoCsv(csv: string): Lead[] {
  if (csv.charCodeAt(0) === 0xfeff) csv = csv.slice(1);
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i <= csv.length; i++) {
    const c = csv[i] ?? "\n";
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(field);
      field = "";
      if (c === "\n") {
        if (row.some(value => value !== "")) rows.push(row);
        row = [];
      }
    } else if (quoted || c !== "\r") field += c;
  }
  if (quoted) throw new Error("Unclosed quote in demo CSV");
  const [headers, ...records] = rows;
  return records.map(values => {
    const r = Object.fromEntries(headers.map((key, i) => [key, values[i] ?? ""]));
    return {
      id: leadId(r.Post),
      url: r.Post,
      platform: (Object.keys(PLATFORMS) as (keyof typeof PLATFORMS)[]).find(key => PLATFORMS[key] === r.Platform) ?? "other",
      author: r.Author,
      kind: r.Type as Lead["kind"],
      priority: r.Priority as Lead["priority"],
      status: r.Status as Lead["status"],
      foundAt: r.Found || null,
      followUp: r["Follow-up"] || null,
      why: r.Why,
      reply: r["Draft comment"],
      notes: r.Notes,
      excerpt: "",
      query: null,
      source: "csv",
      postedDate: null,
      statusAt: r["Status changed"] || null,
      repliedAt: r["Commented at"] || null,
    };
  });
}
