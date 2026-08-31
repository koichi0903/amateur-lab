export function blockVercelAdminUpdate() {
  if (process.env.VERCEL && process.env.ENABLE_VERCEL_ADMIN_UPDATES !== "true") {
    return Response.json(
      {
        success: false,
        skipped: true,
        message:
          "Vercel上の重い更新処理は停止中です。ローカル更新を使うか、ENABLE_VERCEL_ADMIN_UPDATES=true を明示してください。",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  return null;
}
