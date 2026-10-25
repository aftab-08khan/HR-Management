export async function GET() {
  return Response.json({google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), database: !!process.env.MONGODB_URI});
}
