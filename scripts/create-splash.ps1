$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$appDirectory = Join-Path $PSScriptRoot '../app'
$logo = [System.Drawing.Image]::FromFile((Join-Path $appDirectory 'logo.png'))
$canvas = New-Object System.Drawing.Bitmap(1920, 1080)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
try {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#18142f'))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $width = 444
    $height = [int][Math]::Round($width * $logo.Height / $logo.Width)
    $graphics.DrawImage($logo, [int]((1920 - $width) / 2), [int]((1080 - $height) / 2), $width, $height)
    $canvas.Save((Join-Path $appDirectory 'splash.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $canvas.Dispose()
    $logo.Dispose()
}
