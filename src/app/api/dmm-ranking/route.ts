export async function GET() {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const url =
    `https://api.dmm.com/affiliate/v3/ItemList` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&site=FANZA` +
    `&service=digital` +
    `&floor=videoa` +
    `&hits=20` +
    `&sort=rank` +
    `&output=json`;

  const res = await fetch(url);
  const data = await res.json();

  return Response.json(data);
}