export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function plural(n: number, one: string, few: string, many: string) {
  const m=Math.abs(n)%100, m2=m%10;
  if(m>10&&m<20) return many; if(m2>1&&m2<5) return few; if(m2===1) return one; return many;
}
