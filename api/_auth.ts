export function checkAuth(req: any): boolean {
  const expected = process.env.ACCESS_PASSWORD;
  if (!expected) return true;

  const header = req.headers['authorization'] || '';
  const token = header.replace('Bearer ', '');
  return token === expected;
}
