# ============================================================
# set-tunnel-env.ps1
# Usage: .\set-tunnel-env.ps1 -TunnelUrl "https://your-tunnel.trycloudflare.com"
#
# What it does:
#   1. Removes old SUPABASE_TUNNEL_URL and NEXT_PUBLIC_SUPABASE_URL from Vercel (production)
#   2. Sets SUPABASE_TUNNEL_URL = <your tunnel>
#   3. Sets NEXT_PUBLIC_SUPABASE_URL = https://my-app-swart-kappa-40.vercel.app/supabase-proxy
#   4. Redeploys to production
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$TunnelUrl
)

$VERCEL_APP_URL = "https://my-app-swart-kappa-40.vercel.app"
$PROXY_URL      = "$VERCEL_APP_URL/supabase-proxy"
$ANON_KEY       = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

Write-Host "`n==> Tunnel URL : $TunnelUrl" -ForegroundColor Cyan
Write-Host "==> Proxy URL  : $PROXY_URL`n" -ForegroundColor Cyan

# --- Remove stale env vars (ignore errors if they don't exist) ---
Write-Host "[1/4] Removing old env vars..." -ForegroundColor Yellow
vercel env rm SUPABASE_TUNNEL_URL     production --yes 2>$null
vercel env rm NEXT_PUBLIC_SUPABASE_URL production --yes 2>$null

# --- Set SUPABASE_TUNNEL_URL (server-side only, not public) ---
Write-Host "[2/4] Setting SUPABASE_TUNNEL_URL..." -ForegroundColor Yellow
$TunnelUrl | vercel env add SUPABASE_TUNNEL_URL production

# --- Set NEXT_PUBLIC_SUPABASE_URL to the proxy path ---
Write-Host "[3/4] Setting NEXT_PUBLIC_SUPABASE_URL..." -ForegroundColor Yellow
$PROXY_URL | vercel env add NEXT_PUBLIC_SUPABASE_URL production

# --- Redeploy ---
Write-Host "[4/4] Redeploying to production..." -ForegroundColor Yellow
vercel --prod --yes

Write-Host "`n✅ Done! Your Vercel app now proxies Supabase through:" -ForegroundColor Green
Write-Host "   $PROXY_URL  →  $TunnelUrl`n" -ForegroundColor Green
