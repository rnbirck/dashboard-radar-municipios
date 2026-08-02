param(
    [string]$RegionId = "RF1",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$regionKey = $RegionId.Trim().ToLowerInvariant()
if ($regionKey -notmatch "^rf[1-9]$") {
    throw "RegionId inválido: $RegionId. Use RF1 a RF9."
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $projectRoot "docs\exports\ranking-$regionKey-2025-vs-2024-somente-tabela-6000px.png"
}

$ranking2025Path = Join-Path $projectRoot "public\data\v2025\rankings\2025\$regionKey.json"
$ranking2024Path = Join-Path $projectRoot "public\data\v2025\rankings\2024\$regionKey.json"
$ranking2025 = ([System.IO.File]::ReadAllText($ranking2025Path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json).data
$ranking2024 = ([System.IO.File]::ReadAllText($ranking2024Path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json).data

$previousByMunicipality = @{}
foreach ($municipality in $ranking2024.municipalities) {
    $previousByMunicipality[$municipality.municipalityId] = $municipality
}

$cedilla = [char]0x00E7
$aTilde = [char]0x00E3
$iAcuteUpper = [char]0x00CD
$uAcute = [char]0x00FA
$oCircumflex = [char]0x00F4

$dimensions = @(
    [pscustomobject]@{ Label = "Geral"; Key = "overallRank" },
    [pscustomobject]@{ Label = "Educa" + $cedilla + $aTilde + "o"; Key = "educacao" },
    [pscustomobject]@{ Label = "Finan" + $cedilla + "as"; Key = "financas" },
    [pscustomobject]@{ Label = "Meio Ambiente"; Key = "meioAmbiente" },
    [pscustomobject]@{ Label = "Sa" + $uAcute + "de"; Key = "saude" },
    [pscustomobject]@{ Label = "Seguran" + $cedilla + "a"; Key = "seguranca" },
    [pscustomobject]@{ Label = "Socioecon" + $oCircumflex + "mico"; Key = "socioeconomico" }
)

$baseWidth = 2600.0
$baseHeight = 1732.0
$outputWidth = 6000
$scale = $outputWidth / $baseWidth
$outputHeight = [int][Math]::Round($baseHeight * $scale)
$wordWidthCm = 18.5
$outputDpi = $outputWidth / ($wordWidthCm / 2.54)

function Scale-Value([double]$value) {
    return [single]($value * $script:scale)
}

function Get-Color([string]$hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-Brush([string]$hex) {
    return [System.Drawing.SolidBrush]::new((Get-Color $hex))
}

function New-Pen([string]$hex, [double]$width) {
    return [System.Drawing.Pen]::new((Get-Color $hex), (Scale-Value $width))
}

function Draw-Text {
    param(
        [string]$Value,
        [double]$X,
        [double]$Y,
        [double]$Width,
        [double]$Height,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush,
        [ValidateSet("Left", "Center", "Right")]
        [string]$Alignment = "Center"
    )

    $format = [System.Drawing.StringFormat]::new()
    try {
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $format.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
        $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
        $format.Alignment = switch ($Alignment) {
            "Left" { [System.Drawing.StringAlignment]::Near }
            "Right" { [System.Drawing.StringAlignment]::Far }
            default { [System.Drawing.StringAlignment]::Center }
        }
        $rectangle = [System.Drawing.RectangleF]::new(
            (Scale-Value $X),
            (Scale-Value $Y),
            (Scale-Value $Width),
            (Scale-Value $Height)
        )
        $script:graphics.DrawString($Value, $Font, $Brush, $rectangle, $format)
    }
    finally {
        $format.Dispose()
    }
}

function Split-TextLines {
    param(
        [string]$Value,
        [int]$MaximumCharacters
    )

    if ($Value.Length -le $MaximumCharacters) {
        return @($Value)
    }

    $lines = [System.Collections.Generic.List[string]]::new()
    $currentLine = ""
    foreach ($word in $Value.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)) {
        $candidate = if ([string]::IsNullOrEmpty($currentLine)) { $word } else { "$currentLine $word" }
        if ($candidate.Length -le $MaximumCharacters -or [string]::IsNullOrEmpty($currentLine)) {
            $currentLine = $candidate
        }
        else {
            $lines.Add($currentLine)
            $currentLine = $word
        }
    }
    if (-not [string]::IsNullOrEmpty($currentLine)) {
        $lines.Add($currentLine)
    }

    if ($lines.Count -le 2) {
        return @($lines)
    }
    return @($lines[0], (($lines | Select-Object -Skip 1) -join " "))
}

function Draw-WrappedText {
    param(
        [string]$Value,
        [double]$X,
        [double]$Y,
        [double]$Width,
        [double]$Height,
        [int]$MaximumCharacters,
        [double]$LineHeight,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush
    )

    $lines = @(Split-TextLines $Value $MaximumCharacters)
    if ($lines.Count -eq 1) {
        Draw-Text $lines[0] $X $Y $Width $Height $Font $Brush "Left"
        return
    }

    $centerY = $Y + $Height / 2
    Draw-Text $lines[0] $X ($centerY - $LineHeight) $Width $LineHeight $Font $Brush "Left"
    Draw-Text $lines[1] $X $centerY $Width $LineHeight $Font $Brush "Left"
}

function Draw-RoundedRectangle {
    param(
        [double]$X,
        [double]$Y,
        [double]$Width,
        [double]$Height,
        [double]$Radius,
        [System.Drawing.Brush]$Fill,
        [System.Drawing.Pen]$Stroke
    )

    $xScaled = Scale-Value $X
    $yScaled = Scale-Value $Y
    $widthScaled = Scale-Value $Width
    $heightScaled = Scale-Value $Height
    $diameter = Scale-Value ($Radius * 2)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
        $path.AddArc($xScaled, $yScaled, $diameter, $diameter, 180, 90)
        $path.AddArc($xScaled + $widthScaled - $diameter, $yScaled, $diameter, $diameter, 270, 90)
        $path.AddArc($xScaled + $widthScaled - $diameter, $yScaled + $heightScaled - $diameter, $diameter, $diameter, 0, 90)
        $path.AddArc($xScaled, $yScaled + $heightScaled - $diameter, $diameter, $diameter, 90, 90)
        $path.CloseFigure()
        $script:graphics.FillPath($Fill, $path)
        $script:graphics.DrawPath($Stroke, $path)
    }
    finally {
        $path.Dispose()
    }
}

function Get-RankPalette([int]$rank) {
    return [pscustomobject]@{
        Fill = "#e9eef3"
        Stroke = "#c7d1db"
        Text = "#344a5f"
    }
}

function Get-VariationPalette([int]$variation) {
    if ($variation -gt 0) {
        return [pscustomobject]@{ Fill = "#dff3ea"; Stroke = "#b7dfcf"; Text = "#087654"; Label = "$([char]0x2191) +$variation" }
    }
    if ($variation -lt 0) {
        return [pscustomobject]@{ Fill = "#fde8e8"; Stroke = "#efc1c4"; Text = "#b4232d"; Label = "$([char]0x2193) $([char]0x2212)$([Math]::Abs($variation))" }
    }
    return [pscustomobject]@{ Fill = "#eef2f6"; Stroke = "#d7e0e7"; Text = "#526277"; Label = "$([char]0x2014) 0" }
}

$colors = @{
    Ink = "#142a41"
    Muted = "#52657a"
    Border = "#d8e2e9"
    BorderStrong = "#bdccd8"
    Header = "#e9f2f6"
    RowAlt = "#fbfcfd"
    White = "#ffffff"
    Municipality = "#0f3652"
    Corede = "#344a63"
}

$municipalityWidth = 330.0
$coredeWidth = 270.0
$identityWidth = $municipalityWidth + $coredeWidth
$groupWidth = ($baseWidth - $identityWidth) / $dimensions.Count
$rankWidth = 116.0
$variationWidth = $groupWidth - $rankWidth
$groupHeaderHeight = 60.0
$subHeaderHeight = 52.0
$headerHeight = $groupHeaderHeight + $subHeaderHeight
$rowHeight = 108.0

$bitmap = [System.Drawing.Bitmap]::new(
    $outputWidth,
    $outputHeight,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
)
$bitmap.SetResolution([single]$outputDpi, [single]$outputDpi)

$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$script:graphics = $graphics

$brushes = @{}
$pens = @{}
$fonts = @{}

try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear((Get-Color $colors.White))

    foreach ($entry in $colors.GetEnumerator()) {
        $brushes[$entry.Key] = New-Brush $entry.Value
    }
    $pens.Border = New-Pen $colors.Border 1
    $pens.BorderStrong = New-Pen $colors.BorderStrong 1.5
    $pens.Group = New-Pen $colors.BorderStrong 2

    $fontFamily = "Segoe UI"
    $fonts.IdentityHeader = [System.Drawing.Font]::new($fontFamily, (Scale-Value 24), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.GroupHeader = [System.Drawing.Font]::new($fontFamily, (Scale-Value 21), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.SubHeader = [System.Drawing.Font]::new($fontFamily, (Scale-Value 17), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.Municipality = [System.Drawing.Font]::new($fontFamily, (Scale-Value 30), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.Corede = [System.Drawing.Font]::new($fontFamily, (Scale-Value 25), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.Rank = [System.Drawing.Font]::new($fontFamily, (Scale-Value 28), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.Rank3Digit = [System.Drawing.Font]::new($fontFamily, (Scale-Value 25), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.OverallRank = [System.Drawing.Font]::new($fontFamily, (Scale-Value 29), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fonts.Variation = [System.Drawing.Font]::new($fontFamily, (Scale-Value 24), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

    # Fundo do cabeçalho.
    $graphics.FillRectangle($brushes.Header, 0, 0, $outputWidth, (Scale-Value $headerHeight))

    Draw-Text ("MUNIC" + $iAcuteUpper + "PIO") 18 0 ($municipalityWidth - 30) $headerHeight $fonts.IdentityHeader $brushes.Ink "Left"
    Draw-Text "COREDE" ($municipalityWidth + 18) 0 ($coredeWidth - 30) $headerHeight $fonts.IdentityHeader $brushes.Ink "Left"

    for ($dimensionIndex = 0; $dimensionIndex -lt $dimensions.Count; $dimensionIndex++) {
        $groupX = $identityWidth + $dimensionIndex * $groupWidth
        Draw-Text $dimensions[$dimensionIndex].Label.ToUpperInvariant() $groupX 0 $groupWidth $groupHeaderHeight $fonts.GroupHeader $brushes.Ink
        Draw-Text "POS. 2025" $groupX $groupHeaderHeight $rankWidth $subHeaderHeight $fonts.SubHeader $brushes.Muted
        Draw-Text "VAR." ($groupX + $rankWidth) $groupHeaderHeight $variationWidth $subHeaderHeight $fonts.SubHeader $brushes.Muted
    }

    $topMunicipalities = @($ranking2025.municipalities | Select-Object -First 15)
    for ($rowIndex = 0; $rowIndex -lt $topMunicipalities.Count; $rowIndex++) {
        $municipality = $topMunicipalities[$rowIndex]
        $previous = $previousByMunicipality[$municipality.municipalityId]
        $rowY = $headerHeight + $rowIndex * $rowHeight

        if ($rowIndex % 2 -eq 1) {
            $graphics.FillRectangle(
                $brushes.RowAlt,
                0,
                (Scale-Value $rowY),
                $outputWidth,
                (Scale-Value $rowHeight)
            )
        }

        Draw-WrappedText $municipality.municipalityName 18 $rowY ($municipalityWidth - 30) $rowHeight 17 34 $fonts.Municipality $brushes.Municipality
        Draw-WrappedText $municipality.coredeName ($municipalityWidth + 18) $rowY ($coredeWidth - 30) $rowHeight 16 29 $fonts.Corede $brushes.Corede

        for ($dimensionIndex = 0; $dimensionIndex -lt $dimensions.Count; $dimensionIndex++) {
            $dimension = $dimensions[$dimensionIndex]
            if ($dimension.Key -eq "overallRank") {
                $rank = [int]$municipality.overallRank
                $previousRank = [int]$previous.overallRank
            }
            else {
                $rank = [int]$municipality.dimensionRanks.($dimension.Key)
                $previousRank = [int]$previous.dimensionRanks.($dimension.Key)
            }

            $variation = $previousRank - $rank
            $groupX = $identityWidth + $dimensionIndex * $groupWidth
            $rankBadgeWidth = if ($dimensionIndex -eq 0) { 80.0 } else { 94.0 }
            $rankBadgeHeight = if ($dimensionIndex -eq 0) { 52.0 } else { 48.0 }
            $rankX = $groupX + $rankWidth / 2 - $rankBadgeWidth / 2
            $rankY = $rowY + $rowHeight / 2 - $rankBadgeHeight / 2
            $rankPalette = Get-RankPalette $rank
            $rankFill = New-Brush $rankPalette.Fill
            $rankStroke = New-Pen $rankPalette.Stroke 1.3
            $rankText = New-Brush $rankPalette.Text
            try {
                Draw-RoundedRectangle $rankX $rankY $rankBadgeWidth $rankBadgeHeight 9 $rankFill $rankStroke
                $rankFont = if ($dimensionIndex -eq 0) {
                    $fonts.OverallRank
                }
                elseif ($rank -ge 100) {
                    $fonts.Rank3Digit
                }
                else {
                    $fonts.Rank
                }
                Draw-Text "$rank$([char]0x00BA)" $rankX ($rankY + 1) $rankBadgeWidth $rankBadgeHeight $rankFont $rankText
            }
            finally {
                $rankFill.Dispose()
                $rankStroke.Dispose()
                $rankText.Dispose()
            }

            $variationPalette = Get-VariationPalette $variation
            $pillWidth = 124.0
            $pillHeight = 48.0
            $pillCenterX = $groupX + $rankWidth + $variationWidth / 2
            $pillX = $pillCenterX - $pillWidth / 2
            $pillY = $rowY + $rowHeight / 2 - $pillHeight / 2
            $pillFill = New-Brush $variationPalette.Fill
            $pillStroke = New-Pen $variationPalette.Stroke 1.3
            $pillText = New-Brush $variationPalette.Text
            try {
                Draw-RoundedRectangle $pillX $pillY $pillWidth $pillHeight 18 $pillFill $pillStroke
                Draw-Text $variationPalette.Label $pillX ($pillY + 1) $pillWidth $pillHeight $fonts.Variation $pillText
            }
            finally {
                $pillFill.Dispose()
                $pillStroke.Dispose()
                $pillText.Dispose()
            }
        }
    }

    # Grade horizontal.
    $graphics.DrawLine($pens.BorderStrong, 0, (Scale-Value $headerHeight), $outputWidth, (Scale-Value $headerHeight))
    for ($rowLineIndex = 1; $rowLineIndex -le 15; $rowLineIndex++) {
        $lineY = Scale-Value ($headerHeight + $rowLineIndex * $rowHeight)
        $graphics.DrawLine($pens.Border, 0, $lineY, $outputWidth, $lineY)
    }

    # Grade vertical e cabeçalho agrupado.
    $graphics.DrawLine($pens.Border, (Scale-Value $municipalityWidth), 0, (Scale-Value $municipalityWidth), $outputHeight)
    $graphics.DrawLine($pens.Group, (Scale-Value $identityWidth), 0, (Scale-Value $identityWidth), $outputHeight)
    for ($dimensionIndex = 0; $dimensionIndex -lt $dimensions.Count; $dimensionIndex++) {
        $groupX = $identityWidth + $dimensionIndex * $groupWidth
        if ($dimensionIndex -gt 0) {
            $graphics.DrawLine($pens.Group, (Scale-Value $groupX), 0, (Scale-Value $groupX), $outputHeight)
        }
        $splitX = $groupX + $rankWidth
        $graphics.DrawLine($pens.Border, (Scale-Value $splitX), (Scale-Value $groupHeaderHeight), (Scale-Value $splitX), $outputHeight)
        $graphics.DrawLine(
            $pens.BorderStrong,
            (Scale-Value $groupX),
            (Scale-Value $groupHeaderHeight),
            (Scale-Value ($groupX + $groupWidth)),
            (Scale-Value $groupHeaderHeight)
        )
    }

    # Contorno externo.
    $graphics.DrawRectangle(
        $pens.BorderStrong,
        0,
        0,
        ($outputWidth - 1),
        ($outputHeight - 1)
    )

    $outputDirectory = Split-Path -Parent $OutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory | Out-Null
    }
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    foreach ($font in $fonts.Values) {
        if ($null -ne $font) { $font.Dispose() }
    }
    foreach ($pen in $pens.Values) {
        if ($null -ne $pen) { $pen.Dispose() }
    }
    foreach ($brush in $brushes.Values) {
        if ($null -ne $brush) { $brush.Dispose() }
    }
    $graphics.Dispose()
    $bitmap.Dispose()
}

$image = [System.Drawing.Image]::FromFile($OutputPath)
try {
    [pscustomobject]@{
        Path = $OutputPath
        Width = $image.Width
        Height = $image.Height
        Bytes = (Get-Item -LiteralPath $OutputPath).Length
    } | Format-List
}
finally {
    $image.Dispose()
}
