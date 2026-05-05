# ============================================================
# start-tunnel.ps1
# Usage: .\start-tunnel.ps1
#
# What it does:
#   Starts the ngrok permanent tunnel pointing to your local Supabase.
# ============================================================

Write-Host "Starting permanent Ngrok tunnel..." -ForegroundColor Cyan
Write-Host "Domain: exfoliate-speed-underdog.ngrok-free.dev" -ForegroundColor Cyan
Write-Host "Port:   54321 (Local Supabase)`n" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the tunnel.`n" -ForegroundColor Yellow

ngrok http --url=exfoliate-speed-underdog.ngrok-free.dev 54321
