# ============================================================
# set-tunnel-env.ps1
# Usage: .\set-tunnel-env.ps1 -TunnelUrl "https://your-tunnel.trycloudflare.com"
#
# What it does:
#   1. Sets NEXT_PUBLIC_SUPABASE_URL = <your tunnel> in Vercel
#   2. Redeploys to production
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$TunnelUrl
)

Write-Host "`n==> Updating Vercel to use Tunnel URL : $TunnelUrl`n" -ForegroundColor Cyan

# Remove proxy-related env var if it exists
vercel env rm SUPABASE_TUNNEL_URL production --yes 2>$null

# Save to file to avoid newlines when piping
Set-Content -Path "tunnel_url.txt" -Value $TunnelUrl -NoNewline
cmd.exe /c "vercel env rm NEXT_PUBLIC_SUPABASE_URL production --yes"
cmd.exe /c "vercel env add NEXT_PUBLIC_SUPABASE_URL production < tunnel_url.txt"
Remove-Item "tunnel_url.txt" -ErrorAction SilentlyContinue

Write-Host "`nRedeploying to production..." -ForegroundColor Yellow
vercel --prod --yes

Write-Host "`n✅ Done! Your Vercel app is now connected to $TunnelUrl`n" -ForegroundColor Green
