$video = "C:\Users\divin\Downloads\WhatsApp Video 2026-05-16 at 00.49.17.mp4"
$outDir = "C:\Users\divin\OneDrive\Documents\fitness-tracker-app\.tmp-video-frames"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Add-Type -AssemblyName PresentationCore,WindowsBase
$player = New-Object System.Windows.Media.MediaPlayer
$script:opened = $false
$script:failed = $false
$player.add_MediaOpened({ $script:opened = $true })
$player.add_MediaFailed({ $script:failed = $true })
$player.Open([Uri]$video)
$deadline = (Get-Date).AddSeconds(15)
while (-not $opened -and -not $failed -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 100 }
if (-not $opened) { throw "Media did not open" }
$width = [int]$player.NaturalVideoWidth
$height = [int]$player.NaturalVideoHeight
$duration = $player.NaturalDuration.TimeSpan.TotalSeconds
$times = @(0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6, 6.4, 7.2, 8.0) | Where-Object { $_ -lt $duration }
$i = 0
foreach ($t in $times) {
  $player.Position = [TimeSpan]::FromSeconds($t)
  Start-Sleep -Milliseconds 700
  $dv = New-Object System.Windows.Media.DrawingVisual
  $dc = $dv.RenderOpen()
  $dc.DrawVideo($player, (New-Object System.Windows.Rect(0,0,$width,$height)))
  $dc.Close()
  $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($width, $height, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
  $rtb.Render($dv)
  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))
  $path = Join-Path $outDir ("frame-{0:D2}.png" -f $i)
  $stream = [System.IO.File]::Open($path, [System.IO.FileMode]::Create)
  $encoder.Save($stream)
  $stream.Close()
  $i++
}
$player.Close()
Get-ChildItem -LiteralPath $outDir -Filter "*.png" | Select-Object FullName,Length
