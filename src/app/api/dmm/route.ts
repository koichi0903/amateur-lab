export async function GET(request: Request) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const { searchParams } = new URL(request.url);
  const keyword =
    searchParams.get("keyword") || "素人";

    const cid =
  searchParams.get("cid");

  const url =
  'https://api.dmm.com/affiliate/v3/ItemList' +
  `?api_id=${apiId}` +
  `&affiliate_id=${affiliateId}` +
  '&site=FANZA' +
  '&service=digital' +
  '&floor=videoa' +

  (cid
    ? `&cid=${cid}`
    : `&keyword=${encodeURIComponent(keyword)}`) +

  '&output=json';

const res = await fetch(url);
const data = await res.json();

return Response.json(data);
}